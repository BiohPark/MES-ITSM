import { getPool } from '../lib/db'
import { verifyPassword } from '../lib/password'

async function verifyAdminPassword() {
  const pool = getPool()
  
  try {
    const testPassword = 'Samsung1!'
    
    console.log('='.repeat(80))
    console.log('admin 계정 비밀번호 검증')
    console.log('='.repeat(80))
    console.log()

    // admin 계정 조회
    const [accounts] = await pool.query<any[]>(
      `SELECT id, username, name, email, password, role 
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

    if (!admin.password) {
      console.log('⚠️  비밀번호가 설정되어 있지 않습니다.')
      return
    }

    console.log('🔐 비밀번호 검증 중...')
    console.log(`  테스트 비밀번호: ${testPassword}`)
    console.log()

    // 비밀번호 검증
    const isValid = await verifyPassword(testPassword, admin.password)
    
    if (isValid) {
      console.log('='.repeat(80))
      console.log('✅ 비밀번호 검증 성공!')
      console.log('='.repeat(80))
      console.log()
      console.log(`admin 계정의 비밀번호가 "${testPassword}"입니다.`)
    } else {
      console.log('='.repeat(80))
      console.log('❌ 비밀번호 검증 실패')
      console.log('='.repeat(80))
      console.log()
      console.log(`admin 계정의 비밀번호가 "${testPassword}"가 아닙니다.`)
    }
    console.log()

  } catch (error) {
    console.error('❌ 검증 실패:', error)
    throw error
  } finally {
    await pool.end()
  }
}

async function main() {
  try {
    await verifyAdminPassword()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

