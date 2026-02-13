/**
 * gantt_tasks 테이블에 progress_percent 컬럼 추가 (실적 %)
 */
import './load-env'
import { getPool } from '../lib/db'

async function main() {
  const pool = getPool()
  const conn = await pool.getConnection()

  try {
    const [cols] = await conn.query<any[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gantt_tasks' AND COLUMN_NAME = 'progress_percent'`
    )
    if (cols.length > 0) {
      console.log('gantt_tasks.progress_percent 이미 존재 - 건너뜀')
      return
    }
    console.log('gantt_tasks.progress_percent 컬럼 추가 중...')
    await conn.query(`
      ALTER TABLE gantt_tasks
      ADD COLUMN progress_percent DECIMAL(5,2) NULL DEFAULT 0 AFTER is_milestone
    `)
    console.log('✅ gantt_tasks.progress_percent 컬럼 추가 완료')
  } catch (err: any) {
    console.error('❌ 오류:', err.message)
    process.exitCode = 1
  } finally {
    conn.release()
    await pool.end()
  }
}

main()
