import { getPool } from '../lib/db'

/**
 * 이슈 ↔ GMP Record ↔ 일감 링크 컬럼 추가
 * - issues: linked_gmp_record_id, linked_task_id (Deviation 시 GMP Record 링크, 해결용 일감 링크)
 * - gmp_records: linked_issue_id (연결된 이슈)
 * - project_children: linked_issue_id (연결된 이슈, 해결용 일감일 때)
 */
async function addIssueGmpTaskLinks() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    console.log('='.repeat(80))
    console.log('이슈 ↔ GMP Record ↔ 일감 링크 컬럼 추가')
    console.log('='.repeat(80))
    console.log()

    // 1. issues 테이블에 linked_gmp_record_id 추가
    console.log('📊 issues 테이블에 linked_gmp_record_id 컬럼 추가...')
    try {
      await connection.query(`
        ALTER TABLE issues ADD COLUMN linked_gmp_record_id VARCHAR(50) NULL
      `)
      await connection.query(`CREATE INDEX idx_issues_linked_gmp ON issues(linked_gmp_record_id)`)
      console.log('   ✅ linked_gmp_record_id 추가 완료!')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_DUP_KEYNAME') {
        console.log('   ℹ️  linked_gmp_record_id 컬럼/인덱스가 이미 존재합니다.')
      } else {
        throw error
      }
    }

    // issues 테이블에 linked_task_id 추가
    console.log('📊 issues 테이블에 linked_task_id 컬럼 추가...')
    try {
      await connection.query(`
        ALTER TABLE issues ADD COLUMN linked_task_id VARCHAR(50) NULL
      `)
      await connection.query(`CREATE INDEX idx_issues_linked_task ON issues(linked_task_id)`)
      console.log('   ✅ linked_task_id 추가 완료!')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_DUP_KEYNAME') {
        console.log('   ℹ️  linked_task_id 컬럼/인덱스가 이미 존재합니다.')
      } else {
        throw error
      }
    }
    console.log()

    // 2. gmp_records 테이블에 linked_issue_id 추가
    console.log('📊 gmp_records 테이블에 linked_issue_id 컬럼 추가...')
    try {
      await connection.query(`
        ALTER TABLE gmp_records ADD COLUMN linked_issue_id VARCHAR(50) NULL
      `)
      await connection.query(`CREATE INDEX idx_gmp_linked_issue ON gmp_records(linked_issue_id)`)
      console.log('   ✅ linked_issue_id 추가 완료!')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_DUP_KEYNAME') {
        console.log('   ℹ️  gmp_records.linked_issue_id 컬럼/인덱스가 이미 존재합니다.')
      } else {
        throw error
      }
    }
    console.log()

    // 3. project_children 테이블에 linked_issue_id 추가
    console.log('📊 project_children 테이블에 linked_issue_id 컬럼 추가...')
    try {
      await connection.query(`
        ALTER TABLE project_children ADD COLUMN linked_issue_id VARCHAR(50) NULL
      `)
      await connection.query(`CREATE INDEX idx_pc_linked_issue ON project_children(linked_issue_id)`)
      console.log('   ✅ project_children.linked_issue_id 추가 완료!')
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_DUP_KEYNAME') {
        console.log('   ℹ️  project_children.linked_issue_id 컬럼/인덱스가 이미 존재합니다.')
      } else {
        throw error
      }
    }
    console.log()

    console.log('='.repeat(80))
    console.log('✅ 이슈 ↔ GMP Record ↔ 일감 링크 컬럼 추가 완료!')
    console.log('='.repeat(80))
  } catch (error) {
    console.error('❌ 컬럼 추가 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await addIssueGmpTaskLinks()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
