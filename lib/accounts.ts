import mysql from 'mysql2/promise'
import { getPool } from './db'
import { hashPassword, verifyPassword } from './password'

export type UserRole =
  | 'admin'
  | 'user'
  | 'Deviation 매니저'
  | '개발 매니저'
  | 'PIM 매니저'
  | '총괄 매니저'

export interface Account {
  id: string
  username: string
  name: string
  email?: string
  password?: string // 해싱된 비밀번호
  role: UserRole
  can_edit_wbs?: boolean
  password_reset_token?: string | null
  password_reset_expires?: Date | null
  created_at?: string
  updated_at?: string
}

function parseCanEditWbs(value: unknown): boolean {
  return value === 1 || value === true || value === '1'
}

// username으로 계정 조회
export async function getAccountByUsername(username: string): Promise<Account | null> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    'SELECT * FROM users WHERE username = ?',
    [username]
  )

  if (rows.length === 0) {
    return null
  }

  const row = rows[0]
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email || undefined,
    password: row.password || undefined,
    role: (row.role || 'user') as UserRole,
    can_edit_wbs: parseCanEditWbs(row.can_edit_wbs),
    password_reset_token: row.password_reset_token || null,
    password_reset_expires: row.password_reset_expires ? new Date(row.password_reset_expires) : null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  }
}

// email로 계정 조회
export async function getAccountByEmail(email: string): Promise<Account | null> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    'SELECT * FROM users WHERE email = ?',
    [email]
  )

  if (rows.length === 0) {
    return null
  }

  const row = rows[0]
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email || undefined,
    password: row.password || undefined,
    role: (row.role || 'user') as UserRole,
    can_edit_wbs: parseCanEditWbs(row.can_edit_wbs),
    password_reset_token: row.password_reset_token || null,
    password_reset_expires: row.password_reset_expires ? new Date(row.password_reset_expires) : null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  }
}

// ID로 계정 조회
export async function getAccountById(id: string): Promise<Account | null> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    'SELECT * FROM users WHERE id = ?',
    [id]
  )

  if (rows.length === 0) {
    return null
  }

  const row = rows[0]
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email || undefined,
    password: row.password || undefined,
    role: (row.role || 'user') as UserRole,
    can_edit_wbs: parseCanEditWbs(row.can_edit_wbs),
    password_reset_token: row.password_reset_token || null,
    password_reset_expires: row.password_reset_expires ? new Date(row.password_reset_expires) : null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  }
}

// 계정 생성
export async function createAccount(
  username: string,
  name: string,
  email: string,
  password: string,
  role: UserRole = 'user'
): Promise<string> {
  const pool = getPool()

  // username 중복 확인
  const existingByUsername = await getAccountByUsername(username)
  if (existingByUsername) {
    throw new Error('이미 사용 중인 사용자명입니다.')
  }

  // email 중복 확인
  if (email) {
    const existingByEmail = await getAccountByEmail(email)
    if (existingByEmail) {
      throw new Error('이미 사용 중인 이메일입니다.')
    }
  }

  // 사용자 ID 생성
  const [rows] = await pool.query<any[]>(
    `SELECT id FROM users WHERE id LIKE 'USER-%' ORDER BY id DESC LIMIT 1`
  )

  let userId: string
  if (rows.length === 0) {
    userId = 'USER-00001'
  } else {
    const lastId = rows[0].id
    const match = lastId.match(/USER-(\d+)/)
    if (match) {
      const nextNum = parseInt(match[1], 10) + 1
      userId = `USER-${String(nextNum).padStart(5, '0')}`
    } else {
      userId = 'USER-00001'
    }
  }

  // 비밀번호 해싱
  const hashedPassword = await hashPassword(password)

  // 계정 생성 (can_edit_wbs 컬럼이 없으면 제외하고 INSERT)
  try {
    await pool.query(
      'INSERT INTO users (id, username, name, email, password, role, can_edit_wbs) VALUES (?, ?, ?, ?, ?, ?, 0)',
      [userId, username, name, email || null, hashedPassword, role]
    )
  } catch (err: any) {
    if (err?.code === 'ER_BAD_FIELD_ERROR' || err?.message?.includes("Unknown column 'can_edit_wbs'")) {
      await pool.query(
        'INSERT INTO users (id, username, name, email, password, role) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, username, name, email || null, hashedPassword, role]
      )
    } else {
      throw err
    }
  }

  return userId
}

// 로그인 검증
export async function verifyLogin(
  username: string,
  password: string
): Promise<Account | null> {
  const account = await getAccountByUsername(username)

  if (!account || !account.password) {
    return null
  }

  const isValid = await verifyPassword(password, account.password)
  if (!isValid) {
    return null
  }

  // 비밀번호는 반환하지 않음
  const { password: _, ...accountWithoutPassword } = account
  return accountWithoutPassword as Account
}

// 계정 정보 업데이트
export async function updateAccount(
  userId: string,
  updates: {
    username?: string
    name?: string
    email?: string
    password?: string
    role?: UserRole
    can_edit_wbs?: boolean
  }
): Promise<void> {
  const pool = getPool()

  // username 중복 확인 (다른 사용자가 사용 중인지)
  if (updates.username) {
    const existing = await getAccountByUsername(updates.username)
    if (existing && existing.id !== userId) {
      throw new Error('이미 사용 중인 ID입니다.')
    }
  }

  // email 중복 확인 (다른 사용자가 사용 중인지)
  if (updates.email) {
    const existing = await getAccountByEmail(updates.email)
    if (existing && existing.id !== userId) {
      throw new Error('이미 사용 중인 이메일입니다.')
    }
  }

  // 업데이트할 필드 구성
  const updateFields: string[] = []
  const updateValues: any[] = []

  if (updates.username !== undefined) {
    updateFields.push('username = ?')
    updateValues.push(updates.username)
  }
  if (updates.name !== undefined) {
    updateFields.push('name = ?')
    updateValues.push(updates.name)
  }
  if (updates.email !== undefined) {
    updateFields.push('email = ?')
    updateValues.push(updates.email || null)
  }
  if (updates.password) {
    const hashedPassword = await hashPassword(updates.password)
    updateFields.push('password = ?')
    updateValues.push(hashedPassword)
  }
  if (updates.role !== undefined) {
    updateFields.push('role = ?')
    updateValues.push(updates.role)
  }
  if (updates.can_edit_wbs !== undefined) {
    updateFields.push('can_edit_wbs = ?')
    updateValues.push(updates.can_edit_wbs ? 1 : 0)
  }

  if (updateFields.length === 0) {
    return // 업데이트할 내용이 없음
  }

  updateValues.push(userId)

  try {
    await pool.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    )
  } catch (err: any) {
    // can_edit_wbs 컬럼이 없을 때 컬럼 추가 후 재시도
    if (
      (err?.code === 'ER_BAD_FIELD_ERROR' || err?.message?.includes("Unknown column 'can_edit_wbs'")) &&
      updates.can_edit_wbs !== undefined
    ) {
      try {
        await pool.query(
          `ALTER TABLE users ADD COLUMN can_edit_wbs TINYINT(1) NOT NULL DEFAULT 0`
        )
      } catch (alterErr: any) {
        if (alterErr?.code !== 'ER_DUP_FIELDNAME') throw alterErr
      }
      await pool.query(
        `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      )
      return
    }
    throw err
  }
}

// 비밀번호 변경
export async function updatePassword(
  userId: string,
  newPassword: string
): Promise<void> {
  const pool = getPool()
  const hashedPassword = await hashPassword(newPassword)

  await pool.query(
    'UPDATE users SET password = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?',
    [hashedPassword, userId]
  )
}

// 비밀번호 리셋 토큰 설정
export async function setPasswordResetToken(
  userId: string,
  token: string,
  expiresAt: Date
): Promise<void> {
  const pool = getPool()

  await pool.query(
    'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?',
    [token, expiresAt, userId]
  )
}

// 비밀번호 리셋 토큰으로 계정 조회
export async function getAccountByResetToken(token: string): Promise<Account | null> {
  const pool = getPool()
  const now = new Date()

  const [rows] = await pool.query<any[]>(
    'SELECT * FROM users WHERE password_reset_token = ? AND password_reset_expires > ?',
    [token, now]
  )

  if (rows.length === 0) {
    return null
  }

  const row = rows[0]
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email || undefined,
    password: row.password || undefined,
    role: (row.role || 'user') as UserRole,
    can_edit_wbs: parseCanEditWbs(row.can_edit_wbs),
    password_reset_token: row.password_reset_token || null,
    password_reset_expires: row.password_reset_expires ? new Date(row.password_reset_expires) : null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  }
}

// username 중복 확인
export async function isUsernameTaken(username: string): Promise<boolean> {
  const account = await getAccountByUsername(username)
  return account !== null
}

// email 중복 확인
export async function isEmailTaken(email: string): Promise<boolean> {
  const account = await getAccountByEmail(email)
  return account !== null
}

