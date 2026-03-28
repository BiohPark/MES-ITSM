import { getPool, getAllActionItems } from './db'

export type WorkloadUserBreakdown = {
  userId: string
  name: string
  username: string
  departmentId: number | null
  departmentName: string | null
  projectTasks: number
  gmpRecords: number
  issues: number
  tickets: number
  ganttTasks: number
  actionItems: number
  total: number
}

export type WorkloadDeptSummary = {
  departmentId: number | null
  departmentName: string
  memberCount: number
  totalAssignments: number
}

function safeQuery<T>(pool: ReturnType<typeof getPool>, sql: string, params: unknown[]): Promise<T[]> {
  return pool
    .query(sql, params)
    .then(([rows]) => rows as T[])
    .catch((e: any) => {
      if (e?.code === 'ER_NO_SUCH_TABLE') return Promise.resolve([] as T[])
      throw e
    })
}

/**
 * 로그인 사용자별 미완료 일감 건수 집계 (이름·username 과제 매칭 방식은 my-assignments와 동일)
 */
export async function getWorkloadSummary(): Promise<{
  users: WorkloadUserBreakdown[]
  departments: WorkloadDeptSummary[]
}> {
  const pool = getPool()

  type URow = {
    id: string
    name: string
    username: string | null
    department_id: number | null
    department_name: string | null
  }

  let userRows: URow[] = []
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.username, u.department_id,
              d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       ORDER BY d.sort_order, d.name, u.name`
    )
    userRows = (rows as URow[]) || []
  } catch (e: any) {
    if (e?.code === 'ER_BAD_FIELD_ERROR') {
      const [rows] = await pool.query(
        `SELECT id, name, username, NULL AS department_id, NULL AS department_name FROM users ORDER BY name`
      )
      userRows = ((rows as URow[]) || []).map((r) => ({ ...r, department_id: null, department_name: null }))
    } else {
      throw e
    }
  }

  const actionItemsAll = await getAllActionItems().catch(() => [] as Awaited<ReturnType<typeof getAllActionItems>>)

  const users: WorkloadUserBreakdown[] = []

  for (const u of userRows) {
    const assigneeNames = Array.from(
      new Set([String(u.name || '').trim(), String(u.username || '').trim()].filter(Boolean))
    )
    if (assigneeNames.length === 0) continue
    const ph = assigneeNames.map(() => '?').join(', ')

    const projectTasks = await safeQuery<{ c: number }>(
      pool,
      `
      SELECT COUNT(*) AS c FROM project_children pc
      WHERE pc.owner IN (${ph}) AND pc.id NOT LIKE 'GMP-%'
        AND pc.status NOT IN ('Completed', 'Dropped')
      `,
      assigneeNames
    )
    const gmpRecords = await safeQuery<{ c: number }>(
      pool,
      `
      SELECT COUNT(*) AS c FROM gmp_records gr
      WHERE gr.owner IN (${ph}) AND gr.status NOT IN ('Completed')
      `,
      assigneeNames
    )
    const issues = await safeQuery<{ c: number }>(
      pool,
      `SELECT COUNT(*) AS c FROM issues WHERE owner IN (${ph}) AND status NOT IN ('Resolved', 'Closed')`,
      assigneeNames
    )
    const tickets = await safeQuery<{ c: number }>(
      pool,
      `
      SELECT COUNT(*) AS c FROM service_tickets
      WHERE assignee_name IN (${ph}) AND status NOT IN ('Resolved', 'Closed', 'Completed')
      `,
      assigneeNames
    )
    const ganttTasks = await safeQuery<{ c: number }>(
      pool,
      `
      SELECT COUNT(*) AS c FROM gantt_tasks gt
      WHERE gt.assignee IN (${ph}) AND COALESCE(gt.progress_percent, 0) < 100
      `,
      assigneeNames
    )

    const nameSet = new Set(assigneeNames)
    const actionItems = actionItemsAll.filter(
      (item) => item.status !== 'completed' && nameSet.has(String(item.assignee || '').trim())
    ).length

    const pt = Number(projectTasks[0]?.c ?? 0)
    const gmp = Number(gmpRecords[0]?.c ?? 0)
    const iss = Number(issues[0]?.c ?? 0)
    const tkt = Number(tickets[0]?.c ?? 0)
    const gtt = Number(ganttTasks[0]?.c ?? 0)
    const act = actionItems

    users.push({
      userId: String(u.id),
      name: String(u.name || ''),
      username: String(u.username || ''),
      departmentId: u.department_id != null ? Number(u.department_id) : null,
      departmentName: u.department_name != null ? String(u.department_name) : null,
      projectTasks: pt,
      gmpRecords: gmp,
      issues: iss,
      tickets: tkt,
      ganttTasks: gtt,
      actionItems: act,
      total: pt + gmp + iss + tkt + gtt + act,
    })
  }

  const deptMap = new Map<string, WorkloadDeptSummary>()
  for (const u of users) {
    const key = u.departmentId != null ? `id:${u.departmentId}` : 'none'
    const dname = u.departmentName || (u.departmentId == null ? '—' : '?')
    if (!deptMap.has(key)) {
      deptMap.set(key, {
        departmentId: u.departmentId,
        departmentName: u.departmentId != null ? dname : '—',
        memberCount: 0,
        totalAssignments: 0,
      })
    }
    const entry = deptMap.get(key)!
    entry.memberCount += 1
    entry.totalAssignments += u.total
  }

  const departments = Array.from(deptMap.values()).sort((a, b) => b.totalAssignments - a.totalAssignments)

  return { users, departments }
}
