import { getPool } from '../lib/db'

// 일감 3단계(PI, PM, 개발) 컬럼 추가 스크립트
async function addTaskPhasesColumn() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('🔧 일감 3단계 컬럼 추가 시작...\n')

    // project_children 테이블에 phases 컬럼 추가 (JSON 형식)
    console.log('📊 project_children 테이블에 phases 컬럼 추가...')
    try {
      await connection.query(`
        ALTER TABLE project_children 
        ADD COLUMN phases JSON NULL 
        COMMENT 'PI, PM, 개발 3단계 정보 (JSON 형식)'
      `)
      console.log('   ✅ phases 컬럼 추가 완료')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('   ℹ️  phases 컬럼이 이미 존재합니다.')
      } else {
        throw error
      }
    }

    // gmp_records 테이블에도 phases 컬럼 추가
    console.log('\n📊 gmp_records 테이블에 phases 컬럼 추가...')
    try {
      await connection.query(`
        ALTER TABLE gmp_records 
        ADD COLUMN phases JSON NULL 
        COMMENT 'PI, PM, 개발 3단계 정보 (JSON 형식)'
      `)
      console.log('   ✅ phases 컬럼 추가 완료')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('   ℹ️  phases 컬럼이 이미 존재합니다.')
      } else {
        throw error
      }
    }

    await connection.commit()
    console.log('\n🎉 일감 3단계 컬럼 추가 완료!')
  } catch (error) {
    await connection.rollback()
    console.error('❌ 컬럼 추가 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await addTaskPhasesColumn()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

