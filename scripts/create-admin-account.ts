/** DB 설정(.env.local)을 적용하려면 반드시 가장 먼저 import */
import './load-dotenv'
import { createAccount } from '../lib/accounts'

async function createAdminAccount() {
  try {
    const userId = await createAccount(
      'admin',
      '유승진',
      'seungjinwa@gmail.com',
      '1234',
      'admin'
    )
    console.log(`✅ 초기 Admin 계정 생성 완료!`)
    console.log(`   ID: ${userId}`)
    console.log(`   사용자명: admin`)
    console.log(`   비밀번호: 1234`)
    console.log(`   이름: 유승진`)
    console.log(`   이메일: seungjinwa@gmail.com`)
    console.log(`   권한: admin`)
    process.exit(0)
  } catch (error: any) {
    if (error.message.includes('이미 사용 중인 사용자명')) {
      console.log('ℹ️ admin 계정이 이미 존재합니다.')
      process.exit(0)
    } else {
      console.error('❌ Admin 계정 생성 실패:', error)
      process.exit(1)
    }
  }
}

createAdminAccount()

