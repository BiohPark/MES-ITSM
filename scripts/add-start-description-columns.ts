import { getPool } from '../lib/db'

async function addColumns() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('컬럼 추가 중...')

    // projects 테이블에 start, description 컬럼 추가
    try {
      await connection.query(`
        ALTER TABLE projects 
        ADD COLUMN start DATE NULL,
        ADD COLUMN description TEXT NULL
      `)
      console.log('✅ projects 테이블에 start, description 컬럼 추가 완료!')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ projects 테이블의 일부 컬럼이 이미 존재합니다.')
      } else {
        throw error
      }
    }

    // project_children 테이블에 start 컬럼 추가 (description은 이미 있을 수 있음)
    try {
      await connection.query(`
        ALTER TABLE project_children 
        ADD COLUMN start DATE NULL
      `)
      console.log('✅ project_children 테이블에 start 컬럼 추가 완료!')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ project_children 테이블의 start 컬럼이 이미 존재합니다.')
      } else {
        throw error
      }
    }

    await connection.commit()
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
    await addColumns()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

