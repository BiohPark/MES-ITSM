import { getPool } from '@/lib/db'

async function main() {
  const pool = getPool()

  console.log('[add-gantt-tables] 시작')

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // gantt_projects 테이블
    await conn.query(`
      CREATE TABLE IF NOT EXISTS gantt_projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        owner_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // gantt_tasks 테이블
    await conn.query(`
      CREATE TABLE IF NOT EXISTS gantt_tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        wbs_code VARCHAR(50) NULL,
        outline_level INT NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 1,
        name VARCHAR(255) NOT NULL,
        start_date DATE NULL,
        finish_date DATE NULL,
        duration_days INT NULL,
        predecessors VARCHAR(255) NULL,
        assignee VARCHAR(255) NULL,
        is_milestone TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_gantt_tasks_project FOREIGN KEY (project_id) REFERENCES gantt_projects(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    await conn.commit()
    console.log('[add-gantt-tables] 완료')
  } catch (err) {
    await conn.rollback()
    console.error('[add-gantt-tables] 오류:', err)
    process.exitCode = 1
  } finally {
    conn.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error('[add-gantt-tables] 치명적 오류:', err)
  process.exit(1)
})


