import { getPool } from './db'

/**
 * 시스템 설정 조회 (문자열)
 */
export async function getSystemSetting(key: string): Promise<string | null> {
  const pool = getPool()
  const [rows] = await pool.query<{ setting_value: string }[]>(
    'SELECT setting_value FROM system_settings WHERE setting_key = ?',
    [key]
  )
  if (!rows || rows.length === 0) return null
  return rows[0].setting_value ?? null
}

/**
 * 시스템 설정 조회 (정수, 없거나 테이블 미존재 시 기본값 반환)
 */
export async function getSystemSettingNumber(
  key: string,
  defaultValue: number
): Promise<number> {
  try {
    const raw = await getSystemSetting(key)
    if (raw === null || raw === '') return defaultValue
    const n = parseInt(raw, 10)
    return Number.isFinite(n) ? n : defaultValue
  } catch {
    return defaultValue
  }
}

/**
 * 시스템 설정 조회 (실수, 없거나 테이블 미존재 시 기본값 반환)
 */
export async function getSystemSettingFloat(
  key: string,
  defaultValue: number
): Promise<number> {
  try {
    const raw = await getSystemSetting(key)
    if (raw === null || raw === '') return defaultValue
    const n = parseFloat(raw)
    return Number.isFinite(n) ? n : defaultValue
  } catch {
    return defaultValue
  }
}

/**
 * 시스템 설정 저장
 */
export async function setSystemSetting(
  key: string,
  value: string
): Promise<void> {
  const pool = getPool()
  await pool.query(
    `INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [key, String(value)]
  )
}
