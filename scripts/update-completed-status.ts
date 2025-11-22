import { getPool } from '../lib/db'

async function updateCompletedStatus() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('실적 진척도 100% 항목의 상태를 "Completed"로 업데이트 중...\n')

    // 1. 프로젝트 업데이트
    console.log('📋 프로젝트 업데이트 중...')
    const [projects] = await connection.query<any[]>(
      'SELECT id, name, status, progress FROM projects WHERE progress >= 100 AND status != "Completed"'
    )

    let projectUpdatedCount = 0
    for (const project of projects) {
      await connection.query(
        'UPDATE projects SET status = ? WHERE id = ?',
        ['Completed', project.id]
      )
      console.log(`  ✅ 프로젝트 "${project.name}" (ID: ${project.id}) 상태를 "Completed"로 변경 (진척도: ${project.progress}%)`)
      projectUpdatedCount++
    }
    console.log(`\n✅ 프로젝트 업데이트 완료: ${projectUpdatedCount}개 항목이 "Completed" 상태로 변경됨\n`)

    // 2. 일감(project_children) 업데이트
    console.log('📋 일감(project_children) 업데이트 중...')
    const [tasks] = await connection.query<any[]>(
      'SELECT id, title, status, progress FROM project_children WHERE progress >= 100 AND status != "Completed"'
    )

    let taskUpdatedCount = 0
    for (const task of tasks) {
      await connection.query(
        'UPDATE project_children SET status = ? WHERE id = ?',
        ['Completed', task.id]
      )
      console.log(`  ✅ 일감 "${task.title}" (ID: ${task.id}) 상태를 "Completed"로 변경 (진척도: ${task.progress}%)`)
      taskUpdatedCount++
    }
    console.log(`\n✅ 일감 업데이트 완료: ${taskUpdatedCount}개 항목이 "Completed" 상태로 변경됨\n`)

    // 3. GMP Record 업데이트
    console.log('📋 GMP Record 업데이트 중...')
    const [gmpRecords] = await connection.query<any[]>(
      'SELECT id, title, status, progress FROM gmp_records WHERE progress >= 100 AND status != "Completed"'
    )

    let gmpUpdatedCount = 0
    for (const record of gmpRecords) {
      await connection.query(
        'UPDATE gmp_records SET status = ? WHERE id = ?',
        ['Completed', record.id]
      )
      console.log(`  ✅ GMP Record "${record.title}" (ID: ${record.id}) 상태를 "Completed"로 변경 (진척도: ${record.progress}%)`)
      gmpUpdatedCount++
    }
    console.log(`\n✅ GMP Record 업데이트 완료: ${gmpUpdatedCount}개 항목이 "Completed" 상태로 변경됨\n`)

    await connection.commit()
    console.log(`🎉 완료! 총 ${projectUpdatedCount + taskUpdatedCount + gmpUpdatedCount}개 항목이 "Completed" 상태로 업데이트되었습니다.`)
  } catch (error) {
    await connection.rollback()
    console.error('❌ 업데이트 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await updateCompletedStatus()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

