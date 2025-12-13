import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getSession } from '@/lib/auth'

/**
 * GET /api/tasks/{taskId}/phases/development/transitions
 * 개발 단계의 사용 가능한 전환 목록 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const taskId = params.taskId
    const pool = getPool()

    // Task 조회 (project_children 테이블에서)
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
    if (task.phases) {
      try {
        const phases = typeof task.phases === 'string' ? JSON.parse(task.phases) : task.phases
        currentStatus = phases?.development?.status || 'Planning'
      } catch (e) {
        // JSON 파싱 실패 시 기본값 사용
      }
    }

    // 세션에서 사용자 정보 가져오기
    const session = await getSession()
    const userRole = session?.role || null
    const userId = session?.userId || null

    // 개발 단계 전용 워크플로우 조회
    const [workflows] = await pool.query<any[]>(
      "SELECT id FROM workflows WHERE name = 'Development Phase Workflow' AND is_active = 1"
    )

    if (workflows.length === 0) {
      return NextResponse.json({
        task_id: taskId,
        phase: 'development',
        current_status: currentStatus,
        available_transitions: [],
        message: '개발 단계 워크플로우가 설정되지 않았습니다. 워크플로우를 먼저 생성해주세요.',
      })
    }

    const workflowId = workflows[0].id

    // 워크플로우 전환 조회 (workflow_transitions 테이블)
    // 개발 단계 전용 워크플로우의 현재 상태에서 나가는 전환들 조회
    const [transitions] = await pool.query<any[]>(
      `SELECT 
        t.id,
        t.name,
        t.from_status_id,
        t.to_status_id,
        fs.name AS from_status_name,
        ts.name AS to_status_name,
        t.description,
        t.\`condition\`,
        t.display_order
      FROM workflow_transitions t
      INNER JOIN workflow_statuses fs ON t.from_status_id = fs.id
      INNER JOIN workflow_statuses ts ON t.to_status_id = ts.id
      WHERE t.workflow_id = ? AND fs.name = ? AND t.is_active = 1
      ORDER BY t.display_order, t.name`,
      [workflowId, currentStatus]
    )

    // 조건 검사하여 필터링
    const availableTransitions = transitions.filter((transition) => {
      const condition = transition.condition ? JSON.parse(transition.condition as string) : {}
      
      // 역할 기반 권한 체크
      if (condition.required_roles && Array.isArray(condition.required_roles)) {
        if (!userRole || !condition.required_roles.includes(userRole)) {
          return false
        }
      }

      // 사용자 기반 권한 체크
      if (condition.required_users && Array.isArray(condition.required_users)) {
        if (!userId || !condition.required_users.includes(userId)) {
          return false
        }
      }

      // 개발 단계 담당자 체크
      let devOwner = null
      if (task.phases) {
        try {
          const phases = typeof task.phases === 'string' ? JSON.parse(task.phases) : task.phases
          devOwner = phases?.development?.owner || null
        } catch (e) {
          // JSON 파싱 실패 시 무시
        }
      }

      if (condition.owner_only && devOwner && devOwner !== userId) {
        return false
      }

      return true
    })

    // 응답 형식 변환
    const transitionsData = availableTransitions.map((t) => ({
      id: t.id,
      name: t.name,
      to_status_id: t.to_status_id,
      to_status_name: t.to_status_name,
      description: t.description || null,
    }))

    return NextResponse.json({
      task_id: taskId,
      phase: 'development',
      current_status: currentStatus,
      available_transitions: transitionsData,
    })
  } catch (error) {
    console.error('Error fetching development phase transitions:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `전환 목록 조회 실패: ${errorMessage}` },
      { status: 500 }
    )
  }
}

