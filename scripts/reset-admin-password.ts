/**
 * admin 계정 비밀번호를 1234로 재설정합니다.
 * 로그인이 안 될 때(해시 불일치·손상 등) 실행하세요.
 * 사용: npx tsx scripts/reset-admin-password.ts  또는  npm run reset-admin-password
 */
import './load-dotenv'
import { getPool } from '../lib/db'
import { hashPassword } from '../lib/password'

async function resetAdminPassword() {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    'SELECT id, username FROM users WHERE username = ?',
    ['admin']
  )
  if (rows.length === 0) {
    console.log('❌ admin 계정이 없습니다. 먼저 npm run create-admin 를 실행하세요.')
    process.exit(1)
  }
  const hashed = await hashPassword('1234')
  await pool.query('UPDATE users SET password = ? WHERE username = ?', [
    hashed,
    'admin',
  ])
  console.log('✅ admin 계정 비밀번호가 "1234"로 재설정되었습니다.')
  process.exit(0)
}

resetAdminPassword().catch((err: any) => {
  console.error('❌ 오류:', err?.message ?? err)
  if (err?.code === 'ECONNREFUSED') {
    console.error('\n💡 DB 연결이 거부되었습니다. 확인하세요:')
    console.error('   - MySQL/MariaDB가 실행 중인지')
    console.error('   - .env.local 의 DB_HOST, DB_PORT(현재:', process.env.DB_PORT || '3306', ')가 실제 DB와 일치하는지')
  }
  process.exit(1)
})
