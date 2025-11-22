import { getPool } from '../lib/db'
import { hashPassword } from '../lib/password'

async function resetAdminPassword() {
  const pool = getPool()
  
  try {
    const newPassword = 'Samsung1!'
    
    console.log('='.repeat(80))
    console.log('admin 계정 비밀번호 리셋')
    console.log('='.repeat(80))
    console.log()

    // admin 계정 확인
    const [accounts] = await pool.query<any[]>(
      `SELECT id, username, name, email, role 
       FROM users 
       WHERE username = 'admin'`
    )

    if (accounts.length === 0) {
      console.log('❌ admin 계정을 찾을 수 없습니다.')
      return
    }

    const admin = accounts[0]
    
    console.log('📋 admin 계정 정보:')
    console.log('-'.repeat(80))
    console.log(`  계정 ID: ${admin.id}`)
    console.log(`  사용자명: ${admin.username}`)
    console.log(`  이름: ${admin.name}`)
    console.log(`  이메일: ${admin.email || '(없음)'}`)
    console.log(`  권한: ${admin.role}`)
    console.log()

    // 비밀번호 해싱
    console.log('🔐 비밀번호 해싱 중...')
    const hashedPassword = await hashPassword(newPassword)
    console.log('✅ 비밀번호 해싱 완료')
    console.log()

    // 비밀번호 업데이트
    console.log('💾 데이터베이스 업데이트 중...')
    await pool.query(
      'UPDATE users SET password = ? WHERE username = ?',
      [hashedPassword, 'admin']
    )
    console.log('✅ 비밀번호 업데이트 완료')
    console.log()

    console.log('='.repeat(80))
    console.log('✅ admin 계정 비밀번호가 성공적으로 리셋되었습니다!')
    console.log('='.repeat(80))
    console.log()
    console.log('📝 새로운 로그인 정보:')
    console.log('-'.repeat(80))
    console.log(`  사용자명: admin`)
    console.log(`  비밀번호: ${newPassword}`)
    console.log()

  } catch (error) {
    console.error('❌ 비밀번호 리셋 실패:', error)
    throw error
  } finally {
    await pool.end()
  }
}

async function main() {
  try {
    await resetAdminPassword()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()


