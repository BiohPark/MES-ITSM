import { getPool } from '../lib/db'
import { getUsers } from '../lib/users'

async function listUsers() {
  const pool = getPool()
  
  try {
    console.log('='.repeat(80))
    console.log('등록된 사용자 정보 조회')
    console.log('='.repeat(80))
    console.log()

    // 1. users 테이블 전체 조회
    console.log('📋 [users 테이블] 전체 사용자 목록:')
    console.log('-'.repeat(80))
    
    const [allUsers] = await pool.query<any[]>(
      `SELECT * FROM users ORDER BY created_at DESC`
    )
    
    if (allUsers.length === 0) {
      console.log('  등록된 사용자가 없습니다.')
    } else {
      allUsers.forEach((user: any, index: number) => {
        console.log(`  ${index + 1}. ID: ${user.id}`)
        console.log(`     이름: ${user.name || '(없음)'}`)
        console.log(`     사용자명: ${user.username || '(없음)'}`)
        console.log(`     이메일: ${user.email || '(없음)'}`)
        console.log(`     권한: ${user.role || '(없음)'}`)
        console.log(`     생성일: ${user.created_at ? new Date(user.created_at).toISOString() : '(없음)'}`)
        console.log(`     수정일: ${user.updated_at ? new Date(user.updated_at).toISOString() : '(없음)'}`)
        console.log()
      })
    }
    console.log()

    // 2. 인증 계정만 조회 (username이 있는 경우)
    console.log('🔐 [인증 계정] 로그인 가능한 계정:')
    console.log('-'.repeat(80))
    
    const [accounts] = await pool.query<any[]>(
      `SELECT id, username, name, email, role, created_at, updated_at 
       FROM users 
       WHERE username IS NOT NULL AND username != ''
       ORDER BY created_at DESC`
    )

    if (accounts.length === 0) {
      console.log('  등록된 인증 계정이 없습니다.')
    } else {
      accounts.forEach((account: any, index: number) => {
        console.log(`  ${index + 1}. 계정 ID: ${account.id}`)
        console.log(`     사용자명: ${account.username}`)
        console.log(`     이름: ${account.name || '(없음)'}`)
        console.log(`     이메일: ${account.email || '(없음)'}`)
        console.log(`     권한: ${account.role || 'user'}`)
        console.log(`     생성일: ${account.created_at ? new Date(account.created_at).toISOString() : '(없음)'}`)
        console.log(`     수정일: ${account.updated_at ? new Date(account.updated_at).toISOString() : '(없음)'}`)
        console.log()
      })
    }
    console.log()

    // 3. 통계
    const [userCount] = await pool.query<any[]>(
      'SELECT COUNT(*) as count FROM users'
    )
    const [accountCount] = await pool.query<any[]>(
      'SELECT COUNT(*) as count FROM users WHERE username IS NOT NULL AND username != ""'
    )

    console.log('📊 통계:')
    console.log('-'.repeat(80))
    console.log(`  전체 사용자 수: ${userCount[0]?.count || 0}명`)
    console.log(`  인증 계정 수: ${accountCount[0]?.count || 0}명`)
    console.log()

    console.log('='.repeat(80))
    console.log('조회 완료!')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('❌ 사용자 조회 실패:', error)
    throw error
  } finally {
    await pool.end()
  }
}

async function main() {
  try {
    await listUsers()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

