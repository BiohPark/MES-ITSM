import { getPool } from './db'

export interface VocFeedback {
  id: number
  user_id: string
  user_name: string
  category: string
  title: string
  content: string
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed'
  priority: 'Low' | 'Medium' | 'High' | 'Critical'
  admin_response?: string
  created_at: Date
  updated_at: Date
  resolved_at?: Date
}

export async function createVocFeedback(
  userId: string,
  userName: string,
  category: string,
  title: string,
  content: string,
  priority: string = 'Medium'
): Promise<number> {
  const pool = getPool()
  const [result] = await pool.query<any>(
    `INSERT INTO voc_feedbacks (user_id, user_name, category, title, content, priority, status)
     VALUES (?, ?, ?, ?, ?, ?, 'Open')`,
    [userId, userName, category, title, content, priority]
  )
  return result.insertId
}

export async function getVocFeedbacks(
  status?: string,
  userId?: string
): Promise<VocFeedback[]> {
  try {
    const pool = getPool()
    let query = 'SELECT * FROM voc_feedbacks WHERE 1=1'
    const params: any[] = []

    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }

    if (userId) {
      query += ' AND user_id = ?'
      params.push(userId)
    }

    query += ' ORDER BY created_at DESC'

    const [rows] = await pool.query<any[]>(query, params)
    return rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      user_name: row.user_name,
      category: row.category,
      title: row.title,
      content: row.content,
      status: row.status,
      priority: row.priority,
      admin_response: row.admin_response || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
      resolved_at: row.resolved_at || undefined,
    }))
  } catch (error: any) {
    // 테이블이 존재하지 않는 경우 빈 배열 반환
    if (error.code === 'ER_NO_SUCH_TABLE' || error.message?.includes("doesn't exist")) {
      console.warn('VOC 테이블이 존재하지 않습니다. 테이블을 생성해주세요: npm run add-voc-table')
      return []
    }
    throw error
  }
}

export async function getVocFeedbackById(id: number): Promise<VocFeedback | null> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    'SELECT * FROM voc_feedbacks WHERE id = ?',
    [id]
  )

  if (rows.length === 0) {
    return null
  }

  const row = rows[0]
  return {
    id: row.id,
    user_id: row.user_id,
    user_name: row.user_name,
    category: row.category,
    title: row.title,
    content: row.content,
    status: row.status,
    priority: row.priority,
    admin_response: row.admin_response || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    resolved_at: row.resolved_at || undefined,
  }
}

export async function updateVocFeedback(
  id: number,
  updates: {
    status?: string
    admin_response?: string
    priority?: string
  }
): Promise<void> {
  const pool = getPool()
  const fields: string[] = []
  const values: any[] = []

  if (updates.status) {
    fields.push('status = ?')
    values.push(updates.status)
    if (updates.status === 'Resolved' || updates.status === 'Closed') {
      fields.push('resolved_at = NOW()')
    }
  }

  if (updates.admin_response !== undefined) {
    fields.push('admin_response = ?')
    values.push(updates.admin_response)
  }

  if (updates.priority) {
    fields.push('priority = ?')
    values.push(updates.priority)
  }

  if (fields.length === 0) {
    return
  }

  values.push(id)
  await pool.query(
    `UPDATE voc_feedbacks SET ${fields.join(', ')} WHERE id = ?`,
    values
  )
}

export async function deleteVocFeedback(id: number): Promise<void> {
  const pool = getPool()
  await pool.query('DELETE FROM voc_feedbacks WHERE id = ?', [id])
}

