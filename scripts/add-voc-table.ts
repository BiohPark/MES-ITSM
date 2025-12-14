import { getPool } from '../lib/db'

async function addVocTable() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('VOC 피드백 테이블 생성 중...')

    // voc_feedbacks 테이블 생성
    await connection.query(`
      CREATE TABLE IF NOT EXISTS voc_feedbacks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        user_name VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT '기타',
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Open',
        priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
        admin_response TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    console.log('✅ VOC 피드백 테이블 생성 완료!')

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    console.error('❌ VOC 피드백 테이블 생성 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await addVocTable()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

