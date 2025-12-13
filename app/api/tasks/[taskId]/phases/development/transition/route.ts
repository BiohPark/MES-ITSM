import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getSession } from '@/lib/auth'

/**
 * POST /api/tasks/{taskId}/phases/development/transition
 * 개발 단계 상태 전환 실행
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const taskId = params.taskId
    const body = await request.json()
    const transitionId = body.transition_id

    if (!transitionId) {
      return NextResponse.json(
        { error: 'transition_id가 필요합니다.' },
        { status: 400 }
      )
    }

    const pool = getPool()

    // Task 조회
    const [tasks] = await pool.query<any[]>(
      'SELECT * FROM project_children WHERE id = ?',
      [taskId]
    )

    if (tasks.length === 0) {
      return NextResponse.json(
        { error: 'Task를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const task = tasks[0]
    
    // 개발 단계 상태 추출
    let currentStatus = 'Planning'
    let phases = {}
    if (task.phases) {
      try {
        phases = typeof task.phases === 'string' ? JSON.parse(task.phases) : task.phases
        currentStatus = phases?.development?.status || 'Planning'
      } catch (e) {
        phases = {}
      }
    }

    // 세션에서 사용자 정보 가져오기
    const session = await getSession()
    const userRole = session?.role || null
    const userId = session?.userId || null

    // 개발 단계 전용 워크플로우 확인
    const [workflows] = await pool.query<any[]>(
      "SELECT id FROM workflows WHERE name = 'Development Phase Workflow' AND is_active = 1"
    )

    if (workflows.length === 0) {
      return NextResponse.json(
        { error: '개발 단계 워크플로우가 설정되지 않았습니다.' },
        { status: 404 }
      )
    }

    const workflowId = workflows[0].id

    // 전환 조회 (개발 단계 전용 워크플로우의 전환만)
    const [transitions] = await pool.query<any[]>(
      `SELECT 
        t.id,
        t.name,
        t.from_status_id,
        t.to_status_id,
        fs.name AS from_status_name,
        ts.name AS to_status_name,
        t.description,
        t.\`condition\`
      FROM workflow_transitions t
      INNER JOIN workflow_statuses fs ON t.from_status_id = fs.id
      INNER JOIN workflow_statuses ts ON t.to_status_id = ts.id
      WHERE t.id = ? AND t.workflow_id = ? AND t.is_active = 1`,
      [transitionId, workflowId]
    )

    if (transitions.length === 0) {
      return NextResponse.json(
        { error: '전환을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const transition = transitions[0]

    // 현재 상태 확인
    if (transition.from_status_name !== currentStatus) {
      return NextResponse.json(
        { error: `현재 상태(${currentStatus})에서 이 전환을 수행할 수 없습니다.` },
        { status: 400 }
      )
    }

    // 조건 검사
    const condition = transition.condition ? JSON.parse(transition.condition as string) : {}
    
    if (condition.required_roles && Array.isArray(condition.required_roles)) {
      if (!userRole || !condition.required_roles.includes(userRole)) {
        return NextResponse.json(
          { error: '이 전환을 수행할 권한이 없습니다.' },
          { status: 403 }
        )
      }
    }

    if (condition.required_users && Array.isArray(condition.required_users)) {
      if (!userId || !condition.required_users.includes(userId)) {
        return NextResponse.json(
          { error: '이 전환을 수행할 권한이 없습니다.' },
          { status: 403 }
        )
      }
    }

    // 개발 단계 담당자 체크
    const devOwner = phases?.development?.owner || null
    if (condition.owner_only && devOwner && devOwner !== userId) {
      return NextResponse.json(
        { error: '개발 단계 담당자만 이 전환을 수행할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 개발 단계 상태 업데이트
    const newStatus = transition.to_status_name
    if (!phases.development) {
      phases.development = {}
    }
    phases.development.status = newStatus

    // phases JSON 업데이트
    await pool.query(
      'UPDATE project_children SET phases = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(phases), taskId]
    )

    return NextResponse.json({
      success: true,
      message: `개발 단계 상태가 ${currentStatus}에서 ${newStatus}로 변경되었습니다.`,
      task_id: taskId,
      phase: 'development',
      old_status: currentStatus,
      new_status: newStatus,
      transition_name: transition.name,
    })
  } catch (error) {
    console.error('Error executing development phase transition:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `상태 전환 실패: ${errorMessage}` },
      { status: 500 }
    )
  }
}

