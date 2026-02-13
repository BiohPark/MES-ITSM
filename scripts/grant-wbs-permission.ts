/**
 * 지정한 로그인 ID(username)에 WBS 수정 권한 부여
 * 사용: npx tsx scripts/grant-wbs-permission.ts [username]
 * 예: npx tsx scripts/grant-wbs-permission.ts seungjin
 */
import { getPool } from '../lib/db'

async function main() {
  const username = process.argv[2] || process.env.WBS_USER || 'seungjin'
  const pool = getPool()
  const conn = await pool.getConnection()

  try {
    const [cols]: any[] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'can_edit_wbs'`
    )
    if (cols.length === 0) {
      await conn.query(`
        ALTER TABLE users ADD COLUMN can_edit_wbs TINYINT(1) NOT NULL DEFAULT 0
      `)
      console.log('users.can_edit_wbs 컬럼 추가 완료')
    }

    const [res]: any[] = await conn.query(
      'UPDATE users SET can_edit_wbs = 1 WHERE username = ?',
      [username]
    )
    if (res.affectedRows === 0) {
      console.log(`사용자를 찾을 수 없습니다. username="${username}" 인 행이 있는지 확인하세요.`)
    } else {
      console.log(`"${username}" 계정에 WBS 수정 권한을 부여했습니다. (${res.affectedRows}건)`)
    }
  } finally {
    conn.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
