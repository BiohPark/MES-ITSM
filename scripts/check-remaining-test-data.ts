import { getPool } from '../lib/db'

// 남은 테스트 데이터 확인 스크립트
async function checkRemainingTestData() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    console.log('🔍 남은 테스트 데이터 확인 중...\n')

    // 테스트 프로젝트 확인
    const [testProjects] = await connection.query<any[]>(
      `SELECT COUNT(*) as count FROM projects WHERE name LIKE '테스트 프로젝트%'`
    )
    const projectCount = testProjects[0]?.count || 0
    console.log(`📦 테스트 프로젝트: ${projectCount}개`)

    // 테스트 일감 확인
    const [testTasks] = await connection.query<any[]>(
      `SELECT COUNT(*) as count FROM project_children WHERE title LIKE '테스트 일감%'`
    )
    const taskCount = testTasks[0]?.count || 0
    console.log(`📋 테스트 일감: ${taskCount}개`)

    // 테스트 GMP Record 확인
    const [testGmp] = await connection.query<any[]>(
      `SELECT COUNT(*) as count FROM gmp_records WHERE title LIKE '테스트 GMP Record%'`
    )
    const gmpCount = testGmp[0]?.count || 0
    console.log(`📝 테스트 GMP Record: ${gmpCount}개`)

    const total = projectCount + taskCount + gmpCount
    console.log(`\n📊 총 남은 테스트 데이터: ${total}개`)

    if (total > 0) {
      console.log('\n⚠️  일부 테스트 데이터가 남아있습니다.')
      
      // 남은 일감이 있으면 삭제
      if (taskCount > 0) {
        console.log('\n🧹 남은 테스트 일감 삭제 중...')
        const [deleted] = await connection.query<any[]>(
          `DELETE FROM project_children WHERE title LIKE '테스트 일감%'`
        )
        const deletedCount = (deleted as any).affectedRows || 0
        console.log(`   ✅ ${deletedCount}개 일감 삭제 완료`)
      }
    } else {
      console.log('\n✅ 모든 테스트 데이터가 삭제되었습니다!')
    }
  } catch (error) {
    console.error('❌ 확인 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await checkRemainingTestData()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

