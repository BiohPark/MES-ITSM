/**
 * 프로젝트 테스트 Defect 관리 + 감사 로그
 * 실행: npx tsx scripts/add-project-defects-tables.ts
 */
import { getPool } from '../lib/db'

async function main() {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS project_defects (
        id VARCHAR(50) PRIMARY KEY,
        project_id VARCHAR(50) NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        severity VARCHAR(32) NOT NULL DEFAULT 'Major',
        status VARCHAR(50) NOT NULL DEFAULT 'Open',
        test_phase VARCHAR(100) NOT NULL DEFAULT 'Other',
        reporter_user_id VARCHAR(64) NULL,
        reporter_name VARCHAR(200) NOT NULL DEFAULT '',
        assignee VARCHAR(200) NULL,
        detected_at DATE NOT NULL,
        resolved_at DATE NULL,
        verified_at DATE NULL,
        verified_by VARCHAR(200) NULL,
        root_cause TEXT NULL,
        fix_summary TEXT NULL,
        linked_task_id VARCHAR(100) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pd_project (project_id),
        INDEX idx_pd_status (status),
        INDEX idx_pd_severity (severity),
        INDEX idx_pd_detected (detected_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    console.log('✅ project_defects 테이블 확인 완료')

    await conn.query(`
      CREATE TABLE IF NOT EXISTS project_defect_audit (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        defect_id VARCHAR(50) NOT NULL,
        action VARCHAR(40) NOT NULL,
        actor_user_id VARCHAR(64) NULL,
        actor_name VARCHAR(200) NULL,
        summary VARCHAR(500) NULL,
        details_json TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_pda_defect (defect_id),
        INDEX idx_pda_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    console.log('✅ project_defect_audit 테이블 확인 완료 (Defect 삭제 시에도 감사 행은 defect_id 문자열로 보존; FK 없음)')

    try {
      await conn.query(`
        ALTER TABLE project_defects
        ADD CONSTRAINT fk_pd_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      `)
      console.log('✅ project_defects → projects FK 추가')
    } catch (e: any) {
      if (e?.code === 'ER_DUP_KEYNAME' || e?.code === 'ER_CANT_CREATE_TABLE') {
        console.log('ℹ️ FK 이미 존재')
      } else if (e?.code === 'ER_CANNOT_ADD_FOREIGN') {
        console.log('⚠️ FK 생략(데이터 정합성). project_id 인덱스만 사용합니다.')
      } else {
        throw e
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
