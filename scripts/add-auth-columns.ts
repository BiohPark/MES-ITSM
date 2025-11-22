import { getPool } from '../lib/db'

async function addAuthColumns() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('users 테이블에 인증 관련 컬럼 추가 중...')

    // username 컬럼 추가 (로그인용)
    try {
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN username VARCHAR(50) UNIQUE NULL
      `)
      console.log('✅ users 테이블에 username 컬럼 추가 완료!')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ username 컬럼이 이미 존재합니다.')
      } else {
        throw error
      }
    }

    // password 컬럼 추가
    try {
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN password VARCHAR(255) NULL
      `)
      console.log('✅ users 테이블에 password 컬럼 추가 완료!')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ password 컬럼이 이미 존재합니다.')
      } else {
        throw error
      }
    }

    // role 컬럼 추가
    try {
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN role VARCHAR(20) DEFAULT 'user'
      `)
      console.log('✅ users 테이블에 role 컬럼 추가 완료!')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ role 컬럼이 이미 존재합니다.')
      } else {
        throw error
      }
    }

    // password_reset_token 컬럼 추가 (비밀번호 리셋용)
    try {
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN password_reset_token VARCHAR(255) NULL
      `)
      console.log('✅ users 테이블에 password_reset_token 컬럼 추가 완료!')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ password_reset_token 컬럼이 이미 존재합니다.')
      } else {
        throw error
      }
    }

    // password_reset_expires 컬럼 추가
    try {
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN password_reset_expires DATETIME NULL
      `)
      console.log('✅ users 테이블에 password_reset_expires 컬럼 추가 완료!')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ password_reset_expires 컬럼이 이미 존재합니다.')
      } else {
        throw error
      }
    }

    await connection.commit()
    console.log('✅ 인증 관련 컬럼 추가 완료!')
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
    await addAuthColumns()
    process.exit(0)
  } catch (error) {
    console.error('스크립트 실행 실패:', error)
    process.exit(1)
  }
}

main()

