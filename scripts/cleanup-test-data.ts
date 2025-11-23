import { getPool } from '../lib/db'

// 테스트 데이터 삭제 스크립트
async function cleanupTestData() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('🧹 테스트 데이터 삭제 시작...\n')

    // 1. 테스트 프로젝트 삭제 (이름이 "테스트 프로젝트"로 시작하는 것들)
    console.log('📦 테스트 프로젝트 삭제 중...')
    const [deletedProjects] = await connection.query<any[]>(
      `DELETE FROM projects WHERE name LIKE '테스트 프로젝트%'`
    )
    const projectCount = (deletedProjects as any).affectedRows || 0
    console.log(`   ✅ ${projectCount}개 프로젝트 삭제 완료`)

    // 2. 테스트 일감 삭제 (이름이 "테스트 일감"으로 시작하는 것들)
    console.log('\n📋 테스트 일감 삭제 중...')
    const [deletedTasks] = await connection.query<any[]>(
      `DELETE FROM project_children WHERE title LIKE '테스트 일감%'`
    )
    const taskCount = (deletedTasks as any).affectedRows || 0
    console.log(`   ✅ ${taskCount}개 일감 삭제 완료`)

    // 3. 테스트 GMP Record 삭제 (이름이 "테스트 GMP Record"로 시작하는 것들)
    console.log('\n📝 테스트 GMP Record 삭제 중...')
    const [deletedGmp] = await connection.query<any[]>(
      `DELETE FROM gmp_records WHERE title LIKE '테스트 GMP Record%'`
    )
    const gmpCount = (deletedGmp as any).affectedRows || 0
    console.log(`   ✅ ${gmpCount}개 GMP Record 삭제 완료`)

    // 4. 고아 프로젝트 확인 (일감이 없는 프로젝트 중 테스트 프로젝트)
    console.log('\n🔍 고아 프로젝트 확인 중...')
    const [orphanProjects] = await connection.query<any[]>(
      `SELECT p.id FROM projects p 
       LEFT JOIN project_children pc ON p.id = pc.project_id 
       LEFT JOIN gmp_records gr ON p.id = gr.project_id 
       WHERE pc.id IS NULL AND gr.id IS NULL AND p.name LIKE '테스트 프로젝트%'`
    )
    if (orphanProjects.length > 0) {
      const orphanIds = orphanProjects.map((p: any) => p.id)
      const placeholders = orphanIds.map(() => '?').join(',')
      const [deletedOrphans] = await connection.query<any[]>(
        `DELETE FROM projects WHERE id IN (${placeholders})`,
        orphanIds
      )
      const orphanCount = (deletedOrphans as any).affectedRows || 0
      console.log(`   ✅ ${orphanCount}개 고아 프로젝트 삭제 완료`)
    } else {
      console.log('   ℹ️  고아 프로젝트 없음')
    }

    await connection.commit()

    console.log('\n🎉 테스트 데이터 삭제 완료!')
    console.log(`\n📊 삭제된 데이터 요약:`)
    console.log(`   - 프로젝트: ${projectCount}개`)
    console.log(`   - 일감: ${taskCount}개`)
    console.log(`   - GMP Record: ${gmpCount}개`)
    console.log(`   - 총 삭제: ${projectCount + taskCount + gmpCount}개`)
  } catch (error) {
    await connection.rollback()
    console.error('❌ 테스트 데이터 삭제 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await cleanupTestData()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

