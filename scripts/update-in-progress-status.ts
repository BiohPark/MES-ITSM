import { getPool } from '../lib/db'

// "In progress"를 "In Progress"로 변경하는 스크립트
async function updateInProgressStatus() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('🔄 상태 업데이트 시작: "In progress" → "In Progress"\n')

    // 1. projects 테이블 업데이트
    console.log('📦 projects 테이블 업데이트 중...')
    const [updatedProjects] = await connection.query<any[]>(
      `UPDATE projects SET status = 'In Progress' WHERE status = 'In progress'`
    )
    const projectCount = (updatedProjects as any).affectedRows || 0
    console.log(`   ✅ ${projectCount}개 프로젝트 업데이트 완료`)

    // 2. project_children 테이블 업데이트
    console.log('\n📋 project_children 테이블 업데이트 중...')
    const [updatedTasks] = await connection.query<any[]>(
      `UPDATE project_children SET status = 'In Progress' WHERE status = 'In progress'`
    )
    const taskCount = (updatedTasks as any).affectedRows || 0
    console.log(`   ✅ ${taskCount}개 일감 업데이트 완료`)

    // 3. gmp_records 테이블 업데이트
    console.log('\n📝 gmp_records 테이블 업데이트 중...')
    const [updatedGmp] = await connection.query<any[]>(
      `UPDATE gmp_records SET status = 'In Progress' WHERE status = 'In progress'`
    )
    const gmpCount = (updatedGmp as any).affectedRows || 0
    console.log(`   ✅ ${gmpCount}개 GMP Record 업데이트 완료`)

    await connection.commit()

    console.log('\n🎉 상태 업데이트 완료!')
    console.log(`\n📊 업데이트된 데이터 요약:`)
    console.log(`   - 프로젝트: ${projectCount}개`)
    console.log(`   - 일감: ${taskCount}개`)
    console.log(`   - GMP Record: ${gmpCount}개`)
    console.log(`   - 총 업데이트: ${projectCount + taskCount + gmpCount}개`)
  } catch (error) {
    await connection.rollback()
    console.error('❌ 상태 업데이트 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await updateInProgressStatus()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

