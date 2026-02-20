/** DB 설정(.env.local) 적용 - getPool() 호출 전에 로드 */
import './load-dotenv'
import { getPool } from '../lib/db'

async function addMeetingStatusColumn() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('meeting_notes 테이블에 status 컬럼 추가 중...')

    try {
      await connection.query(`
        ALTER TABLE meeting_notes
        ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'final' AFTER decisions
      `)
      console.log('✅ status 컬럼 추가 완료!')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ status 컬럼이 이미 존재합니다.')
      } else {
        throw error
      }
    }

    await connection.commit()
    console.log('✅ meeting_notes 테이블 status 컬럼 마이그레이션 완료!')
  } catch (error) {
    await connection.rollback()
    console.error('❌ meeting_notes status 컬럼 마이그레이션 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await addMeetingStatusColumn()
    process.exit(0)
  } catch (error: any) {
    const isConnectionError =
      error?.code === 'ECONNREFUSED' ||
      error?.code === 'ETIMEDOUT' ||
      error?.message?.includes('connect')
    if (isConnectionError) {
      console.error('❌ DB(MySQL/MariaDB)에 연결할 수 없습니다.')
      console.error('   - MySQL 또는 MariaDB 서버가 실행 중인지 확인하세요. (기본 포트: 3306)')
      console.error('   - .env 또는 .env.local의 DB_HOST, DB_PORT, DB_USER 등 설정을 확인하세요.')
    } else {
      console.error('스크립트 실행 실패:', error)
    }
    process.exit(1)
  }
}

main()

