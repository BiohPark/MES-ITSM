import { getPool } from '../lib/db'

async function clearOwners() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('담당자 데이터 삭제 중...')

    // projects 테이블의 owner를 빈 문자열로 업데이트
    await connection.query(`
      UPDATE projects SET owner = ''
    `)
    console.log('✅ projects 테이블의 담당자 데이터 삭제 완료!')

    // project_children 테이블의 owner를 빈 문자열로 업데이트
    await connection.query(`
      UPDATE project_children SET owner = ''
    `)
    console.log('✅ project_children 테이블의 담당자 데이터 삭제 완료!')

    await connection.commit()
    console.log('✅ 모든 담당자 데이터 삭제 완료!')
  } catch (error) {
    await connection.rollback()
    console.error('❌ 담당자 데이터 삭제 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await clearOwners()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

