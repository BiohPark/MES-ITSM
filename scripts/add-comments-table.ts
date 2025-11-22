import { getPool } from '../lib/db'

async function addCommentsTable() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('comments 테이블 생성 중...')

    // comments 테이블 생성
    await connection.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id VARCHAR(50) PRIMARY KEY,
        entity_type VARCHAR(20) NOT NULL COMMENT 'project, task, gmp_record 중 하나',
        entity_id VARCHAR(50) NOT NULL COMMENT '프로젝트, 일감, 또는 GMP Record의 ID',
        author VARCHAR(100) NOT NULL COMMENT '댓글 작성자',
        content TEXT NOT NULL COMMENT '댓글 내용',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_entity (entity_type, entity_id),
        INDEX idx_author (author),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    console.log('✅ comments 테이블 생성 완료!')

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
    await addCommentsTable()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

