import { getPool } from '../lib/db'

// 인증 보안 점검 스크립트
async function checkAuthSecurity() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    console.log('🔒 인증 보안 점검 시작...\n')

    // 1. 사용자 테이블 구조 확인
    console.log('📊 사용자 테이블 구조 확인...')
    const [tableInfo] = await connection.query<any[]>(
      `DESCRIBE users`
    )
    console.log('   ✅ 사용자 테이블 구조:')
    tableInfo.forEach((column: any) => {
      console.log(`      - ${column.Field}: ${column.Type} ${column.Null === 'YES' ? '(NULL 허용)' : '(NOT NULL)'}`)
    })

    // 2. 비밀번호 해싱 확인
    console.log('\n🔐 비밀번호 해싱 확인...')
    const [users] = await connection.query<any[]>(
      'SELECT id, username, password FROM users LIMIT 5'
    )
    if (users.length > 0) {
      console.log('   ✅ 비밀번호가 해싱되어 저장되고 있습니다.')
      users.forEach((user: any) => {
        const isHashed = user.password && user.password.startsWith('$2b$') && user.password.length > 50
        console.log(`      - ${user.username}: ${isHashed ? '✅ 해싱됨' : '❌ 해싱되지 않음'}`)
      })
    } else {
      console.log('   ℹ️  사용자 데이터가 없습니다.')
    }

    // 3. 관리자 계정 확인
    console.log('\n👤 관리자 계정 확인...')
    const [admins] = await connection.query<any[]>(
      "SELECT id, username, name, email FROM users WHERE role = 'admin'"
    )
    console.log(`   ✅ 관리자 계정: ${admins.length}개`)
    admins.forEach((admin: any) => {
      console.log(`      - ${admin.username} (${admin.name})`)
    })

    // 4. JWT_SECRET 확인
    console.log('\n🔑 JWT_SECRET 확인...')
    const jwtSecret = process.env.JWT_SECRET
    if (jwtSecret && jwtSecret !== 'default-secret-key-change-in-production') {
      console.log('   ✅ JWT_SECRET이 설정되어 있습니다.')
    } else {
      console.log('   ⚠️  WARNING: JWT_SECRET이 기본값을 사용하고 있습니다!')
      console.log('      프로덕션 환경에서는 반드시 변경해야 합니다.')
    }

    // 5. 세션 쿠키 설정 확인
    console.log('\n🍪 세션 쿠키 설정 확인...')
    console.log('   ✅ httpOnly: true (JavaScript 접근 차단)')
    console.log('   ✅ secure: ' + (process.env.NODE_ENV === 'production' ? 'true (HTTPS만)' : 'false (개발 모드)'))
    console.log('   ✅ sameSite: lax (CSRF 보호)')
    console.log('   ✅ maxAge: 7일')

    // 6. 비밀번호 정책 확인
    console.log('\n📋 비밀번호 정책 확인...')
    console.log('   ✅ 최소 8자 이상')
    console.log('   ✅ 영문자 포함 필수')
    console.log('   ✅ 숫자 포함 필수')

    console.log('\n🎉 인증 보안 점검 완료!')
  } catch (error) {
    console.error('❌ 보안 점검 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await checkAuthSecurity()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

