/**
 * gantt_projects.owner_id 컬럼 타입 수정
 * INT → VARCHAR(50) (users.id 형식과 일치)
 */
import './load-env'
import { getPool } from '../lib/db'

async function main() {
  const pool = getPool()
  const conn = await pool.getConnection()

  try {
    const [cols] = await conn.query<any[]>(
      `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gantt_projects' AND COLUMN_NAME = 'owner_id'`
    )
    if (cols.length === 0) {
      console.log('gantt_projects 테이블 없음 - 건너뜀')
      return
    }
    if (String(cols[0].COLUMN_TYPE).toLowerCase().includes('varchar')) {
      console.log('gantt_projects.owner_id 이미 VARCHAR - 건너뜀')
      return
    }
    console.log('gantt_projects.owner_id 컬럼 수정 중 (INT → VARCHAR)...')
    await conn.query(`
      ALTER TABLE gantt_projects
      MODIFY COLUMN owner_id VARCHAR(50) NULL
    `)
    console.log('✅ gantt_projects.owner_id VARCHAR(50)로 수정 완료')
  } catch (err: any) {
    console.error('❌ 오류:', err.message)
    process.exitCode = 1
  } finally {
    conn.release()
    await pool.end()
  }
}

main()
