#!/usr/bin/env node

/**
 * Standalone 빌드 패키징 스크립트
 * npm 접속 없이 배포 가능한 release 폴더를 생성합니다.
 */

const fs = require('fs')
const path = require('path')

const projectRoot = path.join(__dirname, '..')
const releaseDir = path.join(projectRoot, 'release')

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`⚠️  경로가 없습니다: ${src}`)
    return
  }

  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true })
    }
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry))
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(src, dest)
  }
}

function main() {
  console.log('\n📦 Standalone 배포 패키지 생성 중...\n')

  const standaloneDir = path.join(projectRoot, '.next', 'standalone')
  const staticDir = path.join(projectRoot, '.next', 'static')
  const publicDir = path.join(projectRoot, 'public')

  if (!fs.existsSync(standaloneDir)) {
    console.error('❌ .next/standalone 폴더를 찾을 수 없습니다.')
    console.error('   먼저 "npm run build"를 실행해 주세요.\n')
    process.exit(1)
  }

  // release 폴더 초기화
  if (fs.existsSync(releaseDir)) {
    fs.rmSync(releaseDir, { recursive: true })
  }
  fs.mkdirSync(releaseDir, { recursive: true })

  // standalone 내용 복사
  console.log('   → .next/standalone 복사 중...')
  copyRecursive(standaloneDir, releaseDir)

  // .next/static 복사 (standalone/.next/static으로)
  const releaseStaticDir = path.join(releaseDir, '.next', 'static')
  if (fs.existsSync(staticDir)) {
    console.log('   → .next/static 복사 중...')
    copyRecursive(staticDir, releaseStaticDir)
  }

  // public 복사
  if (fs.existsSync(publicDir)) {
    console.log('   → public 복사 중...')
    copyRecursive(publicDir, path.join(releaseDir, 'public'))
  }

  // .env.example이 있으면 복사 (환경변수 설정 가이드용)
  const envExample = path.join(projectRoot, '.env.example')
  if (fs.existsSync(envExample)) {
    fs.copyFileSync(envExample, path.join(releaseDir, '.env.example'))
  }

  // 실행 가이드 파일 생성
  const readme = `# 오프라인 배포용 (npm 설치 불필요)

## 실행 방법

1. Node.js가 설치되어 있어야 합니다.
2. .env 파일을 생성하고 DB 연결 정보 등을 설정하세요.
   (.env.example을 .env로 복사 후 수정하세요)
3. 아래 명령으로 서버를 실행합니다:

   node server.js

기본 포트: 3000 (PORT 환경변수로 변경 가능)
`
  fs.writeFileSync(path.join(releaseDir, '실행방법.txt'), readme, 'utf8')

  console.log('\n✅ release 폴더 생성 완료!')
  console.log('   npm 접속 없이 배포 가능합니다.')
  console.log('   release 폴더를 Git에 커밋하거나 압축하여 전달하세요.\n')
}

main()
