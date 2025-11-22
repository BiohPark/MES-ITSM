import { getPool } from '../lib/db'

async function addIssuesTable() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('issues 테이블 생성 중...')

    // issues 테이블 생성
    await connection.query(`
      CREATE TABLE IF NOT EXISTS issues (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'Open',
        owner VARCHAR(100) NOT NULL,
        occurred_date DATE NOT NULL,
        due_date DATE,
        resolved_date DATE,
        sw_version VARCHAR(100),
        cause TEXT,
        cause_category VARCHAR(100),
        module VARCHAR(100),
        is_deviation BOOLEAN DEFAULT FALSE,
        related_issue_id VARCHAR(50) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_owner (owner),
        INDEX idx_occurred_date (occurred_date),
        INDEX idx_related_issue_id (related_issue_id),
        FOREIGN KEY (related_issue_id) REFERENCES issues(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    console.log('✅ issues 테이블 생성 완료!')

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
    await addIssuesTable()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

