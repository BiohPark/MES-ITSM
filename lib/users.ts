import mysql from 'mysql2/promise'
import { getPool } from './db'

export interface User {
  id: string
  name: string
  username?: string
  email?: string
  role?: string
  is_admin?: boolean
  can_edit_wbs?: boolean
  department_id?: number | null
  department_name?: string | null
  created_at?: string
}

// 로그인 가능한 사용자 목록 조회
export async function getUsers(): Promise<User[]> {
  const pool = getPool()
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT u.*, d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       ORDER BY u.created_at DESC`
    )
    return (rows || []).map((row) => ({
      id: String(row.id ?? ''),
      name: String(row.name ?? ''),
      username: row.username != null ? String(row.username) : '',
      email: row.email != null ? String(row.email) : '',
      role: row.role != null ? String(row.role) : 'user',
      is_admin: row.role === 'admin' || !!row.is_admin,
      can_edit_wbs: !!row.can_edit_wbs,
      department_id: row.department_id != null ? Number(row.department_id) : null,
      department_name: row.department_name != null ? String(row.department_name) : null,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
    }))
  } catch (e: any) {
    if (e?.code === 'ER_BAD_FIELD_ERROR' || e?.code === 'ER_NO_SUCH_TABLE') {
      const [rows] = await pool.query<any[]>(`SELECT * FROM users ORDER BY created_at DESC`)
      return (rows || []).map((row) => ({
        id: String(row.id ?? ''),
        name: String(row.name ?? ''),
        username: row.username != null ? String(row.username) : '',
        email: row.email != null ? String(row.email) : '',
        role: row.role != null ? String(row.role) : 'user',
        is_admin: row.role === 'admin' || !!row.is_admin,
        can_edit_wbs: !!row.can_edit_wbs,
        department_id: null,
        department_name: null,
        created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
      }))
    }
    throw e
  }
}

// 다음 사용자 ID 생성
export async function getNextUserId(): Promise<string> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    `SELECT id FROM users WHERE id LIKE 'USER-%' ORDER BY id DESC LIMIT 1`
  )

  if (rows.length === 0) {
    return 'USER-00001'
  }

  const lastId = rows[0].id
  const match = lastId.match(/USER-(\d+)/)
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1
    return `USER-${String(nextNum).padStart(5, '0')}`
  }

  return 'USER-00001'
}

// 사용자 추가
export async function createUser(user: User): Promise<void> {
  const pool = getPool()
  await pool.query(
    'INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, ?)',
    [user.id, user.name, user.email || null, user.role || null]
  )
}

// 사용자 삭제
export async function deleteUser(userId: string): Promise<void> {
  const pool = getPool()
  const [result] = await pool.query<mysql.ResultSetHeader>(
    'DELETE FROM users WHERE id = ?',
    [userId]
  )
  if (result.affectedRows === 0) {
    throw new Error(`사용자 ${userId}를 찾을 수 없습니다.`)
  }
}

// 사용자 테이블 초기화
export async function initializeUsersTable(): Promise<void> {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  } finally {
    connection.release()
  }
}

