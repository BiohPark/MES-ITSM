import { getPool } from './db'
import { promises as fs } from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

// 업로드 디렉토리 생성
export async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR)
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  }
}

export interface Attachment {
  id: string
  record_id: string
  record_type: string
  file_name: string
  file_path: string
  file_size: number
  mime_type: string | null
  uploaded_by: string
  upload_date: Date
  created_at: Date
  updated_at: Date
}

export interface AttachmentMetadata {
  id: string
  record_id: string
  record_type: string
  file_name: string
  file_size: number
  mime_type: string | null
  uploaded_by: string
  upload_date: Date
  uploader_name?: string
}

// 다음 첨부파일 ID 생성
export async function getNextAttachmentId(): Promise<string> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    "SELECT id FROM attachments WHERE id LIKE 'ATT-%' ORDER BY id DESC LIMIT 1"
  )

  if (rows.length === 0) {
    return 'ATT-00001'
  }

  const lastId = rows[0].id
  const match = lastId.match(/ATT-(\d+)/)
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1
    return `ATT-${String(nextNum).padStart(5, '0')}`
  }

  return 'ATT-00001'
}

// 파일 저장
export async function saveFile(
  file: Buffer,
  originalFileName: string,
  recordId: string,
  recordType: string,
  uploadedBy: string
): Promise<{ attachmentId: string; filePath: string }> {
  await ensureUploadDir()

  // 파일 크기 검증
  if (file.length > MAX_FILE_SIZE) {
    throw new Error(`파일 크기가 25MB를 초과합니다. (현재: ${(file.length / 1024 / 1024).toFixed(2)}MB)`)
  }

  // 안전한 파일명 생성
  const fileExt = path.extname(originalFileName)
  const safeFileName = `${randomBytes(16).toString('hex')}${fileExt}`
  const filePath = path.join(UPLOAD_DIR, safeFileName)

  // 파일 저장
  await fs.writeFile(filePath, file)

  // 메타데이터 저장
  const attachmentId = await getNextAttachmentId()
  const pool = getPool()
  const mimeType = getMimeType(fileExt)

  await pool.query(
    `INSERT INTO attachments (id, record_id, record_type, file_name, file_path, file_size, mime_type, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [attachmentId, recordId, recordType, originalFileName, filePath, file.length, mimeType, uploadedBy]
  )

  return { attachmentId, filePath }
}

// MIME 타입 추정
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
  }
  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream'
}

// 첨부파일 목록 조회
export async function getAttachments(
  recordId: string,
  recordType: string = 'task'
): Promise<AttachmentMetadata[]> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    `SELECT 
      a.id,
      a.record_id,
      a.record_type,
      a.file_name,
      a.file_size,
      a.mime_type,
      a.uploaded_by,
      a.upload_date,
      u.name AS uploader_name
    FROM attachments a
    LEFT JOIN users u ON a.uploaded_by = u.id
    WHERE a.record_id = ? AND a.record_type = ?
    ORDER BY a.upload_date DESC`,
    [recordId, recordType]
  )

  return rows.map((row) => ({
    id: row.id,
    record_id: row.record_id,
    record_type: row.record_type,
    file_name: row.file_name,
    file_size: row.file_size,
    mime_type: row.mime_type,
    uploaded_by: row.uploaded_by,
    upload_date: row.upload_date,
    uploader_name: row.uploader_name || 'Unknown',
  }))
}

// 첨부파일 조회 (파일 경로 포함)
export async function getAttachment(attachmentId: string): Promise<Attachment | null> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    'SELECT * FROM attachments WHERE id = ?',
    [attachmentId]
  )

  if (rows.length === 0) {
    return null
  }

  return {
    id: rows[0].id,
    record_id: rows[0].record_id,
    record_type: rows[0].record_type,
    file_name: rows[0].file_name,
    file_path: rows[0].file_path,
    file_size: rows[0].file_size,
    mime_type: rows[0].mime_type,
    uploaded_by: rows[0].uploaded_by,
    upload_date: rows[0].upload_date,
    created_at: rows[0].created_at,
    updated_at: rows[0].updated_at,
  }
}

// 첨부파일 삭제
export async function deleteAttachment(attachmentId: string, userId: string): Promise<void> {
  const pool = getPool()

  // 첨부파일 정보 조회
  const attachment = await getAttachment(attachmentId)
  if (!attachment) {
    throw new Error('첨부파일을 찾을 수 없습니다.')
  }

  // 권한 확인: 업로더이거나 admin만 삭제 가능
  const [users] = await pool.query<any[]>(
    'SELECT role FROM users WHERE id = ?',
    [userId]
  )

  const userRole = users.length > 0 ? users[0].role : null
  if (attachment.uploaded_by !== userId && userRole !== 'admin') {
    throw new Error('첨부파일을 삭제할 권한이 없습니다.')
  }

  // 파일 삭제
  try {
    await fs.unlink(attachment.file_path)
  } catch (error) {
    console.error('Error deleting file:', error)
    // 파일이 없어도 DB 레코드는 삭제
  }

  // DB 레코드 삭제
  await pool.query('DELETE FROM attachments WHERE id = ?', [attachmentId])
}

// formatFileSize는 utils/file-utils.ts로 이동됨 (클라이언트 호환성)

