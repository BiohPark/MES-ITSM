import { getPool } from '../lib/db'

async function addDescriptionColumn() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('description 컬럼 추가 중...')

    // description 컬럼 추가 (이미 존재하면 무시)
    try {
      await connection.query(`
        ALTER TABLE project_children 
        ADD COLUMN description TEXT NULL
      `)
      console.log('✅ description 컬럼 추가 완료!')
    } catch (error: any) {
      // 컬럼이 이미 존재하는 경우 무시
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ description 컬럼이 이미 존재합니다.')
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
    await addDescriptionColumn()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

