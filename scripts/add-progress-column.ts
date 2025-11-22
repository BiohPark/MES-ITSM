import { getPool } from '../lib/db'

async function addProgressColumn() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('progress 컬럼 추가 중...')

    // project_children 테이블에 progress 컬럼 추가
    try {
      await connection.query(`
        ALTER TABLE project_children 
        ADD COLUMN progress INT NOT NULL DEFAULT 0
      `)
      console.log('✅ project_children 테이블에 progress 컬럼 추가 완료!')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ project_children 테이블의 progress 컬럼이 이미 존재합니다.')
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
    await addProgressColumn()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

