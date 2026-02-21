/** DB 설정(.env.local) 적용 - getPool() 호출 전에 로드 */
import './load-dotenv'
import { getPool } from '../lib/db'

async function addSystemSettingsTable() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    console.log('system_settings 테이블 생성 중...')

    await connection.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    const defaults: [string, string][] = [
      ['backup_retention_days', '10'],
      ['backup_list_limit', '50'],
      ['backup_schedule_interval_hours', '1'],
      ['meeting_autosave_interval_sec', '60'],
    ]
    for (const [key, value] of defaults) {
      const [rows] = await connection.query<any[]>(
        'SELECT 1 FROM system_settings WHERE setting_key = ?',
        [key]
      )
      if (!rows || rows.length === 0) {
        await connection.query(
          'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)',
          [key, value]
        )
        console.log(`  기본값 ${key} = ${value} 삽입`)
      }
    }

    console.log('✅ system_settings 테이블 생성/확인 완료!')
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    console.error('❌ system_settings 테이블 생성 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await addSystemSettingsTable()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
