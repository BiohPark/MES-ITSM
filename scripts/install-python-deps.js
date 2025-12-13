#!/usr/bin/env node

/**
 * Python 의존성 설치 스크립트
 * npm install 시 자동으로 Python 환경을 설정합니다.
 */

const { execSync, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const isWindows = process.platform === 'win32'
const pythonCmd = isWindows ? 'python' : 'python3'
const pipCmd = isWindows ? 'python -m pip' : 'python3 -m pip'

function checkPythonInstalled() {
  try {
    const version = execSync(`${pythonCmd} --version`, { encoding: 'utf-8', stdio: 'pipe' })
    console.log(`✅ Python 발견: ${version.trim()}`)
    return true
  } catch (error) {
    console.warn('⚠️  Python이 설치되어 있지 않습니다.')
    console.warn('   Python 파일들은 참고용이며, 실제 프로젝트는 Next.js로 실행됩니다.')
    return false
  }
}

function checkPipInstalled() {
  try {
    const version = execSync(`${pipCmd} --version`, { encoding: 'utf-8', stdio: 'pipe' })
    console.log(`✅ pip 발견: ${version.trim().split('\n')[0]}`)
    return true
  } catch (error) {
    console.warn('⚠️  pip이 설치되어 있지 않습니다.')
    return false
  }
}

function installPythonDependencies() {
  const requirementsPath = path.join(__dirname, '..', 'requirements.txt')
  
  if (!fs.existsSync(requirementsPath)) {
    console.warn('⚠️  requirements.txt 파일을 찾을 수 없습니다.')
    return false
  }

  try {
    console.log('\n📦 Python 패키지 설치 중...')
    console.log(`   실행: ${pipCmd} install -r requirements.txt`)
    
    execSync(`${pipCmd} install -r requirements.txt`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    })
    
    console.log('✅ Python 패키지 설치 완료!')
    return true
  } catch (error) {
    console.warn('⚠️  Python 패키지 설치 실패:', error.message)
    console.warn('   Python 파일들은 참고용이며, 실제 프로젝트는 Next.js로 실행됩니다.')
    return false
  }
}

function main() {
  console.log('\n🐍 Python 환경 확인 중...\n')
  
  const hasPython = checkPythonInstalled()
  if (!hasPython) {
    console.log('\n💡 Python이 필요하지 않습니다. 이 프로젝트는 Next.js로 실행됩니다.')
    console.log('   Python 파일들(workflow_engine/*.py)은 참고용입니다.\n')
    return
  }

  const hasPip = checkPipInstalled()
  if (!hasPip) {
    console.warn('\n⚠️  pip이 없어 Python 패키지를 설치할 수 없습니다.')
    console.warn('   Python 파일들은 참고용이며, 실제 프로젝트는 Next.js로 실행됩니다.\n')
    return
  }

  installPythonDependencies()
  console.log('')
}

// 스크립트가 직접 실행될 때만 실행
if (require.main === module) {
  main()
}

module.exports = { main, checkPythonInstalled, checkPipInstalled, installPythonDependencies }

