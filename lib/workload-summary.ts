import { getPool, getAllActionItems } from './db'
import type { RowDataPacket } from 'mysql2/promise'

export type WorkloadCounts = {
  projectTasks: number
  gmpRecords: number
  issues: number
  tickets: number
  ganttTasks: number
  actionItems: number
  total: number
}

export type UserWorkloadRow = {
  userId: string
  name: string
  username: string
  departmentId: number | null
  departmentName: string | null
  counts: WorkloadCounts
}

export type DepartmentWorkloadRow = {
  departmentId: number | null
  departmentName: string
  userCount: number
  counts: WorkloadCounts
}

function emptyCounts(): WorkloadCounts {
  return {
    projectTasks: 0,
    gmpRecords: 0,
    issues: 0,
    tickets: 0,
    ganttTasks: 0,
    actionItems: 0,
    total: 0,
  }
}

function sumCounts(a: WorkloadCounts): number {
  return (
    a.projectTasks +
    a.gmpRecords +
    a.issues +
    a.tickets +
    a.ganttTasks +
    a.actionItems
  )
}

async function safeQuery<T extends RowDataPacket>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const pool = getPool()
  try {
    const [rows] = await pool.query<T[]>(sql, params)
    return rows || []
  } catch (e: any) {
    if (e?.code === 'ER_NO_SUCH_TABLE') return []
    throw e
  }
}

/** owner/assignee 문자열 → 해당 사용자 id (users.name 또는 users.username 일치) */
function buildOwnerToUserId(
  users: Array<{ id: string; name: string; username?: string | null }>
): Map<string, string> {
  const m = new Map<string, string>()
  for (const u of users) {
    const n = String(u.name || '').trim()
    const un = String(u.username || '').trim()
    if (n) m.set(n, u.id)
    if (un) m.set(un, u.id)
  }
  return m
}

/**
 * 진행 중 할당 건수 집계 (내 할당 API와 동일한 필터 기준)
 */
export async function getWorkloadSummary(): Promise<{
  byUser: UserWorkloadRow[]
  byDepartment: DepartmentWorkloadRow[]
}> {
  const pool = getPool()
  let userRows: RowDataPacket[]
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.name, u.username, u.department_id,
              d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       ORDER BY COALESCE(d.sort_order, 999) ASC, d.name ASC, u.name ASC`
    )
    userRows = rows || []
  } catch {
    const [fallback] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, username, NULL AS department_id, NULL AS department_name FROM users ORDER BY name ASC`
    )
    userRows = fallback || []
  }

  const users = (userRows || []).map((r) => ({
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    username: r.username != null ? String(r.username) : '',
    departmentId: r.department_id != null ? Number(r.department_id) : null,
    departmentName: r.department_name != null ? String(r.department_name) : null,
  }))

  const ownerToUserId = buildOwnerToUserId(users)
  const userCounts = new Map<string, WorkloadCounts>()
  for (const u of users) {
    userCounts.set(u.id, emptyCounts())
  }

  const add = (ownerKey: string, field: keyof Omit<WorkloadCounts, 'total'>, n: number) => {
    const uid = ownerToUserId.get(String(ownerKey || '').trim())
    if (!uid) return
    const c = userCounts.get(uid)
    if (!c) return
    c[field] += n
  }

  const finalizeTotals = () => {
    for (const c of userCounts.values()) {
      c.total = sumCounts(c)
    }
  }

  const pt = await safeQuery<RowDataPacket>(
    `
    SELECT pc.owner AS ownerKey, COUNT(*) AS c
    FROM project_children pc
    WHERE pc.owner IS NOT NULL AND pc.owner != ''
      AND pc.id NOT LIKE 'GMP-%'
      AND pc.status NOT IN ('Completed', 'Dropped')
    GROUP BY pc.owner
    `
  )
  pt.forEach((row) => add(String(row.ownerKey), 'projectTasks', Number(row.c) || 0))

  const gr = await safeQuery<RowDataPacket>(
    `
    SELECT gr.owner AS ownerKey, COUNT(*) AS c
    FROM gmp_records gr
    WHERE gr.owner IS NOT NULL AND gr.owner != ''
      AND gr.status NOT IN ('Completed')
    GROUP BY gr.owner
    `
  )
  gr.forEach((row) => add(String(row.ownerKey), 'gmpRecords', Number(row.c) || 0))

  const iss = await safeQuery<RowDataPacket>(
    `
    SELECT i.owner AS ownerKey, COUNT(*) AS c
    FROM issues i
    WHERE i.owner IS NOT NULL AND i.owner != ''
      AND i.status NOT IN ('Resolved', 'Closed')
    GROUP BY i.owner
    `
  )
  iss.forEach((row) => add(String(row.ownerKey), 'issues', Number(row.c) || 0))

  const tk = await safeQuery<RowDataPacket>(
    `
    SELECT st.assignee_name AS ownerKey, COUNT(*) AS c
    FROM service_tickets st
    WHERE st.assignee_name IS NOT NULL AND st.assignee_name != ''
      AND st.status NOT IN ('Resolved', 'Closed', 'Completed')
    GROUP BY st.assignee_name
    `
  )
  tk.forEach((row) => add(String(row.ownerKey), 'tickets', Number(row.c) || 0))

  const gt = await safeQuery<RowDataPacket>(
    `
    SELECT gt.assignee AS ownerKey, COUNT(*) AS c
    FROM gantt_tasks gt
    WHERE gt.assignee IS NOT NULL AND gt.assignee != ''
      AND COALESCE(gt.progress_percent, 0) < 100
    GROUP BY gt.assignee
    `
  )
  gt.forEach((row) => add(String(row.ownerKey), 'ganttTasks', Number(row.c) || 0))

  try {
    const aiList = await getAllActionItems()
    const byAssignee = new Map<string, number>()
    for (const it of aiList) {
      if (it.status === 'completed') continue
      const a = String(it.assignee || '').trim()
      if (!a) continue
      byAssignee.set(a, (byAssignee.get(a) || 0) + 1)
    }
    for (const [assignee, cnt] of byAssignee) {
      add(assignee, 'actionItems', cnt)
    }
  } catch {
    /* 회의 액션 없음 */
  }

  finalizeTotals()

  const byUser: UserWorkloadRow[] = users.map((u) => ({
    userId: u.id,
    name: u.name,
    username: u.username,
    departmentId: u.departmentId,
    departmentName: u.departmentName,
    counts: userCounts.get(u.id) || emptyCounts(),
  }))

  const deptMap = new Map<string, { departmentId: number | null; departmentName: string; userCount: number; counts: WorkloadCounts }>()
  for (const u of byUser) {
    const key = u.departmentId != null ? `id:${u.departmentId}` : 'none'
    const dname = u.departmentName || '(부서 없음)'
    if (!deptMap.has(key)) {
      deptMap.set(key, {
        departmentId: u.departmentId,
        departmentName: dname,
        userCount: 0,
        counts: emptyCounts(),
      })
    }
    const bucket = deptMap.get(key)!
    bucket.userCount += 1
    const c = u.counts
    bucket.counts.projectTasks += c.projectTasks
    bucket.counts.gmpRecords += c.gmpRecords
    bucket.counts.issues += c.issues
    bucket.counts.tickets += c.tickets
    bucket.counts.ganttTasks += c.ganttTasks
    bucket.counts.actionItems += c.actionItems
  }
  for (const b of deptMap.values()) {
    b.counts.total = sumCounts(b.counts)
  }

  const byDepartment: DepartmentWorkloadRow[] = Array.from(deptMap.values()).sort(
    (a, b) => b.counts.total - a.counts.total
  )

  return { byUser, byDepartment }
}
