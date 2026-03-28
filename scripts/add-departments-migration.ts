/**
 * 부서 마스터(departments) 및 users.department_id 컬럼 추가
 * 실행: npx tsx scripts/add-departments-migration.ts
 */
import { getPool } from '../lib/db'

async function main() {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_departments_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    console.log('✅ departments 테이블 확인 완료')

    try {
      await conn.query(`
        ALTER TABLE users
        ADD COLUMN department_id INT NULL,
        ADD INDEX idx_users_department_id (department_id)
      `)
      console.log('✅ users.department_id 컬럼 추가')
    } catch (e: any) {
      if (e?.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ users.department_id 이미 존재')
      } else {
        throw e
      }
    }

    try {
      await conn.query(`
        ALTER TABLE users
        ADD CONSTRAINT fk_users_department
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
      `)
      console.log('✅ users ↔ departments FK 추가')
    } catch (e: any) {
      if (e?.code === 'ER_DUP_KEYNAME' || e?.code === 'ER_CANT_CREATE_TABLE') {
        console.log('ℹ️ FK 이미 존재 또는 생략')
      } else if (e?.code === 'ER_CANNOT_ADD_FOREIGN') {
        console.log('⚠️ FK 추가 생략(데이터 정합성). department_id 컬럼만 사용합니다.')
      } else {
        throw e
      }
    }

    const [rows] = await conn.query<any[]>(`SELECT COUNT(*) AS c FROM departments`)
    const c = (rows as any[])[0]?.c ?? 0
    if (c === 0) {
      await conn.query(
        `INSERT INTO departments (name, sort_order) VALUES (?, 0), (?, 1)`,
        ['미지정', '기본부서']
      )
      console.log('✅ 초기 부서 샘플 2건 삽입 (미지정, 기본부서)')
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
