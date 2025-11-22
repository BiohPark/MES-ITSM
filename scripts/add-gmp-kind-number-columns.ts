import { getPool } from '../lib/db'

async function addGmpKindNumberColumns() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('GMP Records 테이블에 kind, number 컬럼 추가 중...')

    // kind 컬럼 추가
    try {
      await connection.query(`
        ALTER TABLE gmp_records 
        ADD COLUMN kind VARCHAR(10) DEFAULT 'CC'
      `)
      console.log('✅ gmp_records 테이블에 kind 컬럼 추가 완료!')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ gmp_records 테이블의 kind 컬럼이 이미 존재합니다.')
      } else {
        throw error
      }
    }

    // number 컬럼 추가
    try {
      await connection.query(`
        ALTER TABLE gmp_records 
        ADD COLUMN number INT DEFAULT 0
      `)
      console.log('✅ gmp_records 테이블에 number 컬럼 추가 완료!')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ gmp_records 테이블의 number 컬럼이 이미 존재합니다.')
      } else {
        throw error
      }
    }

    await connection.commit()
    console.log('✅ GMP Records 테이블 업데이트 완료!')
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
    await addGmpKindNumberColumns()
    process.exit(0)
  } catch (error) {
    console.error('스크립트 실행 실패:', error)
    process.exit(1)
  }
}

main()

