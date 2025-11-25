import { getPool } from '../lib/db'

async function addTaskLinkColumns() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    console.log('='.repeat(80))
    console.log('일감 Link 컬럼 추가')
    console.log('='.repeat(80))
    console.log()

    // 1. gmp_records 테이블에 linked_task_id 컬럼 추가
    console.log('📊 gmp_records 테이블에 linked_task_id 컬럼 추가...')
    try {
      await connection.query(`
        ALTER TABLE gmp_records 
        ADD COLUMN linked_task_id VARCHAR(50) NULL,
        ADD INDEX idx_linked_task_id (linked_task_id)
      `)
      console.log('   ✅ gmp_records 테이블에 linked_task_id 컬럼 추가 완료!')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('   ℹ️  gmp_records 테이블의 linked_task_id 컬럼이 이미 존재합니다.')
      } else {
        throw error
      }
    }
    console.log()

    // 2. project_children 테이블에 linked_gmp_record_id 컬럼 추가
    console.log('📊 project_children 테이블에 linked_gmp_record_id 컬럼 추가...')
    try {
      await connection.query(`
        ALTER TABLE project_children 
        ADD COLUMN linked_gmp_record_id VARCHAR(50) NULL,
        ADD INDEX idx_linked_gmp_record_id (linked_gmp_record_id)
      `)
      console.log('   ✅ project_children 테이블에 linked_gmp_record_id 컬럼 추가 완료!')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('   ℹ️  project_children 테이블의 linked_gmp_record_id 컬럼이 이미 존재합니다.')
      } else {
        throw error
      }
    }
    console.log()

    console.log('='.repeat(80))
    console.log('✅ 일감 Link 컬럼 추가 완료!')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('❌ 컬럼 추가 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await addTaskLinkColumns()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

