import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { parsePredecessorString, validatePredecessorString } from '@/lib/predecessor-parser'

/**
 * GET: 특정 작업의 종속성 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')
    const projectId = searchParams.get('projectId')

    if (!taskId && !projectId) {
      return NextResponse.json(
        { error: 'taskId or projectId is required' },
        { status: 400 }
      )
    }

    const pool = getPool()

    if (taskId) {
      // 특정 작업의 종속성 조회
      const [predecessors] = await pool.query<any[]>(
        `SELECT 
          p.predecessor_id,
          p.task_id as taskId,
          p.predecessor_task_id as predecessorTaskId,
          p.dependency_type as dependencyType,
          p.lag_days as lagDays,
          pc.task_index as predecessorTaskIndex
        FROM predecessors p
        JOIN project_children pc ON p.predecessor_task_id = pc.id
        WHERE p.task_id = ?
        ORDER BY pc.task_index ASC`,
        [taskId]
      )

      return NextResponse.json({ predecessors })
    } else {
      // 프로젝트의 모든 종속성 조회
      const [tasks] = await pool.query<any[]>(
        'SELECT id FROM project_children WHERE project_id = ? AND id NOT LIKE "GMP-%"',
        [projectId]
      )

      const taskIds = tasks.map(t => t.id)
      if (taskIds.length === 0) {
        return NextResponse.json({ predecessors: [] })
      }

      const placeholders = taskIds.map(() => '?').join(',')
      const [predecessors] = await pool.query<any[]>(
        `SELECT 
          p.predecessor_id,
          p.task_id as taskId,
          p.predecessor_task_id as predecessorTaskId,
          p.dependency_type as dependencyType,
          p.lag_days as lagDays,
          pc.task_index as predecessorTaskIndex,
          tc.task_index as taskIndex
        FROM predecessors p
        JOIN project_children pc ON p.predecessor_task_id = pc.id
        JOIN project_children tc ON p.task_id = tc.id
        WHERE p.task_id IN (${placeholders})
        ORDER BY tc.task_index ASC, pc.task_index ASC`,
        taskIds
      )

      return NextResponse.json({ predecessors })
    }
  } catch (error: any) {
    console.error('Error fetching predecessors:', error)
    return NextResponse.json(
      { error: 'Failed to fetch predecessors', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST: 종속성 추가/수정 (Index 기반 문자열 입력)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { taskId, projectId, predecessorString } = body

    if (!taskId || !projectId || predecessorString === undefined) {
      return NextResponse.json(
        { error: 'taskId, projectId, and predecessorString are required' },
        { status: 400 }
      )
    }

    // 문자열 검증
    const validation = validatePredecessorString(predecessorString)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // 문자열 파싱
    const parsed = parsePredecessorString(predecessorString)
    const pool = getPool()
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

      // 현재 작업의 task_index 조회
      const [currentTask] = await connection.query<any[]>(
        'SELECT task_index FROM project_children WHERE id = ?',
        [taskId]
      )

      if (currentTask.length === 0) {
        throw new Error('Task not found')
      }

      // 기존 종속성 삭제
      await connection.query(
        'DELETE FROM predecessors WHERE task_id = ?',
        [taskId]
      )

      // 새로운 종속성 추가
      for (const pred of parsed) {
        // Index를 Task ID로 변환
        // task_index가 NULL인 경우도 고려하여 ORDER BY로 정렬 후 LIMIT 사용
        const [allTasks] = await connection.query<any[]>(
          'SELECT id, task_index FROM project_children WHERE project_id = ? AND id NOT LIKE "GMP-%" ORDER BY task_index ASC, created_at ASC',
          [projectId]
        )

        // task_index가 NULL인 경우 순서대로 할당 (1부터 시작)
        const taskWithIndex = allTasks.map((task, idx) => ({
          ...task,
          displayIndex: task.task_index || (idx + 1)
        }))

        const predecessorTask = taskWithIndex.find(t => t.displayIndex === pred.index)

        if (!predecessorTask) {
          throw new Error(`Predecessor task with index ${pred.index} not found in project ${projectId}. Available indices: ${taskWithIndex.map(t => t.displayIndex).join(', ')}`)
        }

        const predecessorTaskId = predecessorTask.id

        // 자기 자신을 선행 작업으로 설정하는 것 방지
        if (predecessorTaskId === taskId) {
          throw new Error(`Cannot set task ${taskId} as its own predecessor`)
        }

        // 종속성 추가 (중복 체크)
        try {
          await connection.query(
            `INSERT INTO predecessors (task_id, predecessor_task_id, dependency_type, lag_days)
             VALUES (?, ?, ?, ?)`,
            [taskId, predecessorTaskId, pred.type, pred.lag]
          )
        } catch (insertError: any) {
          // 중복 키 오류인 경우 업데이트
          if (insertError.code === 'ER_DUP_ENTRY' || insertError.code === 1062) {
            await connection.query(
              `UPDATE predecessors 
               SET dependency_type = ?, lag_days = ?
               WHERE task_id = ? AND predecessor_task_id = ? AND dependency_type = ?`,
              [pred.type, pred.lag, taskId, predecessorTaskId, pred.type]
            )
          } else {
            throw insertError
          }
        }
      }

      await connection.commit()

      return NextResponse.json({
        success: true,
        message: 'Predecessors updated successfully',
        count: parsed.length,
      })
    } catch (error: any) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  } catch (error: any) {
    console.error('Error updating predecessors:', error)
    return NextResponse.json(
      { error: 'Failed to update predecessors', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE: 종속성 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')
    const predecessorId = searchParams.get('predecessorId')

    if (!taskId && !predecessorId) {
      return NextResponse.json(
        { error: 'taskId or predecessorId is required' },
        { status: 400 }
      )
    }

    const pool = getPool()

    if (predecessorId) {
      // 특정 종속성 삭제
      await pool.query('DELETE FROM predecessors WHERE predecessor_id = ?', [predecessorId])
    } else {
      // 작업의 모든 종속성 삭제
      await pool.query('DELETE FROM predecessors WHERE task_id = ?', [taskId])
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting predecessors:', error)
    return NextResponse.json(
      { error: 'Failed to delete predecessors', details: error.message },
      { status: 500 }
    )
  }
}

