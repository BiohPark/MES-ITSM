import type { RowDataPacket } from 'mysql2'
import { getPool } from '@/lib/db'
import type { ProjectChild } from '@/types/project'

export function isGmpLikeTaskChild(c: ProjectChild): boolean {
  return !!(c as { kind_number?: string }).kind_number || !!(c as { isGmpRecord?: boolean }).isGmpRecord
}

export async function resolveGanttProjectIdForItsmProject(itsmProjectId: string | null): Promise<number | null> {
  if (!itsmProjectId) return null
  const pool = getPool()
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM gantt_projects WHERE canonical_project_id = ? LIMIT 1',
    [itsmProjectId]
  )
  const r = rows[0] as { id: number } | undefined
  return r?.id != null ? Number(r.id) : null
}

function toDateOnly(v: string | null | undefined): string | null {
  if (v == null || v === '') return null
  const s = String(v)
  const part = s.includes('T') ? s.split('T')[0]! : s
  return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : null
}

/** 일감 저장 후: 연결된 WBS 프로젝트가 있으면 gantt_tasks 행 UPSERT (GMP 형태 일감 제외). */
export async function syncProjectChildRowToGantt(
  itsmProjectId: string | null,
  child: ProjectChild
): Promise<void> {
  if (!itsmProjectId || isGmpLikeTaskChild(child)) return

  const ganttPid = await resolveGanttProjectIdForItsmProject(itsmProjectId)
  if (ganttPid == null) {
    await deleteGanttTaskByProjectChildId(child.id)
    return
  }

  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    const startD = toDateOnly(child.start ?? undefined)
    const dueD = toDateOnly(child.due ?? undefined)
    const progress = Math.min(100, Math.max(0, Math.round(Number(child.progress) || 0)))

    const [existing] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM gantt_tasks WHERE project_child_id = ? LIMIT 1',
      [child.id]
    )
    const ex = existing[0] as { id: number } | undefined

    if (ex) {
      await conn.query(
        `UPDATE gantt_tasks SET
          project_id = ?, name = ?, assignee = ?, start_date = ?, finish_date = ?, progress_percent = ?
         WHERE id = ?`,
        [ganttPid, child.title, child.owner || null, startD, dueD, progress, ex.id]
      )
    } else {
      const [mx] = await conn.query<RowDataPacket[]>(
        'SELECT COALESCE(MAX(sort_order), 0) AS m FROM gantt_tasks WHERE project_id = ?',
        [ganttPid]
      )
      const sortOrder = (Number((mx[0] as { m?: number })?.m) || 0) + 1
      await conn.query(
        `INSERT INTO gantt_tasks (
          project_id, project_child_id, wbs_code, outline_level, sort_order,
          name, start_date, finish_date, duration_days, progress_percent, predecessors, assignee, is_milestone
        ) VALUES (?, ?, NULL, 1, ?, ?, ?, ?, NULL, ?, NULL, ?, 0)`,
        [ganttPid, child.id, sortOrder, child.title, startD, dueD, progress, child.owner || null]
      )
    }
  } finally {
    conn.release()
  }
}

/** 일감 삭제 시 대응 WBS 행 제거 */
export async function deleteGanttTaskByProjectChildId(childId: string): Promise<void> {
  const pool = getPool()
  await pool.query('DELETE FROM gantt_tasks WHERE project_child_id = ?', [childId])
}

/** 일감이 다른 ITSM 프로젝트로 옮겨졌을 때: 기존 WBS 행의 소속 gantt project_id 조정 또는 재부착 */
export async function reconcileGanttTaskProjectForChild(
  childId: string,
  newItsmProjectId: string | null
): Promise<void> {
  const pool = getPool()
  const newGanttId = await resolveGanttProjectIdForItsmProject(newItsmProjectId)
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, project_id FROM gantt_tasks WHERE project_child_id = ? LIMIT 1',
    [childId]
  )
  const row = rows[0] as { id: number; project_id: number } | undefined
  if (!row) return

  if (newGanttId == null) {
    await pool.query('DELETE FROM gantt_tasks WHERE id = ?', [row.id])
    return
  }

  if (Number(row.project_id) !== newGanttId) {
    const [mx] = await pool.query<RowDataPacket[]>(
      'SELECT COALESCE(MAX(sort_order), 0) AS m FROM gantt_tasks WHERE project_id = ?',
      [newGanttId]
    )
    const sortOrder = (Number((mx[0] as { m?: number })?.m) || 0) + 1
    await pool.query('UPDATE gantt_tasks SET project_id = ?, sort_order = ? WHERE id = ?', [
      newGanttId,
      sortOrder,
      row.id,
    ])
  }
}

type GanttSyncFields = {
  name: string
  assignee: string | null
  startDate: string | null
  finishDate: string | null
  progressPercent: number | null
}

/** WBS 저장 후: project_child_id가 있고 gantt 프로젝트가 ITSM에 연결돼 있으면 일감 공유 필드 반영 */
export async function syncGanttRowToProjectChild(
  ganttProjectIntId: number,
  projectChildId: string,
  fields: GanttSyncFields
): Promise<void> {
  const pool = getPool()
  const [gp] = await pool.query<RowDataPacket[]>(
    'SELECT canonical_project_id FROM gantt_projects WHERE id = ?',
    [ganttProjectIntId]
  )
  const canonical = (gp[0] as { canonical_project_id?: string | null } | undefined)
    ?.canonical_project_id
  if (!canonical) return

  const [pc] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM project_children WHERE id = ? AND project_id = ? LIMIT 1',
    [projectChildId, canonical]
  )
  if (pc.length === 0) return

  const prog =
    fields.progressPercent != null
      ? Math.min(100, Math.max(0, Math.round(Number(fields.progressPercent))))
      : 0

  await pool.query(
    `UPDATE project_children
     SET title = ?, owner = ?, start = ?, due = ?, progress = ?
     WHERE id = ? AND project_id = ?`,
    [
      fields.name,
      fields.assignee ?? '',
      fields.startDate,
      fields.finishDate,
      prog,
      projectChildId,
      canonical,
    ]
  )
}
