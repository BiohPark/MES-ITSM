import { getPool } from '@/lib/db'
import type { Ticket, TicketActivityLog, TicketLink, TicketType } from '@/types/ticket'
import {
  addTicketAuditLog,
  applyOperationalPolicies,
  createTicketNotification,
  ensureTicketOperationalTables,
  evaluateTicketOperationalState,
  getTicketApprovals,
  getTicketAuditLogs,
  getTicketEscalations,
  getTicketNotifications,
} from '@/lib/ticket-ops'

function formatDateTime(value: unknown): string | undefined {
  if (!value) return undefined
  const date = value instanceof Date ? value : new Date(value as string)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

function toDbDateTime(value: unknown): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value as string)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function mapTicket(row: any): Ticket {
  let detailFields: Record<string, string> = {}
  if (row.detail_fields) {
    try {
      detailFields = typeof row.detail_fields === 'string' ? JSON.parse(row.detail_fields) : row.detail_fields
    } catch {
      detailFields = {}
    }
  }

  return {
    id: row.id,
    ticket_no: row.ticket_no || row.id,
    title: row.title,
    description: row.description || '',
    ticket_type: row.ticket_type,
    category: row.category || '',
    subcategory: row.subcategory || '',
    status: row.status || 'Open',
    priority: row.priority || 'P3',
    impact: row.impact || 'Medium',
    urgency: row.urgency || 'Medium',
    requester_name: row.requester_name || '',
    requester_dept: row.requester_dept || '',
    assignee_name: row.assignee_name || '',
    approver_name: row.approver_name || '',
    related_project_id: row.related_project_id || '',
    related_task_id: row.related_task_id || '',
    related_issue_id: row.related_issue_id || '',
    catalog_item_id: row.catalog_item_id || '',
    detail_fields: detailFields,
    approval_required: !!row.approval_required,
    approval_status: row.approval_status || '',
    approval_requested_at: formatDateTime(row.approval_requested_at),
    approval_completed_at: formatDateTime(row.approval_completed_at),
    priority_policy_id: row.priority_policy_id || undefined,
    sla_policy_id: row.sla_policy_id || undefined,
    sla_status: row.sla_status || '',
    sla_due_at: formatDateTime(row.sla_due_at),
    sla_breached_at: formatDateTime(row.sla_breached_at),
    opened_at: formatDateTime(row.opened_at),
    resolved_at: formatDateTime(row.resolved_at),
    closed_at: formatDateTime(row.closed_at),
    created_by: row.created_by || '',
    updated_by: row.updated_by || '',
    created_at: formatDateTime(row.created_at),
    updated_at: formatDateTime(row.updated_at),
  }
}

function mapLink(row: any): TicketLink {
  return {
    id: row.id,
    ticket_id: row.ticket_id,
    link_type: row.link_type,
    linked_entity_type: row.linked_entity_type,
    linked_entity_id: row.linked_entity_id,
    linked_entity_label: row.linked_entity_label || undefined,
    created_at: formatDateTime(row.created_at),
  }
}

function mapActivity(row: any): TicketActivityLog {
  return {
    id: row.id,
    ticket_id: row.ticket_id,
    action: row.action,
    actor_name: row.actor_name || undefined,
    message: row.message,
    created_at: formatDateTime(row.created_at),
  }
}

export async function ensureTicketTables(): Promise<void> {
  const pool = getPool()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS service_tickets (
      id VARCHAR(50) PRIMARY KEY,
      ticket_no VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      ticket_type VARCHAR(20) NOT NULL,
      category VARCHAR(100) NULL,
      subcategory VARCHAR(100) NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'Open',
      priority VARCHAR(10) NOT NULL DEFAULT 'P3',
      impact VARCHAR(20) NOT NULL DEFAULT 'Medium',
      urgency VARCHAR(20) NOT NULL DEFAULT 'Medium',
      requester_name VARCHAR(100) NOT NULL,
      requester_dept VARCHAR(100) NULL,
      assignee_name VARCHAR(100) NULL,
      approver_name VARCHAR(100) NULL,
      related_project_id VARCHAR(50) NULL,
      related_task_id VARCHAR(50) NULL,
      related_issue_id VARCHAR(50) NULL,
      detail_fields JSON NULL,
      catalog_item_id VARCHAR(50) NULL,
      approval_required TINYINT(1) NOT NULL DEFAULT 0,
      approval_status VARCHAR(50) NULL,
      approval_requested_at DATETIME NULL,
      approval_completed_at DATETIME NULL,
      priority_policy_id INT NULL,
      sla_policy_id INT NULL,
      sla_status VARCHAR(50) NULL,
      sla_due_at DATETIME NULL,
      sla_breached_at DATETIME NULL,
      opened_at DATETIME NULL,
      resolved_at DATETIME NULL,
      closed_at DATETIME NULL,
      created_by VARCHAR(100) NULL,
      updated_by VARCHAR(100) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_service_tickets_type (ticket_type),
      INDEX idx_service_tickets_status (status),
      INDEX idx_service_tickets_assignee (assignee_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS service_ticket_links (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_id VARCHAR(50) NOT NULL,
      link_type VARCHAR(50) NOT NULL DEFAULT 'related',
      linked_entity_type VARCHAR(50) NOT NULL,
      linked_entity_id VARCHAR(50) NOT NULL,
      linked_entity_label VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_service_ticket_links_ticket (ticket_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS service_ticket_activity_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_id VARCHAR(50) NOT NULL,
      action VARCHAR(50) NOT NULL,
      actor_name VARCHAR(100) NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_service_ticket_activity_logs_ticket (ticket_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // 기존 테이블에 컬럼이 없을 수 있으므로 누락 컬럼 추가 (CREATE TABLE IF NOT EXISTS는 기존 테이블 구조를 바꾸지 않음)
  const addColumnIfMissing = async (column: string, definition: string) => {
    try {
      await pool.query(`ALTER TABLE service_tickets ADD COLUMN \`${column}\` ${definition}`)
    } catch (e: any) {
      if (e?.code !== 'ER_DUP_FIELDNAME' && e?.errno !== 1060) throw e
    }
  }
  const columnsToEnsure: [string, string][] = [
    ['category', 'VARCHAR(100) NULL'],
    ['subcategory', 'VARCHAR(100) NULL'],
    ['impact', 'VARCHAR(20) NULL DEFAULT "Medium"'],
    ['urgency', 'VARCHAR(20) NULL DEFAULT "Medium"'],
    ['requester_dept', 'VARCHAR(100) NULL'],
    ['assignee_name', 'VARCHAR(100) NULL'],
    ['approver_name', 'VARCHAR(100) NULL'],
    ['related_project_id', 'VARCHAR(50) NULL'],
    ['related_task_id', 'VARCHAR(50) NULL'],
    ['related_issue_id', 'VARCHAR(50) NULL'],
    ['detail_fields', 'JSON NULL'],
    ['catalog_item_id', 'VARCHAR(50) NULL'],
    ['approval_required', 'TINYINT(1) NULL DEFAULT 0'],
    ['approval_status', 'VARCHAR(50) NULL'],
    ['approval_requested_at', 'DATETIME NULL'],
    ['approval_completed_at', 'DATETIME NULL'],
    ['priority_policy_id', 'INT NULL'],
    ['sla_policy_id', 'INT NULL'],
    ['sla_status', 'VARCHAR(50) NULL'],
    ['sla_due_at', 'DATETIME NULL'],
    ['sla_breached_at', 'DATETIME NULL'],
    ['opened_at', 'DATETIME NULL'],
    ['resolved_at', 'DATETIME NULL'],
    ['closed_at', 'DATETIME NULL'],
    ['created_by', 'VARCHAR(100) NULL'],
    ['updated_by', 'VARCHAR(100) NULL'],
  ]
  for (const [col, def] of columnsToEnsure) {
    await addColumnIfMissing(col, def)
  }

  await ensureTicketOperationalTables()
}

function getTicketPrefix(ticketType: TicketType): string {
  switch (ticketType) {
    case 'request':
      return 'SRQ'
    case 'incident':
      return 'INC'
    case 'problem':
      return 'PRB'
    case 'change':
      return 'CHG'
  }
}

export async function getNextTicketId(ticketType: TicketType): Promise<string> {
  await ensureTicketTables()
  const pool = getPool()
  const prefix = getTicketPrefix(ticketType)
  const now = new Date()
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const likePattern = `${prefix}-${yyyymm}-%`
  const [rows] = await pool.query<any[]>(
    `SELECT id FROM service_tickets WHERE id LIKE ? ORDER BY id DESC LIMIT 1`,
    [likePattern]
  )
  if (rows.length === 0) return `${prefix}-${yyyymm}-0001`
  const match = String(rows[0].id).match(/-(\d{4})$/)
  const next = match ? String(Number(match[1]) + 1).padStart(4, '0') : '0001'
  return `${prefix}-${yyyymm}-${next}`
}

export async function getTickets(ticketType?: TicketType): Promise<Ticket[]> {
  await ensureTicketTables()
  const pool = getPool()
  const [rows] = ticketType
    ? await pool.query<any[]>(`SELECT * FROM service_tickets WHERE ticket_type = ? ORDER BY created_at DESC`, [ticketType])
    : await pool.query<any[]>(`SELECT * FROM service_tickets ORDER BY created_at DESC`)

  const mapped = rows.map(mapTicket)
  return Promise.all(mapped.map((ticket) => evaluateTicketOperationalState(ticket)))
}

export async function getTicketDetail(ticketId: string): Promise<Ticket | null> {
  await ensureTicketTables()
  const pool = getPool()
  const [rows] = await pool.query<any[]>(`SELECT * FROM service_tickets WHERE id = ?`, [ticketId])
  if (rows.length === 0) return null

  const ticket = await evaluateTicketOperationalState(mapTicket(rows[0]))
  const [linkRows] = await pool.query<any[]>(`SELECT * FROM service_ticket_links WHERE ticket_id = ? ORDER BY created_at DESC`, [ticketId])
  const [activityRows] = await pool.query<any[]>(
    `SELECT * FROM service_ticket_activity_logs WHERE ticket_id = ? ORDER BY created_at DESC`,
    [ticketId]
  )

  return {
    ...ticket,
    links: linkRows.map(mapLink),
    activity_logs: activityRows.map(mapActivity),
    approvals: await getTicketApprovals(ticketId),
    notifications: await getTicketNotifications(undefined, ticketId),
    escalations: await getTicketEscalations(ticketId),
    audit_logs: await getTicketAuditLogs(ticketId),
  }
}

export async function addTicketActivityLog(ticketId: string, action: string, actorName: string | undefined, message: string): Promise<void> {
  const pool = getPool()
  await pool.query(
    `INSERT INTO service_ticket_activity_logs (ticket_id, action, actor_name, message) VALUES (?, ?, ?, ?)`,
    [ticketId, action, actorName || null, message]
  )
}

export async function createTicket(input: Ticket): Promise<void> {
  await ensureTicketTables()
  const pool = getPool()
  const operational = await applyOperationalPolicies(input)
  const ticket = { ...input, ...operational }
  const approvalRequired = ticket.ticket_type === 'change' || ticket.ticket_type === 'request' ? !!ticket.approval_required : false
  const approvalStatus = approvalRequired ? ticket.approval_status || 'Not Requested' : ''
  const approverName = approvalRequired ? ticket.approver_name || '' : ''

  await pool.query(
    `INSERT INTO service_tickets (
      id, ticket_no, title, description, ticket_type, category, subcategory, status, priority, impact, urgency,
      requester_name, requester_dept, assignee_name, approver_name, related_project_id, related_task_id, related_issue_id,
      detail_fields, catalog_item_id, approval_required, approval_status, approval_requested_at, approval_completed_at,
      priority_policy_id, sla_policy_id, sla_status, sla_due_at, sla_breached_at, opened_at, resolved_at, closed_at,
      created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ticket.id,
      ticket.ticket_no,
      ticket.title,
      ticket.description || null,
      ticket.ticket_type,
      ticket.category || null,
      ticket.subcategory || null,
      ticket.status || 'Open',
      ticket.priority || 'P3',
      ticket.impact || 'Medium',
      ticket.urgency || 'Medium',
      ticket.requester_name,
      ticket.requester_dept || null,
      ticket.assignee_name || null,
      approverName || null,
      ticket.related_project_id || null,
      ticket.related_task_id || null,
      ticket.related_issue_id || null,
      JSON.stringify(ticket.detail_fields || {}),
      ticket.catalog_item_id || null,
      approvalRequired ? 1 : 0,
      approvalStatus || null,
      toDbDateTime(ticket.approval_requested_at),
      toDbDateTime(ticket.approval_completed_at),
      ticket.priority_policy_id || null,
      ticket.sla_policy_id || null,
      ticket.sla_status || null,
      toDbDateTime(ticket.sla_due_at),
      toDbDateTime(ticket.sla_breached_at),
      toDbDateTime(ticket.opened_at || new Date()),
      toDbDateTime(ticket.resolved_at),
      toDbDateTime(ticket.closed_at),
      ticket.created_by || null,
      ticket.updated_by || null,
    ]
  )

  await addTicketActivityLog(ticket.id, 'created', ticket.created_by, '티켓이 생성되었습니다.')
  await addTicketAuditLog({
    entity_type: 'ticket',
    entity_id: ticket.id,
    ticket_id: ticket.id,
    action: 'created',
    actor_name: ticket.created_by,
    message: '티켓 생성',
  })

  if (ticket.assignee_name) {
    await createTicketNotification({
      ticket_id: ticket.id,
      notification_type: 'assignment',
      recipient_name: ticket.assignee_name,
      title: '새 티켓 할당',
      message: `${ticket.ticket_no} 티켓이 할당되었습니다.`,
    })
  }
}

export async function updateTicket(input: Ticket): Promise<void> {
  await ensureTicketTables()
  const pool = getPool()
  const operational = await applyOperationalPolicies(input)
  const ticket = { ...input, ...operational }
  const approvalRequired = ticket.ticket_type === 'change' || ticket.ticket_type === 'request' ? !!ticket.approval_required : false
  const approvalStatus = approvalRequired ? ticket.approval_status || 'Not Requested' : ''
  const approverName = approvalRequired ? ticket.approver_name || '' : ''

  await pool.query(
    `UPDATE service_tickets
     SET ticket_no = ?, title = ?, description = ?, ticket_type = ?, category = ?, subcategory = ?, status = ?, priority = ?,
         impact = ?, urgency = ?, requester_name = ?, requester_dept = ?, assignee_name = ?, approver_name = ?, related_project_id = ?,
         related_task_id = ?, related_issue_id = ?, detail_fields = ?, catalog_item_id = ?, approval_required = ?, approval_status = ?,
         approval_requested_at = ?, approval_completed_at = ?, priority_policy_id = ?, sla_policy_id = ?, sla_status = ?, sla_due_at = ?,
         sla_breached_at = ?, opened_at = ?, resolved_at = ?, closed_at = ?, updated_by = ?
     WHERE id = ?`,
    [
      ticket.ticket_no,
      ticket.title,
      ticket.description || null,
      ticket.ticket_type,
      ticket.category || null,
      ticket.subcategory || null,
      ticket.status,
      ticket.priority,
      ticket.impact,
      ticket.urgency,
      ticket.requester_name,
      ticket.requester_dept || null,
      ticket.assignee_name || null,
      approverName || null,
      ticket.related_project_id || null,
      ticket.related_task_id || null,
      ticket.related_issue_id || null,
      JSON.stringify(ticket.detail_fields || {}),
      ticket.catalog_item_id || null,
      approvalRequired ? 1 : 0,
      approvalStatus || null,
      toDbDateTime(ticket.approval_requested_at),
      toDbDateTime(ticket.approval_completed_at),
      ticket.priority_policy_id || null,
      ticket.sla_policy_id || null,
      ticket.sla_status || null,
      toDbDateTime(ticket.sla_due_at),
      toDbDateTime(ticket.sla_breached_at),
      toDbDateTime(ticket.opened_at),
      toDbDateTime(ticket.resolved_at),
      toDbDateTime(ticket.closed_at),
      ticket.updated_by || null,
      ticket.id,
    ]
  )

  await addTicketActivityLog(ticket.id, 'updated', ticket.updated_by, '티켓이 수정되었습니다.')
  await addTicketAuditLog({
    entity_type: 'ticket',
    entity_id: ticket.id,
    ticket_id: ticket.id,
    action: 'updated',
    actor_name: ticket.updated_by,
    message: '티켓 수정',
  })
}

export async function deleteTicket(ticketId: string, actorName?: string): Promise<void> {
  await ensureTicketTables()
  const pool = getPool()
  await addTicketAuditLog({
    entity_type: 'ticket',
    entity_id: ticketId,
    ticket_id: ticketId,
    action: 'deleted',
    actor_name: actorName,
    message: '티켓 삭제',
  })
  await pool.query(`DELETE FROM service_tickets WHERE id = ?`, [ticketId])
}

export async function addTicketLink(ticketId: string, link: Omit<TicketLink, 'id' | 'ticket_id' | 'created_at'>, actorName?: string): Promise<void> {
  const pool = getPool()
  await pool.query(
    `INSERT INTO service_ticket_links (ticket_id, link_type, linked_entity_type, linked_entity_id, linked_entity_label)
     VALUES (?, ?, ?, ?, ?)`,
    [ticketId, link.link_type, link.linked_entity_type, link.linked_entity_id, link.linked_entity_label || null]
  )
  await addTicketAuditLog({
    entity_type: 'ticket',
    entity_id: ticketId,
    ticket_id: ticketId,
    action: 'link_added',
    actor_name: actorName,
    message: `관련 링크 추가: ${link.linked_entity_type} ${link.linked_entity_id}`,
  })
}

export async function deleteTicketLink(linkId: number, actorName?: string): Promise<void> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(`SELECT * FROM service_ticket_links WHERE id = ?`, [linkId])
  if (rows.length === 0) return
  const row = rows[0]
  await pool.query(`DELETE FROM service_ticket_links WHERE id = ?`, [linkId])
  await addTicketAuditLog({
    entity_type: 'ticket',
    entity_id: row.ticket_id,
    ticket_id: row.ticket_id,
    action: 'link_deleted',
    actor_name: actorName,
    message: `관련 링크 삭제: ${row.linked_entity_type} ${row.linked_entity_id}`,
  })
}
