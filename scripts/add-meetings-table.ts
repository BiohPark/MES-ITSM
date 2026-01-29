import { getPool } from '../lib/db'

async function addMeetingsTable() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('meeting_notes 테이블 생성 중...')

    // meeting_notes 테이블 생성
    await connection.query(`
      CREATE TABLE IF NOT EXISTS meeting_notes (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        meeting_date DATE NOT NULL,
        attendees JSON NULL,
        agenda JSON NULL,
        discussion TEXT NULL,
        decisions TEXT NULL,
        action_items JSON NULL,
        next_meeting_date DATE NULL,
        created_by VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_meeting_date (meeting_date),
        INDEX idx_created_by (created_by),
        FULLTEXT INDEX idx_search (title, discussion, decisions)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    console.log('✅ meeting_notes 테이블 생성 완료!')

    await connection.commit()
    console.log('✅ 마이그레이션 완료!')
  } catch (error) {
    await connection.rollback()
    console.error('❌ 마이그레이션 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await addMeetingsTable()
    process.exit(0)
  } catch (error) {
    console.error('스크립트 실행 실패:', error)
    process.exit(1)
  }
}

main()

