import { getPool } from '../lib/db'

async function addTaskIssueReasonColumn() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('project_children 테이블에 issue_reason 컬럼 추가 중...')

    // issue_reason 컬럼 추가 (Issue 상태 이유 및 해결 가이드)
    try {
      await connection.query(`
        ALTER TABLE project_children 
        ADD COLUMN issue_reason TEXT NULL
      `)
      console.log('✅ issue_reason 컬럼 추가 완료!')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ issue_reason 컬럼이 이미 존재합니다.')
      } else {
        throw error
      }
    }

    console.log('✅ project_children 테이블에 issue_reason 컬럼 추가 완료!')

    await connection.commit()
    console.log('✅ 마이그레이션 완료!')
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
    await addTaskIssueReasonColumn()
    process.exit(0)
  } catch (error) {
    console.error('데이터베이스 마이그레이션 실패:', error)
    process.exit(1)
  }
}

main()

