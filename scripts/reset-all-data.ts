import { getPool } from '../lib/db'

async function resetAllData() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('🗑️  모든 데이터 삭제 중...\n')

    // 외래 키 제약 조건을 일시적으로 비활성화
    await connection.query('SET FOREIGN_KEY_CHECKS = 0')

    // 1. comments 테이블 삭제
    console.log('📊 comments 테이블 데이터 삭제...')
    await connection.query('DELETE FROM comments')
    console.log('   ✅ comments 데이터 삭제 완료')

    // 2. issues 테이블 삭제
    console.log('\n📊 issues 테이블 데이터 삭제...')
    await connection.query('DELETE FROM issues')
    console.log('   ✅ issues 데이터 삭제 완료')

    // 3. gmp_records 테이블 삭제
    console.log('\n📊 gmp_records 테이블 데이터 삭제...')
    await connection.query('DELETE FROM gmp_records')
    console.log('   ✅ gmp_records 데이터 삭제 완료')

    // 4. project_children 테이블 삭제
    console.log('\n📊 project_children 테이블 데이터 삭제...')
    await connection.query('DELETE FROM project_children')
    console.log('   ✅ project_children 데이터 삭제 완료')

    // 5. projects 테이블 삭제
    console.log('\n📊 projects 테이블 데이터 삭제...')
    await connection.query('DELETE FROM projects')
    console.log('   ✅ projects 데이터 삭제 완료')

    // 외래 키 제약 조건 재활성화
    await connection.query('SET FOREIGN_KEY_CHECKS = 1')

    await connection.commit()
    console.log('\n🎉 모든 데이터 삭제 완료!')
    console.log('\n📋 삭제된 데이터:')
    console.log('   - Projects')
    console.log('   - Project Children (일감)')
    console.log('   - GMP Records')
    console.log('   - Issues')
    console.log('   - Comments')
  } catch (error) {
    await connection.rollback()
    console.error('❌ 데이터 삭제 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await resetAllData()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

