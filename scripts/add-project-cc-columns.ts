import { getPool } from '../lib/db'

async function addProjectCcColumns() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('projects 테이블에 CC 관련 컬럼 추가 중...')

    // has_cc 컬럼 추가 (현업 CC 존재 여부)
    try {
      await connection.query(`
        ALTER TABLE projects 
        ADD COLUMN has_cc BOOLEAN DEFAULT FALSE
      `)
      console.log('✅ has_cc 컬럼 추가 완료!')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ has_cc 컬럼이 이미 존재합니다.')
      } else {
        throw error
      }
    }

    // cc_number 컬럼 추가 (CC 번호)
    try {
      await connection.query(`
        ALTER TABLE projects 
        ADD COLUMN cc_number VARCHAR(50) NULL
      `)
      console.log('✅ cc_number 컬럼 추가 완료!')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ cc_number 컬럼이 이미 존재합니다.')
      } else {
        throw error
      }
    }

    console.log('✅ projects 테이블에 CC 관련 컬럼 추가 완료!')

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
    await addProjectCcColumns()
    process.exit(0)
  } catch (error) {
    console.error('데이터베이스 마이그레이션 실패:', error)
    process.exit(1)
  }
}

main()

