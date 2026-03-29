/**
 * WBS(gantt) ↔ 일감(project_children) 1:1 동기화용 컬럼
 * 실행: npx tsx scripts/add-gantt-sync-columns.ts
 */
import { getPool } from '../lib/db'

async function main() {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    try {
      await conn.query(`
        ALTER TABLE gantt_projects
        ADD COLUMN canonical_project_id VARCHAR(50) NULL,
        ADD INDEX idx_gantt_projects_canonical (canonical_project_id)
      `)
      console.log('✅ gantt_projects.canonical_project_id 추가')
    } catch (e: any) {
      if (e?.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ gantt_projects.canonical_project_id 이미 존재')
      } else {
        throw e
      }
    }

    try {
      await conn.query(`
        ALTER TABLE gantt_tasks
        ADD COLUMN project_child_id VARCHAR(100) NULL,
        ADD UNIQUE INDEX uk_gantt_tasks_project_child (project_child_id)
      `)
      console.log('✅ gantt_tasks.project_child_id 추가 (UNIQUE)')
    } catch (e: any) {
      if (e?.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ gantt_tasks.project_child_id 이미 존재')
      } else {
        throw e
      }
    }
  } finally {
    conn.release()
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
