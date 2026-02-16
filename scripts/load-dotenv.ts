/**
 * .env.local / .env 를 프로젝트 루트에서 로드합니다.
 * lib/db 등이 로드되기 **전에** 이 모듈을 import 해야 DB_PORT 등이 적용됩니다.
 * 사용: import './load-dotenv'  (스크립트 최상단, 다른 로컬 import 보다 먼저)
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const root = resolve(__dirname, '..')
for (const name of ['.env.local', '.env']) {
  const path = resolve(root, name)
  if (existsSync(path)) {
    const content = readFileSync(path, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const eq = trimmed.indexOf('=')
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim()
          const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
          if (key && process.env[key] === undefined) process.env[key] = value
        }
      }
    }
    break
  }
}
