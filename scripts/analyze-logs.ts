/**
 * 로그 분석 스크립트
 * PIM 매니저 권한 관련 문제 분석
 */

interface LogAnalysis {
  issue: string
  possibleCauses: string[]
  solutions: string[]
}

const commonIssues: LogAnalysis[] = [
  {
    issue: 'PIM 매니저 권한에서만 500 에러 발생',
    possibleCauses: [
      '세션 토큰에 권한 정보가 제대로 포함되지 않음',
      'middleware에서 세션 검증 실패',
      '데이터베이스 연결 풀 문제',
      '특정 권한에 대한 데이터베이스 접근 권한 문제',
      'JWT 토큰 검증 실패',
    ],
    solutions: [
      '서버 콘솔에서 "Middleware - Session verified" 로그 확인',
      '"JWT 검증 성공" 로그에서 role 값 확인',
      '"Projects API - Request headers" 로그에서 userRole 값 확인',
      '"Error in getProjects" 로그에서 에러 코드 및 메시지 확인',
      '데이터베이스 연결 테스트 결과 확인',
    ],
  },
  {
    issue: '데이터베이스 연결 실패',
    possibleCauses: [
      '데이터베이스 서버가 실행되지 않음',
      '연결 풀이 특정 권한에서만 실패',
      '타임아웃 발생',
      '연결 풀 리소스 부족',
    ],
    solutions: [
      'MySQL 서버 상태 확인',
      '연결 풀 재생성 로그 확인',
      'testConnection 함수의 재시도 로그 확인',
      '데이터베이스 연결 설정 확인 (.env.local)',
    ],
  },
  {
    issue: '세션 검증 실패',
    possibleCauses: [
      'JWT 토큰 만료',
      'JWT 시크릿 키 불일치',
      '세션 토큰에 권한 정보 누락',
      '토큰 파싱 오류',
    ],
    solutions: [
      '"JWT 검증 실패" 로그 확인',
      '세션 토큰 생성 시 role 값 확인',
      'JWT_SECRET 환경 변수 확인',
      '쿠키 설정 확인',
    ],
  },
]

function analyzeLogs(logContent?: string) {
  console.log('='.repeat(80))
  console.log('로그 분석 가이드')
  console.log('='.repeat(80))
  console.log('')

  if (logContent) {
    console.log('제공된 로그 분석:')
    console.log('-'.repeat(80))
    
    // 에러 패턴 검색
    const errorPatterns = [
      /Error in getProjects/gi,
      /Error code:/gi,
      /Error message:/gi,
      /Database connection test failed/gi,
      /JWT 검증 실패/gi,
      /Middleware - Session verified/gi,
      /Projects API - Request headers/gi,
    ]

    const foundErrors: string[] = []
    errorPatterns.forEach((pattern, index) => {
      const matches = logContent.match(pattern)
      if (matches) {
        foundErrors.push(`패턴 ${index + 1} 발견: ${matches.length}회`)
      }
    })

    if (foundErrors.length > 0) {
      console.log('발견된 에러 패턴:')
      foundErrors.forEach(err => console.log(`  - ${err}`))
    } else {
      console.log('에러 패턴이 발견되지 않았습니다.')
    }
    console.log('')
  }

  console.log('일반적인 문제점 및 해결 방법:')
  console.log('')
  
  commonIssues.forEach((issue, index) => {
    console.log(`${index + 1}. ${issue.issue}`)
    console.log('   가능한 원인:')
    issue.possibleCauses.forEach(cause => {
      console.log(`     - ${cause}`)
    })
    console.log('   해결 방법:')
    issue.solutions.forEach(solution => {
      console.log(`     - ${solution}`)
    })
    console.log('')
  })

  console.log('='.repeat(80))
  console.log('로그 수집 방법:')
  console.log('='.repeat(80))
  console.log('')
  console.log('1. 개발 서버 콘솔에서 다음 로그를 복사:')
  console.log('   - Middleware - Session verified:')
  console.log('   - Projects API - Request headers:')
  console.log('   - Error in getProjects:')
  console.log('   - Database connection test:')
  console.log('')
  console.log('2. 복사한 로그를 logs.txt 파일로 저장')
  console.log('')
  console.log('3. 다음 명령어로 분석:')
  console.log('   npm run analyze-logs')
  console.log('')
}

// 명령줄 인자로 로그 파일 경로를 받을 수 있음
const logFile = process.argv[2]

if (logFile) {
  const fs = require('fs')
  const path = require('path')
  try {
    const logContent = fs.readFileSync(logFile, 'utf-8')
    analyzeLogs(logContent)
  } catch (error) {
    console.error('로그 파일을 읽을 수 없습니다:', error)
    analyzeLogs()
  }
} else {
  analyzeLogs()
}

