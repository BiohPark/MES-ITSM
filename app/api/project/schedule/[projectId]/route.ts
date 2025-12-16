import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { calculateSchedule, type Task, type Predecessor } from '@/lib/schedule-calculator'

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const projectId = params.projectId
    const pool = getPool()

    // 프로젝트 시작일 조회
    const [projects] = await pool.query<any[]>(
      'SELECT start, due FROM projects WHERE id = ?',
      [projectId]
    )

    if (projects.length === 0) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    const project = projects[0]
    const projectStartDate = project.start || null
    const projectEndDate = project.due || null

    // 프로젝트의 모든 작업 조회 (task_index 포함)
    const [tasks] = await pool.query<any[]>(
      `SELECT 
        id as taskId,
        COALESCE(task_index, 0) as taskIndex,
        title as taskName,
        DATEDIFF(COALESCE(due, CURDATE()), COALESCE(start, CURDATE())) + 1 as durationDays,
        start as startDate
      FROM project_children
      WHERE project_id = ? AND id NOT LIKE 'GMP-%'
      ORDER BY task_index ASC, created_at ASC`,
      [projectId]
    )

    if (tasks.length === 0) {
      return NextResponse.json({
        schedules: [],
        projectStartDate,
        projectEndDate,
      })
    }

    // 종속성 조회
    const taskIds = tasks.map(t => t.taskId)
    const placeholders = taskIds.map(() => '?').join(',')

    const [predecessors] = await pool.query<any[]>(
      `SELECT 
        task_id as taskId,
        predecessor_task_id as predecessorTaskId,
        dependency_type as dependencyType,
        lag_days as lagDays
      FROM predecessors
      WHERE task_id IN (${placeholders})`,
      taskIds
    )

    // 데이터 변환
    const taskList: Task[] = tasks.map(t => ({
      taskId: t.taskId,
      taskIndex: t.taskIndex || 0,
      taskName: t.taskName,
      durationDays: Math.max(1, t.durationDays || 1), // 최소 1일
      startDate: t.startDate,
      projectStartDate,
    }))

    const predecessorList: Predecessor[] = predecessors.map(p => ({
      taskId: p.taskId,
      predecessorTaskId: p.predecessorTaskId,
      dependencyType: p.dependencyType,
      lagDays: p.lagDays || 0,
    }))

    // 일정 계산
    const schedules = calculateSchedule(
      taskList,
      predecessorList,
      projectStartDate,
      projectEndDate
    )

    return NextResponse.json({
      schedules,
      projectStartDate,
      projectEndDate,
    })
  } catch (error: any) {
    console.error('Error calculating schedule:', error)
    return NextResponse.json(
      { error: 'Failed to calculate schedule', details: error.message },
      { status: 500 }
    )
  }
}


