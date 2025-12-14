import { getPool } from '../lib/db'

async function addBackupTable() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('백업 메타데이터 테이블 생성 중...')

    // backup_metadata 테이블 생성
    await connection.query(`
      CREATE TABLE IF NOT EXISTS backup_metadata (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        file_path VARCHAR(500) NOT NULL,
        file_size BIGINT NOT NULL,
        backup_type VARCHAR(50) NOT NULL DEFAULT 'auto',
        created_by VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_created_at (created_at),
        INDEX idx_backup_type (backup_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    console.log('✅ 백업 메타데이터 테이블 생성 완료!')

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    console.error('❌ 백업 메타데이터 테이블 생성 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await addBackupTable()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

