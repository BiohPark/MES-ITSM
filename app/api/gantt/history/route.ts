import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

/** WBS 수정 이력 목록 (프로젝트별 필터 optional) */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    const pool = getPool()
    let query = `
      SELECT 
        id,
        project_id AS projectId,
        project_name AS projectName,
        user_id AS userId,
        user_name AS userName,
        action,
        created_at AS createdAt
      FROM gantt_wbs_history
    `
    const params: (string | number)[] = []
    if (projectId) {
      query += ' WHERE project_id = ?'
      params.push(projectId)
    }
    query += ' ORDER BY created_at DESC LIMIT 500'

    const [rows] = await pool.query<any[]>(query, params)

    const list = (rows ?? []).map((row) => ({
      id: row.id,
      projectId: row.projectId,
      projectName: row.projectName,
      userId: row.userId,
      userName: row.userName,
      action: row.action,
      createdAt: (row.createdAt ?? row.created_at) ? new Date(row.createdAt ?? row.created_at).toISOString() : '',
    }))

    return NextResponse.json({ history: list })
  } catch (error: any) {
    console.error('[gantt/history][GET]', error)
    return NextResponse.json(
      { error: 'Failed to load WBS history', details: error.message },
      { status: 500 }
    )
  }
}
