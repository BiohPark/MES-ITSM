import { getPool } from '../lib/db'

async function checkAdminPassword() {
  const pool = getPool()
  
  try {
    console.log('='.repeat(80))
    console.log('admin 계정 비밀번호 정보 확인')
    console.log('='.repeat(80))
    console.log()

    const [accounts] = await pool.query<any[]>(
      `SELECT id, username, name, email, password, role, created_at 
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
    console.log(`  생성일: ${admin.created_at ? new Date(admin.created_at).toISOString() : '(없음)'}`)
    console.log()
    
    if (admin.password) {
      console.log('🔐 비밀번호 정보:')
      console.log('-'.repeat(80))
      console.log(`  해싱된 비밀번호: ${admin.password.substring(0, 20)}... (일부만 표시)`)
      console.log(`  비밀번호 길이: ${admin.password.length} 문자`)
      console.log()
      console.log('⚠️  중요:')
      console.log('  - 비밀번호는 bcrypt로 해싱되어 저장되어 있습니다.')
      console.log('  - 해싱된 비밀번호는 원본으로 복구할 수 없습니다.')
      console.log('  - 비밀번호를 잊으셨다면 비밀번호 리셋 기능을 사용하세요.')
      console.log('  - 또는 새 비밀번호로 변경할 수 있습니다.')
    } else {
      console.log('⚠️  비밀번호가 설정되어 있지 않습니다.')
    }
    console.log()

    console.log('='.repeat(80))
    console.log('확인 완료!')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('❌ 확인 실패:', error)
    throw error
  } finally {
    await pool.end()
  }
}

async function main() {
  try {
    await checkAdminPassword()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()


