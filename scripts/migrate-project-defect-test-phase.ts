/**
 * project_defects.test_phase 구 값 → 신 Phase 매핑
 *   Unit, UAT → 유지
 *   Integration → UT, System → UAT, Regression → PVT, Other → DryRun
 * 실행: npx tsx scripts/migrate-project-defect-test-phase.ts
 */
import type { ResultSetHeader } from 'mysql2'
import { getPool } from '../lib/db'

async function main() {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    const pairs: [string, string][] = [
      ['Integration', 'UT'],
      ['System', 'UAT'],
      ['Regression', 'PVT'],
      ['Other', 'DryRun'],
    ]
    for (const [from, to] of pairs) {
      const [result] = await conn.query<ResultSetHeader>(
        'UPDATE project_defects SET test_phase = ? WHERE test_phase = ?',
        [to, from]
      )
      console.log(`✅ ${from} → ${to}: ${result.affectedRows}행`)
    }
    try {
      await conn.query(
        "ALTER TABLE project_defects MODIFY test_phase VARCHAR(100) NOT NULL DEFAULT 'UT'"
      )
      console.log('✅ 기본값 test_phase = UT 로 조정')
    } catch (e: any) {
      if (e?.code === 'ER_NO_SUCH_TABLE') {
        console.log('ℹ️ project_defects 테이블 없음 — add-project-defects-tables 먼저 실행')
      } else {
        console.log('ℹ️ DEFAULT 변경 생략 또는 이미 동일:', e?.message || e)
      }
    }
  } finally {
    conn.release()
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
