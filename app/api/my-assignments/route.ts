import { NextResponse } from 'next/server'
import { getPool, getAllActionItems } from '@/lib/db'
import { getSession } from '@/lib/auth'
import type { MyAssignmentItem } from '@/types/assignment'

type AssignmentsCacheEntry = {
  cachedAt: number
  items: MyAssignmentItem[]
}

type AssignmentsCacheState = typeof globalThis & {
  __itsmMyAssignmentsCache?: Map<string, AssignmentsCacheEntry>
}

const CACHE_TTL_MS = 15_000
const assignmentsCacheState = globalThis as AssignmentsCacheState
const myAssignmentsCache =
  assignmentsCacheState.__itsmMyAssignmentsCache ??
  (assignmentsCacheState.__itsmMyAssignmentsCache = new Map<string, AssignmentsCacheEntry>())

type SortableAssignment = MyAssignmentItem & {
  sortDueDate: string | null
}

function uniqueNames(values: Array<string | undefined | null>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  )
}

function toDateString(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    return value.includes('T') ? value.split('T')[0] : value
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  return String(value)
}

function sortAssignments(items: SortableAssignment[]) {
  return items
    .sort((a, b) => {
      if (a.sortDueDate && b.sortDueDate) {
        return a.sortDueDate.localeCompare(b.sortDueDate)
      }
      if (a.sortDueDate) return -1
      if (b.sortDueDate) return 1
      return a.label.localeCompare(b.label, 'ko-KR')
    })
    .map(({ sortDueDate: _sortDueDate, ...item }) => item)
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const assigneeNames = uniqueNames([session.name, session.username])
    if (assigneeNames.length === 0) {
      return NextResponse.json({ items: [] })
    }

    const cacheKey = [session.userId, session.username, session.name].join('|')
    const cached = myAssignmentsCache.get(cacheKey)
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return NextResponse.json({ items: cached.items })
    }

    const placeholders = assigneeNames.map(() => '?').join(', ')
    const pool = getPool()
    const items: SortableAssignment[] = []

    const querySafe = async <T>(query: string, params: unknown[]) => {
      try {
        const [rows] = await pool.query(query, params)
        return rows as T[]
      } catch (error: any) {
        if (error?.code === 'ER_NO_SUCH_TABLE') {
          return []
        }
        throw error
      }
    }

    const projectTasks = await querySafe<any>(
      `
      SELECT
        pc.id,
        pc.title,
        pc.status,
        pc.due,
        pc.project_id as projectId,
        p.name as projectName
      FROM project_children pc
      LEFT JOIN projects p ON p.id = pc.project_id
      WHERE pc.owner IN (${placeholders})
        AND pc.id NOT LIKE 'GMP-%'
        AND pc.status NOT IN ('Completed', 'Dropped')
      ORDER BY pc.due ASC, pc.created_at DESC
      LIMIT 100
      `,
      assigneeNames
    )

    const gmpRecords = await querySafe<any>(
      `
      SELECT
        gr.id,
        gr.title,
        gr.status,
        gr.due,
        gr.project_id as projectId,
        p.name as projectName,
        gr.kind_number as kindNumber
      FROM gmp_records gr
      LEFT JOIN projects p ON p.id = gr.project_id
      WHERE gr.owner IN (${placeholders})
        AND gr.status NOT IN ('Completed')
      ORDER BY gr.due ASC, gr.created_at DESC
      LIMIT 100
      `,
      assigneeNames
    )

    const issues = await querySafe<any>(
      `
      SELECT id, title, status, due_date as dueDate
      FROM issues
      WHERE owner IN (${placeholders})
        AND status NOT IN ('Resolved', 'Closed')
      ORDER BY due_date ASC, created_at DESC
      LIMIT 100
      `,
      assigneeNames
    )

    const tickets = await querySafe<any>(
      `
      SELECT id, title, ticket_type as ticketType, status, assignee_name as assigneeName, sla_due_at as dueDate
      FROM service_tickets
      WHERE assignee_name IN (${placeholders})
        AND status NOT IN ('Resolved', 'Closed', 'Completed')
      ORDER BY sla_due_at ASC, created_at DESC
      LIMIT 100
      `,
      assigneeNames
    )

    const ganttTasks = await querySafe<any>(
      `
      SELECT
        gt.id,
        gt.name,
        gt.assignee,
        gt.finish_date as finishDate,
        gt.progress_percent as progressPercent,
        gt.project_id as projectId,
        gp.name as projectName
      FROM gantt_tasks gt
      INNER JOIN gantt_projects gp ON gp.id = gt.project_id
      WHERE gt.assignee IN (${placeholders})
        AND COALESCE(gt.progress_percent, 0) < 100
      ORDER BY gt.finish_date ASC, gt.updated_at DESC
      LIMIT 100
      `,
      assigneeNames
    )

    const actionItemsResults = await getAllActionItems()

    projectTasks.forEach((task) => {
      items.push({
        id: String(task.id),
        kind: 'project-task',
        label: '일감',
        title: String(task.title || task.id),
        subtitle: task.projectName ? `프로젝트: ${task.projectName}` : '프로젝트 미배정',
        status: task.status ? String(task.status) : undefined,
        dueDate: toDateString(task.due),
        sortDueDate: toDateString(task.due),
        url: `/?tab=tasks&taskId=${encodeURIComponent(String(task.id))}`,
      })
    })

    gmpRecords.forEach((record) => {
      items.push({
        id: String(record.id),
        kind: 'gmp-record',
        label: 'GMP',
        title: String(record.title || record.id),
        subtitle: [record.projectName ? `프로젝트: ${record.projectName}` : '프로젝트 미배정', record.kindNumber ? `번호: ${record.kindNumber}` : '']
          .filter(Boolean)
          .join(' / '),
        status: record.status ? String(record.status) : undefined,
        dueDate: toDateString(record.due),
        sortDueDate: toDateString(record.due),
        url: `/?tab=gmp-record&recordId=${encodeURIComponent(String(record.id))}`,
      })
    })

    issues.forEach((issue) => {
      items.push({
        id: String(issue.id),
        kind: 'issue',
        label: '이슈',
        title: String(issue.title || issue.id),
        subtitle: `이슈 ID: ${issue.id}`,
        status: issue.status ? String(issue.status) : undefined,
        dueDate: toDateString(issue.dueDate),
        sortDueDate: toDateString(issue.dueDate),
        url: `/?tab=issues&issueId=${encodeURIComponent(String(issue.id))}`,
      })
    })

    tickets.forEach((ticket) => {
      items.push({
        id: String(ticket.id),
        kind: 'ticket',
        label: String(ticket.ticketType || 'ticket').toUpperCase(),
        title: String(ticket.title || ticket.id),
        subtitle: `티켓 ID: ${ticket.id}`,
        status: ticket.status ? String(ticket.status) : undefined,
        dueDate: toDateString(ticket.dueDate),
        sortDueDate: toDateString(ticket.dueDate),
        url: `/?tab=${encodeURIComponent(String(ticket.ticketType || 'incident'))}&ticketId=${encodeURIComponent(String(ticket.id))}`,
      })
    })

    ganttTasks.forEach((task) => {
      items.push({
        id: String(task.id),
        kind: 'gantt-task',
        label: 'WBS',
        title: String(task.name || `Gantt Task #${task.id}`),
        subtitle: task.projectName ? `WBS 관리: ${task.projectName}` : 'WBS 관리',
        status: typeof task.progressPercent === 'number' ? `${Math.round(task.progressPercent)}%` : undefined,
        dueDate: toDateString(task.finishDate),
        sortDueDate: toDateString(task.finishDate),
        url: `/?tab=gantt&ganttProjectId=${encodeURIComponent(String(task.projectId))}`,
      })
    })

    const assigneeNameSet = new Set(assigneeNames)
    const mergedActionItems = new Map<string, (typeof actionItemsResults)[number]>()
    actionItemsResults
      .filter((item) => assigneeNameSet.has(String(item.assignee || '').trim()))
      .forEach((item) => {
      const key = `${item.meeting_note_id}:${item.id}`
      if (!mergedActionItems.has(key)) {
        mergedActionItems.set(key, item)
      }
      })

    Array.from(mergedActionItems.values())
      .filter((item) => item.status !== 'completed')
      .forEach((item) => {
        items.push({
          id: String(item.id),
          kind: 'action-item',
          label: '액션',
          title: String(item.description || item.id),
          subtitle: item.meeting_title ? `회의록: ${item.meeting_title}` : `회의록: ${item.meeting_note_id}`,
          status: item.status,
          dueDate: toDateString(item.due_date),
          sortDueDate: toDateString(item.due_date),
          url: `/?tab=meetings&meetingNoteId=${encodeURIComponent(String(item.meeting_note_id))}`,
        })
      })

    const responseItems = sortAssignments(items).slice(0, 60)
    myAssignmentsCache.set(cacheKey, {
      cachedAt: Date.now(),
      items: responseItems,
    })
    return NextResponse.json({ items: responseItems })
  } catch (error: any) {
    if (error?.code === 'ER_CON_COUNT_ERROR') {
      const session = await getSession().catch(() => null)
      const cacheKey = session ? [session.userId, session.username, session.name].join('|') : null
      const cached = cacheKey ? myAssignmentsCache.get(cacheKey) : null
      if (cached) {
        return NextResponse.json({ items: cached.items, stale: true })
      }
      return NextResponse.json({ items: [], stale: true })
    }
    console.error('[my-assignments][GET] 오류:', error)
    return NextResponse.json(
      { error: '내 할당 업무 조회 실패', details: error.message },
      { status: 500 }
    )
  }
}
