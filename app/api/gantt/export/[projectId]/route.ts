import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { stringify } from 'csv-stringify/sync'

// MS Project 호환 CSV Export (1차 단순 버전)

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const pool = getPool()

    const [[project]] = await pool.query<any[]>(
      `SELECT id, name FROM gantt_projects WHERE id = ?`,
      [params.projectId]
    )

    if (!project) {
      return NextResponse.json(
        { error: 'Gantt project not found' },
        { status: 404 }
      )
    }

    const [tasks] = await pool.query<any[]>(
      `
      SELECT 
        wbs_code as WBS,
        outline_level as OutlineLevel,
        name as TaskName,
        start_date as Start,
        finish_date as Finish,
        duration_days as Duration,
        predecessors as Predecessors,
        assignee as ResourceNames
      FROM gantt_tasks
      WHERE project_id = ?
      ORDER BY sort_order ASC, id ASC
      `,
      [params.projectId]
    )

    const records = (tasks as any[]).map((t) => ({
      'WBS': t.WBS ?? '',
      'Outline Level': t.OutlineLevel ?? '',
      'Task Name': t.TaskName ?? '',
      'Start': t.Start ? new Date(t.Start).toISOString().substring(0, 10) : '',
      'Finish': t.Finish
        ? new Date(t.Finish).toISOString().substring(0, 10)
        : '',
      'Duration': t.Duration != null ? `P${t.Duration}D` : '',
      'Predecessors': t.Predecessors ?? '',
      'Resource Names': t.ResourceNames ?? '',
    }))

    const csv = stringify(records, {
      header: true,
    })

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="gantt_project_${project.id}.csv"`,
      },
    })
  } catch (error: any) {
    console.error('[gantt/export][GET] 오류:', error)
    return NextResponse.json(
      { error: 'Failed to export Gantt project', details: error.message },
      { status: 500 }
    )
  }
}


