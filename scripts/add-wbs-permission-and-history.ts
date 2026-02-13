/**
 * 1) users 테이블에 can_edit_wbs 컬럼 추가 (WBS 수정 권한, admin만 부여 가능)
 * 2) gantt_wbs_history 테이블 생성 (WBS 수정 이력)
 */
import { getPool } from '../lib/db'

async function main() {
  const pool = getPool()
  const conn = await pool.getConnection()

  try {
    // 1. users.can_edit_wbs 추가
    const [cols]: any[] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'can_edit_wbs'`
    )
    if (cols.length === 0) {
      await conn.query(`
        ALTER TABLE users ADD COLUMN can_edit_wbs TINYINT(1) NOT NULL DEFAULT 0
      `)
      console.log('users.can_edit_wbs 컬럼 추가 완료')
    } else {
      console.log('users.can_edit_wbs 이미 존재 - 건너뜀')
    }

    // 2. gantt_wbs_history 테이블
    await conn.query(`
      CREATE TABLE IF NOT EXISTS gantt_wbs_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        project_name VARCHAR(255) NOT NULL,
        user_id VARCHAR(50) NOT NULL,
        user_name VARCHAR(100) NOT NULL,
        action VARCHAR(50) NOT NULL DEFAULT 'save',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_project_id (project_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    console.log('gantt_wbs_history 테이블 확인/생성 완료')
  } finally {
    conn.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
