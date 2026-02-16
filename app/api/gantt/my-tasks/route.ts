import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getSession } from '@/lib/auth'

/** 현재 로그인 사용자가 담당자인 Gantt WBS 작업 목록 (내 일감 연동) */
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }
    const names: string[] = []
    if (session.name?.trim()) names.push(session.name.trim())
    if (session.username?.trim() && !names.includes(session.username.trim())) {
      names.push(session.username.trim())
    }
    if (names.length === 0) {
      return NextResponse.json({ tasks: [] })
    }

    const pool = getPool()
    const placeholders = names.map(() => 'TRIM(t.assignee) = ?').join(' OR ')
    const [rows] = await pool.query<any[]>(
      `
      SELECT 
        t.id AS taskId,
        t.project_id AS projectId,
        p.name AS projectName,
        t.name AS taskName,
        t.wbs_code AS wbsCode,
        t.start_date AS startDate,
        t.finish_date AS finishDate,
        t.progress_percent AS progressPercent
      FROM gantt_tasks t
      INNER JOIN gantt_projects p ON p.id = t.project_id
      WHERE ${placeholders}
      ORDER BY p.name, t.sort_order ASC, t.id ASC
      `,
      names
    )

    const tasks = (rows ?? []).map((r) => ({
      taskId: r.taskId,
      projectId: r.projectId,
      projectName: r.projectName,
      taskName: r.taskName,
      wbsCode: r.wbsCode,
      startDate: r.startDate,
      finishDate: r.finishDate,
      progressPercent: r.progressPercent,
    }))

    return NextResponse.json({ tasks })
  } catch (error: any) {
    console.error('[gantt/my-tasks][GET]', error)
    return NextResponse.json(
      { error: 'Failed to load my Gantt tasks', details: error.message },
      { status: 500 }
    )
  }
}
