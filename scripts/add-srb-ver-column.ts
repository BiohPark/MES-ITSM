import { getPool } from '../lib/db'

async function addSrbVerColumn() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('projects 테이블에 srb_ver 컬럼 추가 중...')

    // srb_ver 컬럼 추가 (이미 존재하면 무시)
    try {
      await connection.query(`
        ALTER TABLE projects 
        ADD COLUMN srb_ver VARCHAR(50) NULL
      `)
      console.log('✅ projects 테이블에 srb_ver 컬럼 추가 완료!')
    } catch (error: any) {
      // 컬럼이 이미 존재하는 경우 무시
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ srb_ver 컬럼이 이미 존재합니다.')
      } else {
        throw error
      }
    }

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
    await addSrbVerColumn()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

