import { getPool } from '../lib/db'

async function migrateNullProject() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('데이터베이스 스키마 업데이트 중...')

    // 외래키 제약조건 제거
    await connection.query('SET FOREIGN_KEY_CHECKS = 0')
    
    // project_id를 NULL 허용으로 변경
    await connection.query(`
      ALTER TABLE project_children 
      MODIFY COLUMN project_id VARCHAR(50) NULL
    `)

    // 외래키 제약조건 재추가 (NULL 허용)
    try {
      await connection.query(`
        ALTER TABLE project_children 
        DROP FOREIGN KEY project_children_ibfk_1
      `)
    } catch (error: any) {
      // 외래키가 없을 수 있음
      if (!error.message.includes("doesn't exist")) {
        throw error
      }
    }

    await connection.query(`
      ALTER TABLE project_children 
      ADD CONSTRAINT project_children_ibfk_1 
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    `)

    await connection.query('SET FOREIGN_KEY_CHECKS = 1')

    await connection.commit()
    console.log('✅ 데이터베이스 스키마 업데이트 완료!')
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
    await migrateNullProject()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

