import mysql from 'mysql2/promise'
import { getPool } from './db'

export interface DepartmentRow {
  id: number
  name: string
  sort_order: number
}

export async function listDepartments(): Promise<DepartmentRow[]> {
  const pool = getPool()
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, name, sort_order FROM departments ORDER BY sort_order ASC, name ASC`
    )
    return (rows || []).map((r) => ({
      id: Number(r.id),
      name: String(r.name ?? ''),
      sort_order: Number(r.sort_order ?? 0),
    }))
  } catch (e: any) {
    if (e?.code === 'ER_NO_SUCH_TABLE') return []
    throw e
  }
}

export async function createDepartment(name: string): Promise<number> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('부서명을 입력하세요.')
  const pool = getPool()
  const [max] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM departments`
  )
  const n = Number((max as mysql.RowDataPacket[])[0]?.n ?? 0)
  const [res] = await pool.query<mysql.ResultSetHeader>(
    `INSERT INTO departments (name, sort_order) VALUES (?, ?)`,
    [trimmed, n]
  )
  return res.insertId
}

export async function deleteDepartment(id: number): Promise<void> {
  const pool = getPool()
  await pool.query(`UPDATE users SET department_id = NULL WHERE department_id = ?`, [id])
  await pool.query(`DELETE FROM departments WHERE id = ?`, [id])
}
