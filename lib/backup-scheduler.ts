import { createBackup, cleanupOldBackups } from './backup'
import { getSystemSettingFloat } from './settings'

let backupInterval: NodeJS.Timeout | null = null
let isRunning = false

/**
 * 자동 백업 스케줄러 시작
 * system_settings.backup_schedule_interval_hours 주기로 백업 생성 (기본 1시간).
 */
export async function startBackupScheduler() {
  if (backupInterval) {
    console.log('[Backup Scheduler] 이미 실행 중입니다.')
    return
  }

  const hours = await getSystemSettingFloat('backup_schedule_interval_hours', 1)
  const intervalMs = Math.max(5 * 60 * 1000, Math.round(hours * 60 * 60 * 1000)) // 최소 5분
  console.log(`[Backup Scheduler] 자동 백업 스케줄러를 시작합니다. (${hours}시간마다 실행)`)

  runBackup()

  backupInterval = setInterval(() => {
    runBackup()
  }, intervalMs)
}

/**
 * 자동 백업 스케줄러 중지
 */
export function stopBackupScheduler() {
  if (backupInterval) {
    clearInterval(backupInterval)
    backupInterval = null
    console.log('[Backup Scheduler] 자동 백업 스케줄러를 중지했습니다.')
  }
}

/**
 * 백업 실행
 */
async function runBackup() {
  // 중복 실행 방지
  if (isRunning) {
    console.log('[Backup Scheduler] 백업이 이미 실행 중입니다. 건너뜁니다.')
    return
  }

  try {
    isRunning = true
    const timestamp = new Date().toISOString()
    console.log(`[Backup Scheduler] [${timestamp}] 자동 백업 시작...`)
    
    const filename = await createBackup('auto')
    
    console.log(`[Backup Scheduler] [${timestamp}] 자동 백업 완료: ${filename}`)

    // system_settings.backup_retention_days 기준 오래된 백업 자동 정리
    const deletedCount = await cleanupOldBackups()
    if (deletedCount > 0) {
      console.log(`[Backup Scheduler] [${timestamp}] 오래된 백업 ${deletedCount}개 삭제 완료`)
    }
  } catch (error) {
    const timestamp = new Date().toISOString()
    const err = error as { message?: string; code?: string }
    if (err?.code === 'ECONNREFUSED' || err?.message?.includes('connection refused')) {
      console.warn(
        `[Backup Scheduler] [${timestamp}] DB 연결 불가로 백업 건너뜀. MariaDB/MySQL 실행 후 .env.local 설정을 확인하세요.`
      )
    } else {
      console.error(`[Backup Scheduler] [${timestamp}] 자동 백업 실패:`, error)
    }
  } finally {
    isRunning = false
  }
}


