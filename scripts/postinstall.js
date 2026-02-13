#!/usr/bin/env node

/**
 * postinstall: Python 의존성 확인 후 setup-db 실행.
 * 오프라인/방화벽 환경 또는 DB 미연결 시 실패해도 npm install은 성공하도록 처리.
 */
const { execSync } = require('child_process')
const path = require('path')

const root = path.join(__dirname, '..')

function run(name, fn) {
  try {
    fn()
    return true
  } catch (e) {
    console.warn(`[postinstall] ${name} 건너뜀:`, e.message || e)
    return false
  }
}

run('install-python-deps', () => {
  require('./install-python-deps.js').main()
})

run('setup-db', () => {
  execSync('npm run setup-db', { stdio: 'inherit', cwd: root })
})

process.exit(0)
