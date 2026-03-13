#!/usr/bin/env node

/**
 * Standalone 빌드 패키징 스크립트
 * npm 접속 없이 배포 가능한 release 폴더를 생성합니다.
 */

const fs = require('fs')
const path = require('path')

const projectRoot = path.join(__dirname, '..')
const defaultReleaseDir = path.join(projectRoot, 'release')

function makeTimestamp() {
  const now = new Date()
  const yyyy = String(now.getFullYear())
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`
}

function prepareOutputDir(preferredDir) {
  try {
    if (fs.existsSync(preferredDir)) {
      fs.rmSync(preferredDir, { recursive: true })
    }
    fs.mkdirSync(preferredDir, { recursive: true })
    return preferredDir
  } catch (error) {
    if (error && (error.code === 'EPERM' || error.code === 'EBUSY')) {
      const fallbackDir = path.join(projectRoot, `release-${makeTimestamp()}`)
      console.warn(
        `⚠️  기존 release 폴더가 사용 중이어서 새 폴더로 생성합니다: ${path.basename(fallbackDir)}`
      )
      fs.mkdirSync(fallbackDir, { recursive: true })
      return fallbackDir
    }
    throw error
  }
}

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
  const releaseDir = prepareOutputDir(
    process.env.RELEASE_DIR
      ? path.resolve(projectRoot, process.env.RELEASE_DIR)
      : defaultReleaseDir
  )

  if (!fs.existsSync(standaloneDir)) {
    console.error('❌ .next/standalone 폴더를 찾을 수 없습니다.')
    console.error('   먼저 "npm run build"를 실행해 주세요.\n')
    process.exit(1)
  }

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

  // HTTPS 서버 스크립트 복사 (SSL 사용 시 server-https.js 실행)
  const releaseHttpsSrc = path.join(projectRoot, 'scripts', 'release-server-https.js')
  if (fs.existsSync(releaseHttpsSrc)) {
    fs.copyFileSync(releaseHttpsSrc, path.join(releaseDir, 'server-https.js'))
  }

  // 실행 가이드 파일 생성 (한국어)
  const readme = `# 오프라인/방화벽 환경 배포용 (npm 설치 불필요)

이 폴더는 npm 접속 없이 실행 가능한 독립 패키지입니다.
방화벽으로 외부 네트워크가 차단된 환경에서도 Node.js만 있으면 동작합니다.
엑셀 내보내기 같은 기능에 필요한 서버 런타임 의존성도 함께 포함됩니다.

## 실행 방법

1. Node.js가 설치되어 있어야 합니다. (npm은 필요 없음)
2. .env 파일을 생성하고 DB 연결 정보 등을 설정하세요.
   (.env.example을 .env로 복사 후 수정하세요)
3. 아래 명령으로 서버를 실행합니다:

   node server.js

기본 포트: 3000 (PORT 환경변수로 변경 가능)

## 접속 모드 (Development / Production)

- **상용(사내망)**: 기본값. 서버가 0.0.0.0 에서 수신하므로, 고정 IP 노트북에서 실행 시
  다른 PC에서 http://<고정IP>:3000 으로 접속 가능합니다.
- **개발(localhost만)**: 본 PC에서만 접속하려면 다음처럼 실행하세요.
  set HOSTNAME=127.0.0.1
  node server.js
  (Linux/Mac: HOSTNAME=127.0.0.1 node server.js)

## HTTPS (보안 강화)

SSL 인증서와 키 파일을 준비한 뒤:

  set SSL_CERT_PATH=./cert.pem
  set SSL_KEY_PATH=./key.pem
  node server-https.js

(Linux/Mac: SSL_CERT_PATH=./cert.pem SSL_KEY_PATH=./key.pem node server-https.js)

사내망 전체 수신: HOSTNAME=0.0.0.0 SSL_CERT_PATH=./cert.pem SSL_KEY_PATH=./key.pem node server-https.js
`
  fs.writeFileSync(path.join(releaseDir, '실행방법.txt'), readme, 'utf8')

  // English run guide for offline/firewall deployment
  const readmeEn = `# Offline / Firewall-Friendly Deployment (No npm Required)

This folder is a **standalone deployment package** that runs without any npm or network access.
Suitable for environments where the firewall blocks npm registry or external connections.

## Requirements

- **Node.js** only (npm is not required to run the app).
- MySQL database reachable from the deployment host.

## Quick Start

1. Copy \`.env.example\` to \`.env\` and set your database and app settings (e.g. \`DB_HOST\`, \`DB_USER\`, \`DB_PASSWORD\`, \`JWT_SECRET\`).
2. Start the server:

   \`\`\`bash
   node server.js
   \`\`\`

3. Open in browser: \`http://localhost:3000\` (or \`http://<this-machine-IP>:3000\` when listening on all interfaces).

Default port: **3000** (override with the \`PORT\` environment variable).

## Listening Modes

- **LAN / shared network**: By default the server binds to \`0.0.0.0\`, so other PCs can use \`http://<host-IP>:3000\`.
- **Local only**: To accept connections only from this machine:

  - Windows: \`set HOSTNAME=127.0.0.1\` then \`node server.js\`
  - Linux/macOS: \`HOSTNAME=127.0.0.1 node server.js\`

## HTTPS (Optional)

If you have SSL certificate and key files:

- Windows:
  \`\`\`bat
  set SSL_CERT_PATH=./cert.pem
  set SSL_KEY_PATH=./key.pem
  node server-https.js
  \`\`\`
- Linux/macOS:
  \`\`\`bash
  SSL_CERT_PATH=./cert.pem SSL_KEY_PATH=./key.pem node server-https.js
  \`\`\`

To listen on all interfaces with HTTPS:

\`\`\`bash
HOSTNAME=0.0.0.0 SSL_CERT_PATH=./cert.pem SSL_KEY_PATH=./key.pem node server-https.js
\`\`\`

## Contents of This Package

- **server.js** – Main Next.js standalone server (HTTP).
- **server-https.js** – HTTPS server wrapper when SSL is required.
- **.next/** – Built application and static assets.
- **public/** – Static files.
- **.env.example** – Example environment variables (copy to \`.env\` and edit).

This package already includes the minimal runtime dependencies required by the app, including server-side libraries used by features such as Excel export.
No additional \`npm install\` is needed on the target machine.
`
  fs.writeFileSync(path.join(releaseDir, 'README-OFFLINE.md'), readmeEn, 'utf8')

  console.log(`\n✅ ${path.basename(releaseDir)} 폴더 생성 완료!`)
  console.log('   npm 접속 없이 배포 가능합니다.')
  console.log(`   ${path.basename(releaseDir)} 폴더를 Git에 커밋하거나 압축하여 전달하세요.\n`)
}

main()
