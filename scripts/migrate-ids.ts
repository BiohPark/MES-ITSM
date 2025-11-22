import { getPool, getProjects } from '../lib/db'
import mysql from 'mysql2/promise'

async function migrateIds() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('기존 프로젝트 ID 마이그레이션 시작...')

    // 모든 프로젝트 조회
    const projects = await getProjects()

    // 프로젝트 ID 매핑 생성 (기존 ID -> 새 ID)
    const projectIdMap = new Map<string, string>()
    let projectCounter = 1

    for (const project of projects) {
      const newId = `PJT-${String(projectCounter).padStart(5, '0')}`
      projectIdMap.set(project.id, newId)
      projectCounter++
    }

    // 프로젝트 ID 업데이트
    for (const [oldId, newId] of projectIdMap.entries()) {
      if (oldId !== newId) {
        // 외래키 제약조건을 일시적으로 비활성화
        await connection.query('SET FOREIGN_KEY_CHECKS = 0')

        // project_children의 project_id 업데이트
        await connection.query(
          'UPDATE project_children SET project_id = ? WHERE project_id = ?',
          [newId, oldId]
        )

        // projects의 id 업데이트
        await connection.query('UPDATE projects SET id = ? WHERE id = ?', [
          newId,
          oldId,
        ])

        // 외래키 제약조건 재활성화
        await connection.query('SET FOREIGN_KEY_CHECKS = 1')

        console.log(`✓ ${oldId} -> ${newId}`)
      }
    }

    console.log('\n기존 일감 ID 마이그레이션 시작...')

    // 모든 일감 조회
    const [allTasks] = await connection.query<any[]>(
      'SELECT id FROM project_children ORDER BY created_at ASC'
    )

    // 일감 ID 매핑 생성
    const taskIdMap = new Map<string, string>()
    let taskCounter = 1

    for (const task of allTasks) {
      const newId = `TASK-${String(taskCounter).padStart(5, '0')}`
      taskIdMap.set(task.id, newId)
      taskCounter++
    }

    // 일감 ID 업데이트
    for (const [oldId, newId] of taskIdMap.entries()) {
      if (oldId !== newId) {
        await connection.query('SET FOREIGN_KEY_CHECKS = 0')
        await connection.query('UPDATE project_children SET id = ? WHERE id = ?', [
          newId,
          oldId,
        ])
        await connection.query('SET FOREIGN_KEY_CHECKS = 1')
        console.log(`✓ ${oldId} -> ${newId}`)
      }
    }

    await connection.commit()
    console.log('\n✅ ID 마이그레이션 완료!')
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
    await migrateIds()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

