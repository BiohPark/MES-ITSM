import { initializeDatabase } from '../lib/db'

async function main() {
  try {
    console.log('데이터베이스 초기화 중...')
    await initializeDatabase()
    console.log('데이터베이스 초기화 완료!')
    process.exit(0)
  } catch (error) {
    console.error('데이터베이스 초기화 실패:', error)
    process.exit(1)
  }
}

main()

