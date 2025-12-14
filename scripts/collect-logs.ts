import { writeFile } from 'fs/promises'
import { join } from 'path'

/**
 * 로그 수집 스크립트
 * 서버 콘솔에서 출력된 로그를 파일로 저장하는 데 사용
 * 
 * 사용법:
 * 1. 서버 콘솔의 로그를 복사하여 logs.txt 파일에 저장
 * 2. 또는 이 스크립트를 실행하여 로그를 분석
 */

interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  message: string
  details?: any
}

async function analyzeLogs() {
  console.log('로그 분석을 시작합니다...')
  console.log('서버 콘솔에서 다음 정보를 확인해주세요:')
  console.log('')
  console.log('1. Middleware - Session verified:')
  console.log('   - userId, role, username 확인')
  console.log('')
  console.log('2. Projects API - Request headers:')
  console.log('   - userRole, userId 확인')
  console.log('')
  console.log('3. Error in getProjects:')
  console.log('   - Error code 확인')
  console.log('   - Error message 확인')
  console.log('   - Error stack 확인')
  console.log('')
  console.log('4. Database connection test:')
  console.log('   - 연결 테스트 성공/실패 여부')
  console.log('')
  console.log('로그를 파일로 저장하려면 서버 콘솔의 출력을 복사하여')
  console.log('프로젝트 루트에 logs.txt 파일로 저장하세요.')
}

analyzeLogs().catch(console.error)

