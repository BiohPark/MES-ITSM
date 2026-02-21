import { getPool } from './db'
import { getSystemSettingNumber } from './settings'
import * as fs from 'fs/promises'
import * as path from 'path'

const BACKUP_DIR = path.join(process.cwd(), 'backups')

export interface BackupMetadata {
  id: number
  filename: string
  file_path: string
  file_size: number
  backup_type: 'auto' | 'manual'
  created_by?: string
  created_at: Date
}

// 백업 디렉토리 생성
export async function ensureBackupDir(): Promise<void> {
  try {
    await fs.access(BACKUP_DIR)
  } catch {
    await fs.mkdir(BACKUP_DIR, { recursive: true })
  }
}

// KST(한국 표준시) 타임스탬프 생성
function getKSTTimestamp(): string {
  const now = new Date()
  // UTC+9 (KST)
  const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000))
  // ISO 형식으로 변환하고 'Z' 제거 후 파일명에 사용할 수 있도록 포맷팅
  const isoString = kstTime.toISOString()
  // 'Z' 제거하고 ':' 와 '.' 를 '-' 로 변경
  return isoString.replace('Z', '').replace(/[:.]/g, '-')
}

// 데이터베이스 전체를 JSON 형태로 백업
export async function createBackup(backupType: 'auto' | 'manual' = 'auto', createdBy?: string): Promise<string> {
  const pool = getPool()
  const timestamp = getKSTTimestamp()
  const filename = `backup-${timestamp}.json`
  const filePath = path.join(BACKUP_DIR, filename)

  await ensureBackupDir()

  // 모든 테이블 데이터 수집
  const backupData: any = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    tables: {},
  }

  // 백업 대상 테이블 (최근 추가 테이블 포함)
  const tables = [
    'projects',
    'project_children',
    'gmp_records',
    'val_packages',
    'val_package_task_links',
    'issues',
    'users',
    'voc_feedbacks',
    'comments',
    'attachments',
    'predecessors',
    'workflows',
    'workflow_statuses',
    'workflow_transitions',
    'workflow_schemes',
    'gantt_projects',
    'gantt_tasks',
    'gantt_events',
    'gantt_wbs_history',
    'meeting_notes',
    'system_settings',
    'backup_metadata',
  ]

  for (const table of tables) {
    try {
      const [rows] = await pool.query<any[]>(`SELECT * FROM ${table}`)
      backupData.tables[table] = rows
    } catch (error) {
      console.warn(`Table ${table} backup skipped:`, error)
      backupData.tables[table] = []
    }
  }

  // JSON 파일로 저장 (압축 없이 작은 크기 유지)
  const jsonContent = JSON.stringify(backupData, null, 2)
  await fs.writeFile(filePath, jsonContent, 'utf-8')

  const stats = await fs.stat(filePath)
  const fileSize = stats.size

  // 메타데이터 저장
  await pool.query(
    `INSERT INTO backup_metadata (filename, file_path, file_size, backup_type, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [filename, filePath, fileSize, backupType, createdBy || null]
  )

  return filename
}

// 백업 목록 조회
export async function getBackups(limit: number = 50): Promise<BackupMetadata[]> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    `SELECT * FROM backup_metadata ORDER BY created_at DESC LIMIT ?`,
    [limit]
  )

  return rows.map((row) => ({
    id: row.id,
    filename: row.filename,
    file_path: row.file_path,
    file_size: row.file_size,
    backup_type: row.backup_type,
    created_by: row.created_by || undefined,
    created_at: row.created_at,
  }))
}

// 특정 백업 파일 조회
export async function getBackupById(id: number): Promise<BackupMetadata | null> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    'SELECT * FROM backup_metadata WHERE id = ?',
    [id]
  )

  if (rows.length === 0) {
    return null
  }

  const row = rows[0]
  return {
    id: row.id,
    filename: row.filename,
    file_path: row.file_path,
    file_size: row.file_size,
    backup_type: row.backup_type,
    created_by: row.created_by || undefined,
    created_at: row.created_at,
  }
}

// 백업 파일에서 데이터베이스 복구
export async function restoreFromBackup(backupId: number): Promise<void> {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    // 백업 메타데이터 조회
    const backup = await getBackupById(backupId)
    if (!backup) {
      throw new Error('Backup not found')
    }

    // 백업 파일 읽기
    const backupContent = await fs.readFile(backup.file_path, 'utf-8')
    const backupData = JSON.parse(backupContent)

    // 테이블 순서대로 복구 (외래 키 제약 고려)
    const restoreOrder = [
      'users',
      'projects',
      'project_children',
      'gmp_records',
      'val_packages',
      'val_package_task_links',
      'issues',
      'voc_feedbacks',
      'comments',
      'attachments',
      'predecessors',
      'workflows',
      'workflow_statuses',
      'workflow_transitions',
      'workflow_schemes',
      'gantt_projects',
      'gantt_tasks',
      'gantt_events',
      'gantt_wbs_history',
      'meeting_notes',
      'system_settings',
      'backup_metadata',
    ]

    for (const table of restoreOrder) {
      const tableData = backupData.tables[table] || []

      if (tableData.length === 0) {
        continue
      }

      // 기존 데이터 삭제
      await connection.query(`DELETE FROM ${table}`)

      // 데이터 삽입
      if (tableData.length > 0) {
        const columns = Object.keys(tableData[0])
        const placeholders = columns.map(() => '?').join(', ')
        const values = tableData.map((row: any) => columns.map((col) => row[col]))

        for (const rowValues of values) {
          await connection.query(
            `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
            rowValues
          )
        }
      }
    }

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

// 오래된 백업 파일 삭제 (daysToKeep 미지정 시 system_settings.backup_retention_days 사용)
export async function cleanupOldBackups(daysToKeep?: number): Promise<number> {
  if (daysToKeep === undefined) {
    daysToKeep = await getSystemSettingNumber('backup_retention_days', 10)
  }
  const pool = getPool()
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

  // 오래된 백업 메타데이터 조회
  const [oldBackups] = await pool.query<any[]>(
    `SELECT id, file_path FROM backup_metadata WHERE created_at < ?`,
    [cutoffDate]
  )

  let deletedCount = 0

  for (const backup of oldBackups) {
    try {
      // 파일 삭제
      await fs.unlink(backup.file_path)
      // 메타데이터 삭제
      await pool.query('DELETE FROM backup_metadata WHERE id = ?', [backup.id])
      deletedCount++
    } catch (error) {
      console.warn(`Failed to delete backup ${backup.id}:`, error)
    }
  }

  return deletedCount
}

