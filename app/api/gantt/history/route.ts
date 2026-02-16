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

    const list = (rows ?? []).map((row: any) => {
      const createdAt = row.createdAt ?? row.created_at
      return {
        id: row.id,
        projectId: row.projectId ?? row.project_id,
        projectName: row.projectName ?? row.project_name,
        userId: row.userId ?? row.user_id,
        userName: row.userName ?? row.user_name,
        action: row.action,
        createdAt: createdAt ? new Date(createdAt).toISOString() : '',
      }
    })

    return NextResponse.json({ history: list })
  } catch (error: any) {
    console.error('[gantt/history][GET]', error)
    const msg = error?.message ?? ''
    const code = error?.code ?? ''
    if (code === 'ER_NO_SUCH_TABLE' || msg.includes("doesn't exist") || msg.includes('gantt_wbs_history')) {
      return NextResponse.json({
        history: [],
        message: 'WBS 이력 테이블이 없습니다. 설정 → DB 마이그레이션 또는 npm run setup-db 후 재시도하세요.',
      })
    }
    return NextResponse.json(
      { error: 'Failed to load WBS history', details: msg },
      { status: 500 }
    )
  }
}
