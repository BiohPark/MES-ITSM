import { getPool } from '@/lib/db'

async function main() {
  const pool = getPool()

  console.log('[add-gantt-events-table] 시작')

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    await conn.query(`
      CREATE TABLE IF NOT EXISTS gantt_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        event_date DATE NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_by VARCHAR(50) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_gantt_events_project FOREIGN KEY (project_id) REFERENCES gantt_projects(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    await conn.commit()
    console.log('[add-gantt-events-table] 완료')
  } catch (err) {
    await conn.rollback()
    console.error('[add-gantt-events-table] 오류:', err)
    process.exitCode = 1
  } finally {
    conn.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error('[add-gantt-events-table] 치명적 오류:', err)
  process.exit(1)
})

