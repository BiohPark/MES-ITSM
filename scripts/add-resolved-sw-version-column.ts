import { getPool } from '../lib/db'

async function addResolvedSwVersionColumn() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('issues 테이블에 resolved_sw_version 컬럼 추가 중...')

    // resolved_sw_version 컬럼 추가 (이미 존재하면 무시)
    try {
      await connection.query(`
        ALTER TABLE issues 
        ADD COLUMN resolved_sw_version VARCHAR(100) NULL
      `)
      console.log('✅ issues 테이블에 resolved_sw_version 컬럼 추가 완료!')
    } catch (error: any) {
      // 컬럼이 이미 존재하는 경우 무시
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ resolved_sw_version 컬럼이 이미 존재합니다.')
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
    await addResolvedSwVersionColumn()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

