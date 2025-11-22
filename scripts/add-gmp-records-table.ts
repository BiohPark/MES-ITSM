import { initializeDatabase } from '../lib/db'

async function main() {
  try {
    console.log('GMP Records 테이블 생성 중...')
    await initializeDatabase()
    console.log('GMP Records 테이블 생성 완료!')
    console.log('gmp_records 테이블이 생성되었습니다.')
    process.exit(0)
  } catch (error) {
    console.error('GMP Records 테이블 생성 실패:', error)
    process.exit(1)
  }
}

main()

