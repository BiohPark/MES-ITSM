import { NextRequest, NextResponse } from 'next/server'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getPool } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getAccountById } from '@/lib/accounts'
import { syncGanttRowToProjectChild } from '@/lib/gantt-project-child-sync'

// 특정 Gantt 프로젝트의 태스크 목록 조회 및 저장

// DB DATE/TIMESTAMP → YYYY-MM-DD (로컬 기준)로 변환
function normalizeDbDate(value: unknown): string | null {
  if (value == null) return null

  // JS Date 인스턴스인 경우: 로컬 기준으로 연-월-일 추출
  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  if (typeof value === 'string') {
    // ISO 문자열 등에서 앞부분 YYYY-MM-DD만 사용
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      const [, y, m, d] = match
      return `${y}-${m}-${d}`
    }
  }

  return null
}

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
        progress_percent as progressPercent,
        predecessors,
        assignee,
        is_milestone as isMilestone,
        project_child_id as projectChildId
      FROM gantt_tasks
      WHERE project_id = ?
      ORDER BY sort_order ASC, id ASC
      `,
      [params.projectId]
    )

    // 날짜 필드는 모두 YYYY-MM-DD로 정규화하여 프론트로 전달 (빌드/저장 반복 시 하루씩 밀리는 현상 방지)
    const tasks = rows.map((row) => ({
      ...row,
      startDate: normalizeDbDate(row.startDate),
      finishDate: normalizeDbDate(row.finishDate),
    }))

    return NextResponse.json({ tasks })
  } catch (error: any) {
    console.error('[gantt/tasks][GET] 오류:', error)
    return NextResponse.json(
      { error: 'Failed to load Gantt tasks', details: error.message },
      { status: 500 }
    )
  }
}

// 전체 태스크 배열을 받아 일괄 저장 (WBS 수정 권한 필요, 이력 기록)
export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }
    const account = await getAccountById(session.userId)
    const canEditWbs = session.role === 'admin' || !!session.isAdmin || !!account?.can_edit_wbs
    if (!canEditWbs) {
      return NextResponse.json(
        { error: 'WBS 수정 권한이 없습니다. 관리자에게 권한 부여를 요청하세요.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { tasks } = body as {
      tasks: Array<{
        id?: number
        projectChildId?: string | null
        wbsCode?: string | null
        outlineLevel: number
        sortOrder: number
        name: string
        startDate?: string | null
        finishDate?: string | null
        durationDays?: number | null
        progressPercent?: number | null
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

    const projectId = parseInt(String(params.projectId), 10)
    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      )
    }
    const pool = getPool()
    const conn = await pool.getConnection()

    try {
      await conn.beginTransaction()

      const toDateStr = (d: unknown): string | null => {
        if (d == null || d === '') return null
        const s = typeof d === 'string' ? d : (d instanceof Date ? d.toISOString() : String(d))
        const part = s.split('T')[0]
        return part && /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : null
      }

      const keptIds: number[] = []

      if (tasks.length === 0) {
        await conn.query(`DELETE FROM gantt_tasks WHERE project_id = ?`, [projectId])
      } else {
        for (let i = 0; i < tasks.length; i++) {
          const t = tasks[i]
          const name = t.name != null ? String(t.name) : ''
          const startDate = toDateStr(t.startDate)
          const finishDate = toDateStr(t.finishDate)
          const progressPercent =
            t.progressPercent != null
              ? Math.min(100, Math.max(0, Math.round(Number(t.progressPercent))))
              : null
          const projectChildId =
            t.projectChildId != null && String(t.projectChildId).trim() !== ''
              ? String(t.projectChildId).trim()
              : null

          const commonUpdate = [
            t.wbsCode ?? null,
            t.outlineLevel ?? 1,
            t.sortOrder ?? i + 1,
            name,
            startDate,
            finishDate,
            t.durationDays ?? null,
            progressPercent,
            t.predecessors ?? null,
            t.assignee ?? null,
            t.isMilestone ? 1 : 0,
            projectChildId,
          ] as const

          let rowId: number | null = null

          if (t.id != null && Number.isFinite(Number(t.id))) {
            const idNum = Number(t.id)
            const [byIdRows] = await conn.query<RowDataPacket[]>(
              'SELECT id FROM gantt_tasks WHERE id = ? AND project_id = ?',
              [idNum, projectId]
            )
            if (byIdRows.length > 0) {
              await conn.query(
                `UPDATE gantt_tasks SET
                  wbs_code = ?, outline_level = ?, sort_order = ?, name = ?, start_date = ?, finish_date = ?,
                  duration_days = ?, progress_percent = ?, predecessors = ?, assignee = ?, is_milestone = ?, project_child_id = ?
                 WHERE id = ?`,
                [...commonUpdate, idNum]
              )
              rowId = idNum
            }
          }

          if (rowId == null && projectChildId) {
            const [byPcRows] = await conn.query<RowDataPacket[]>(
              'SELECT id, project_id FROM gantt_tasks WHERE project_child_id = ?',
              [projectChildId]
            )
            const hit = byPcRows[0] as
              | { id: number; project_id: number }
              | undefined
            if (hit) {
              if (Number(hit.project_id) !== projectId) {
                await conn.query(`UPDATE gantt_tasks SET project_id = ? WHERE id = ?`, [
                  projectId,
                  hit.id,
                ])
              }
              await conn.query(
                `UPDATE gantt_tasks SET
                  wbs_code = ?, outline_level = ?, sort_order = ?, name = ?, start_date = ?, finish_date = ?,
                  duration_days = ?, progress_percent = ?, predecessors = ?, assignee = ?, is_milestone = ?, project_child_id = ?
                 WHERE id = ?`,
                [...commonUpdate, hit.id]
              )
              rowId = hit.id
            }
          }

          if (rowId == null) {
            const [ins] = await conn.query<ResultSetHeader>(
              `
              INSERT INTO gantt_tasks
                (project_id, project_child_id, wbs_code, outline_level, sort_order, name, start_date, finish_date, duration_days, progress_percent, predecessors, assignee, is_milestone)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `,
              [
                projectId,
                projectChildId,
                t.wbsCode ?? null,
                t.outlineLevel ?? 1,
                t.sortOrder ?? i + 1,
                name,
                startDate,
                finishDate,
                t.durationDays ?? null,
                progressPercent,
                t.predecessors ?? null,
                t.assignee ?? null,
                t.isMilestone ? 1 : 0,
              ]
            )
            rowId = ins.insertId
          }

          keptIds.push(rowId!)
        }

        const placeholders = keptIds.map(() => '?').join(',')
        await conn.query(
          `DELETE FROM gantt_tasks WHERE project_id = ? AND id NOT IN (${placeholders})`,
          [projectId, ...keptIds]
        )
      }

      await conn.commit()

      // 수정 이력 기록 (gantt_wbs_history)
      try {
        const [projRows] = await pool.query<any[]>(
          'SELECT name FROM gantt_projects WHERE id = ?',
          [projectId]
        )
        const projectName = projRows?.[0]?.name ?? `Project #${projectId}`
        await pool.query(
          `INSERT INTO gantt_wbs_history (project_id, project_name, user_id, user_name, action) VALUES (?, ?, ?, ?, 'save')`,
          [projectId, projectName, session.userId, session.name ?? session.username ?? session.userId]
        )
      } catch (histErr) {
        console.error('[gantt/tasks] history insert failed:', histErr)
      }

      const toDateStrPost = (d: unknown): string | null => {
        if (d == null || d === '') return null
        const s = typeof d === 'string' ? d : (d instanceof Date ? d.toISOString() : String(d))
        const part = s.split('T')[0]
        return part && /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : null
      }
      for (const t of tasks) {
        const pcId =
          t.projectChildId != null && String(t.projectChildId).trim() !== ''
            ? String(t.projectChildId).trim()
            : null
        if (!pcId) continue
        try {
          await syncGanttRowToProjectChild(projectId, pcId, {
            name: t.name != null ? String(t.name) : '',
            assignee: t.assignee != null ? String(t.assignee) : null,
            startDate: toDateStrPost(t.startDate),
            finishDate: toDateStrPost(t.finishDate),
            progressPercent:
              t.progressPercent != null
                ? Math.min(100, Math.max(0, Math.round(Number(t.progressPercent))))
                : null,
          })
        } catch (syncErr) {
          console.error('[gantt/tasks] project_child sync failed:', syncErr)
        }
      }

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


