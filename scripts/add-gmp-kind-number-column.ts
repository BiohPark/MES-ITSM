import { getPool } from '../lib/db'

async function addGmpKindNumberColumn() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('GMP Records 테이블에 kind_number 컬럼 추가 중...')

    // kind_number 컬럼 추가
    try {
      await connection.query(`
        ALTER TABLE gmp_records 
        ADD COLUMN kind_number VARCHAR(20) DEFAULT 'CC-00000'
      `)
      console.log('✅ gmp_records 테이블에 kind_number 컬럼 추가 완료!')
      
      // 기존 데이터에 대해 kind_number 값 업데이트
      const [records] = await connection.query<any[]>(
        'SELECT id, kind, number FROM gmp_records WHERE kind_number IS NULL OR kind_number = ""'
      )
      
      for (const record of records) {
        const kind = record.kind || 'CC'
        const number = record.number || 0
        const kindNumber = `${kind}-${String(number).padStart(5, '0')}`
        
        await connection.query(
          'UPDATE gmp_records SET kind_number = ? WHERE id = ?',
          [kindNumber, record.id]
        )
      }
      
      if (records.length > 0) {
        console.log(`✅ ${records.length}개의 기존 GMP Record에 kind_number 값 업데이트 완료!`)
      }
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ gmp_records 테이블의 kind_number 컬럼이 이미 존재합니다.')
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
    await addGmpKindNumberColumn()
    process.exit(0)
  } catch (error) {
    console.error('스크립트 실행 실패:', error)
    process.exit(1)
  }
}

main()

