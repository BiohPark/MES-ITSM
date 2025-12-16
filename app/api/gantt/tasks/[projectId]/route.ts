import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

// 특정 Gantt 프로젝트의 태스크 목록 조회 및 저장

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const pool = getPool()
    const [rows] = await pool.query<any[]>(
      `
      SELECT 
        id,
        project_id as projectId,
        wbs_code as wbsCode,
        outline_level as outlineLevel,
        sort_order as sortOrder,
        name,
        start_date as startDate,
        finish_date as finishDate,
        duration_days as durationDays,
        predecessors,
        assignee,
        is_milestone as isMilestone
      FROM gantt_tasks
      WHERE project_id = ?
      ORDER BY sort_order ASC, id ASC
      `,
      [params.projectId]
    )

    return NextResponse.json({ tasks: rows })
  } catch (error: any) {
    console.error('[gantt/tasks][GET] 오류:', error)
    return NextResponse.json(
      { error: 'Failed to load Gantt tasks', details: error.message },
      { status: 500 }
    )
  }
}

// 전체 태스크 배열을 받아 일괄 저장 (간단한 1차 버전)
export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const body = await req.json()
    const { tasks } = body as {
      tasks: Array<{
        id?: number
        wbsCode?: string | null
        outlineLevel: number
        sortOrder: number
        name: string
        startDate?: string | null
        finishDate?: string | null
        durationDays?: number | null
        predecessors?: string | null
        assignee?: string | null
        isMilestone?: boolean
      }>
    }

    if (!Array.isArray(tasks)) {
      return NextResponse.json(
        { error: 'tasks array is required' },
        { status: 400 }
      )
    }

    const projectId = params.projectId
    const pool = getPool()
    const conn = await pool.getConnection()

    try {
      await conn.beginTransaction()

      // 기존 태스크는 일단 삭제하고 다시 넣는 단순 방식 (1차 버전)
      await conn.query(`DELETE FROM gantt_tasks WHERE project_id = ?`, [
        projectId,
      ])

      for (const t of tasks) {
        await conn.query(
          `
          INSERT INTO gantt_tasks
            (project_id, wbs_code, outline_level, sort_order, name, start_date, finish_date, duration_days, predecessors, assignee, is_milestone)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            projectId,
            t.wbsCode ?? null,
            t.outlineLevel ?? 1,
            t.sortOrder ?? 1,
            t.name,
            t.startDate ?? null,
            t.finishDate ?? null,
            t.durationDays ?? null,
            t.predecessors ?? null,
            t.assignee ?? null,
            t.isMilestone ? 1 : 0,
          ]
        )
      }

      await conn.commit()
      return NextResponse.json({ success: true })
    } catch (error: any) {
      await conn.rollback()
      throw error
    } finally {
      conn.release()
    }
  } catch (error: any) {
    console.error('[gantt/tasks][POST] 오류:', error)
    return NextResponse.json(
      { error: 'Failed to save Gantt tasks', details: error.message },
      { status: 500 }
    )
  }
}


