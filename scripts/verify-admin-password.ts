import { verifyLogin } from '../lib/accounts'

async function verifyAdminPassword() {
  console.log('=== Admin 계정 비밀번호 확인 ===\n')
  
  try {
    // 비밀번호 1234로 로그인 시도
    console.log('비밀번호 "1234"로 로그인 시도 중...')
    const account = await verifyLogin('admin', '1234')
    
    if (account) {
      console.log('✅ 로그인 성공!')
      console.log(`   계정 ID: ${account.id}`)
      console.log(`   사용자명: ${account.username}`)
      console.log(`   이름: ${account.name}`)
      console.log(`   권한: ${account.role}`)
      console.log('\n✅ Admin 계정의 비밀번호는 "1234"입니다.')
    } else {
      console.log('❌ 로그인 실패')
      console.log('   비밀번호가 "1234"가 아닙니다.')
      console.log('   기존 비밀번호가 유지되었거나 변경되었을 수 있습니다.')
    }
    
    process.exit(0)
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message)
    process.exit(1)
  }
}

verifyAdminPassword()
