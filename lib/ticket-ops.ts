import { getPool } from '@/lib/db'
import type {
  PriorityPolicy,
  SlaPolicy,
  Ticket,
  TicketApproval,
  TicketAuditLog,
  TicketEscalation,
  TicketNotification,
} from '@/types/ticket'

function formatDateTime(value: unknown): string | undefined {
  if (!value) return undefined
  const date = value instanceof Date ? value : new Date(value as string)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

function toMysqlDateTime(value: Date): string {
  return value.toISOString().slice(0, 19).replace('T', ' ')
}

function isTerminalStatus(status?: string): boolean {
  return ['Resolved', 'Closed', 'Cancelled'].includes(status || '')
}

function mapNotification(row: any): TicketNotification {
  return {
    id: row.id,
    ticket_id: row.ticket_id || undefined,
    notification_type: row.notification_type,
    recipient_name: row.recipient_name,
    title: row.title,
    message: row.message,
    status: row.status,
    created_at: formatDateTime(row.created_at),
    read_at: formatDateTime(row.read_at),
  }
}

function mapEscalation(row: any): TicketEscalation {
  return {
    id: row.id,
    ticket_id: row.ticket_id,
    escalation_level: row.escalation_level,
    rule_name: row.rule_name,
    status: row.status,
    message: row.message,
    triggered_at: formatDateTime(row.triggered_at),
  }
}

function mapApproval(row: any): TicketApproval {
  return {
    id: row.id,
    ticket_id: row.ticket_id,
    step_name: row.step_name,
    approver_name: row.approver_name,
    status: row.status,
    comments: row.comments || undefined,
    requested_at: formatDateTime(row.requested_at),
    acted_at: formatDateTime(row.acted_at),
  }
}

function mapAudit(row: any): TicketAuditLog {
  return {
    id: row.id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    ticket_id: row.ticket_id || undefined,
    action: row.action,
    field_name: row.field_name || undefined,
    old_value: row.old_value || undefined,
    new_value: row.new_value || undefined,
    actor_name: row.actor_name || undefined,
    message: row.message,
    created_at: formatDateTime(row.created_at),
  }
}

export async function ensureTicketOperationalTables(): Promise<void> {
  const pool = getPool()

  await pool.query(`
    ALTER TABLE service_tickets
      ADD COLUMN IF NOT EXISTS detail_fields JSON NULL,
      ADD COLUMN IF NOT EXISTS catalog_item_id VARCHAR(50) NULL,
      ADD COLUMN IF NOT EXISTS approval_required TINYINT(1) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) NULL,
      ADD COLUMN IF NOT EXISTS approval_requested_at DATETIME NULL,
      ADD COLUMN IF NOT EXISTS approval_completed_at DATETIME NULL,
      ADD COLUMN IF NOT EXISTS approver_name VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS priority_policy_id INT NULL,
      ADD COLUMN IF NOT EXISTS sla_policy_id INT NULL,
      ADD COLUMN IF NOT EXISTS sla_status VARCHAR(50) NULL,
      ADD COLUMN IF NOT EXISTS sla_due_at DATETIME NULL,
      ADD COLUMN IF NOT EXISTS sla_breached_at DATETIME NULL
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS priority_policies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      impact VARCHAR(20) NOT NULL,
      urgency VARCHAR(20) NOT NULL,
      priority VARCHAR(10) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sla_policies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      ticket_type VARCHAR(20) NOT NULL,
      priority VARCHAR(10) NOT NULL,
      response_minutes INT NOT NULL DEFAULT 60,
      resolution_minutes INT NOT NULL DEFAULT 480,
      escalation_minutes INT NOT NULL DEFAULT 120,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_approvals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_id VARCHAR(50) NOT NULL,
      step_name VARCHAR(100) NOT NULL,
      approver_name VARCHAR(100) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'Requested',
      comments TEXT NULL,
      requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      acted_at DATETIME NULL,
      INDEX idx_ticket_approvals_ticket_id (ticket_id),
      INDEX idx_ticket_approvals_approver (approver_name),
      INDEX idx_ticket_approvals_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_id VARCHAR(50) NULL,
      notification_type VARCHAR(50) NOT NULL,
      recipient_name VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Unread',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME NULL,
      INDEX idx_ticket_notifications_recipient (recipient_name),
      INDEX idx_ticket_notifications_status (status),
      INDEX idx_ticket_notifications_ticket_id (ticket_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_escalations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_id VARCHAR(50) NOT NULL,
      escalation_level INT NOT NULL DEFAULT 1,
      rule_name VARCHAR(100) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'Triggered',
      message TEXT NOT NULL,
      triggered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ticket_escalations_ticket_id (ticket_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(50) NOT NULL,
      ticket_id VARCHAR(50) NULL,
      action VARCHAR(50) NOT NULL,
      field_name VARCHAR(100) NULL,
      old_value TEXT NULL,
      new_value TEXT NULL,
      actor_name VARCHAR(100) NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ticket_audit_logs_entity (entity_type, entity_id),
      INDEX idx_ticket_audit_logs_ticket_id (ticket_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const [priorityRows] = await pool.query<any[]>(`SELECT COUNT(*) AS count FROM priority_policies`)
  if ((priorityRows[0]?.count || 0) === 0) {
    const defaults = [
      ['Critical/Critical', 'Critical', 'Critical', 'P1'],
      ['Critical/High', 'Critical', 'High', 'P1'],
      ['High/High', 'High', 'High', 'P2'],
      ['High/Medium', 'High', 'Medium', 'P2'],
      ['Medium/Medium', 'Medium', 'Medium', 'P3'],
      ['Low/Low', 'Low', 'Low', 'P4'],
    ]
    for (const row of defaults) {
      await pool.query(
        `INSERT INTO priority_policies (name, impact, urgency, priority, is_active) VALUES (?, ?, ?, ?, 1)`,
        row
      )
    }
  }

  const [slaRows] = await pool.query<any[]>(`SELECT COUNT(*) AS count FROM sla_policies`)
  if ((slaRows[0]?.count || 0) === 0) {
    const defaults = [
      ['Request P3', 'request', 'P3', 120, 1440, 240],
      ['Request P2', 'request', 'P2', 60, 480, 120],
      ['Incident P1', 'incident', 'P1', 15, 120, 30],
      ['Incident P2', 'incident', 'P2', 30, 240, 60],
      ['Problem P2', 'problem', 'P2', 60, 1440, 240],
      ['Change P3', 'change', 'P3', 240, 2880, 720],
    ]
    for (const row of defaults) {
      await pool.query(
        `INSERT INTO sla_policies (name, ticket_type, priority, response_minutes, resolution_minutes, escalation_minutes, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        row
      )
    }
  }
}

export async function getPriorityPolicies(): Promise<PriorityPolicy[]> {
  await ensureTicketOperationalTables()
  const pool = getPool()
  const [rows] = await pool.query<any[]>(`SELECT * FROM priority_policies ORDER BY is_active DESC, id ASC`)
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    impact: row.impact,
    urgency: row.urgency,
    priority: row.priority,
    is_active: !!row.is_active,
    created_at: formatDateTime(row.created_at),
    updated_at: formatDateTime(row.updated_at),
  }))
}

export async function getSlaPolicies(): Promise<SlaPolicy[]> {
  await ensureTicketOperationalTables()
  const pool = getPool()
  const [rows] = await pool.query<any[]>(`SELECT * FROM sla_policies ORDER BY is_active DESC, id ASC`)
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    ticket_type: row.ticket_type,
    priority: row.priority,
    response_minutes: row.response_minutes,
    resolution_minutes: row.resolution_minutes,
    escalation_minutes: row.escalation_minutes,
    is_active: !!row.is_active,
    created_at: formatDateTime(row.created_at),
    updated_at: formatDateTime(row.updated_at),
  }))
}

export async function savePriorityPolicy(policy: PriorityPolicy): Promise<void> {
  await ensureTicketOperationalTables()
  const pool = getPool()
  if (policy.id) {
    await pool.query(
      `UPDATE priority_policies SET name = ?, impact = ?, urgency = ?, priority = ?, is_active = ? WHERE id = ?`,
      [policy.name, policy.impact, policy.urgency, policy.priority, policy.is_active ? 1 : 0, policy.id]
    )
    return
  }

  await pool.query(
    `INSERT INTO priority_policies (name, impact, urgency, priority, is_active) VALUES (?, ?, ?, ?, ?)`,
    [policy.name, policy.impact, policy.urgency, policy.priority, policy.is_active ? 1 : 0]
  )
}

export async function saveSlaPolicy(policy: SlaPolicy): Promise<void> {
  await ensureTicketOperationalTables()
  const pool = getPool()
  if (policy.id) {
    await pool.query(
      `UPDATE sla_policies
       SET name = ?, ticket_type = ?, priority = ?, response_minutes = ?, resolution_minutes = ?, escalation_minutes = ?, is_active = ?
       WHERE id = ?`,
      [
        policy.name,
        policy.ticket_type,
        policy.priority,
        policy.response_minutes,
        policy.resolution_minutes,
        policy.escalation_minutes,
        policy.is_active ? 1 : 0,
        policy.id,
      ]
    )
    return
  }

  await pool.query(
    `INSERT INTO sla_policies (name, ticket_type, priority, response_minutes, resolution_minutes, escalation_minutes, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      policy.name,
      policy.ticket_type,
      policy.priority,
      policy.response_minutes,
      policy.resolution_minutes,
      policy.escalation_minutes,
      policy.is_active ? 1 : 0,
    ]
  )
}

export async function deletePriorityPolicy(id: number): Promise<void> {
  const pool = getPool()
  await pool.query(`DELETE FROM priority_policies WHERE id = ?`, [id])
}

export async function deleteSlaPolicy(id: number): Promise<void> {
  const pool = getPool()
  await pool.query(`DELETE FROM sla_policies WHERE id = ?`, [id])
}

export async function resolvePriority(ticket: Partial<Ticket>): Promise<PriorityPolicy | null> {
  const policies = await getPriorityPolicies()
  return (
    policies.find(
      (policy) =>
        policy.is_active &&
        policy.impact === (ticket.impact || '') &&
        policy.urgency === (ticket.urgency || '')
    ) || null
  )
}

export async function resolveSlaPolicy(ticket: Partial<Ticket>): Promise<SlaPolicy | null> {
  const policies = await getSlaPolicies()
  return (
    policies.find(
      (policy) =>
        policy.is_active &&
        policy.ticket_type === ticket.ticket_type &&
        policy.priority === (ticket.priority || '')
    ) || null
  )
}

export async function createTicketNotification(input: Omit<TicketNotification, 'id' | 'created_at' | 'read_at' | 'status'>): Promise<void> {
  const pool = getPool()
  await pool.query(
    `INSERT INTO ticket_notifications (ticket_id, notification_type, recipient_name, title, message, status)
     VALUES (?, ?, ?, ?, ?, 'Unread')`,
    [input.ticket_id || null, input.notification_type, input.recipient_name, input.title, input.message]
  )
}

export async function getTicketNotifications(recipientName?: string, ticketId?: string): Promise<TicketNotification[]> {
  await ensureTicketOperationalTables()
  const pool = getPool()
  let rows: any[] = []
  if (recipientName && ticketId) {
    ;[rows] = await pool.query<any[]>(
      `SELECT * FROM ticket_notifications WHERE recipient_name = ? AND ticket_id = ? ORDER BY created_at DESC`,
      [recipientName, ticketId]
    )
  } else if (recipientName) {
    ;[rows] = await pool.query<any[]>(
      `SELECT * FROM ticket_notifications WHERE recipient_name = ? ORDER BY created_at DESC`,
      [recipientName]
    )
  } else if (ticketId) {
    ;[rows] = await pool.query<any[]>(
      `SELECT * FROM ticket_notifications WHERE ticket_id = ? ORDER BY created_at DESC`,
      [ticketId]
    )
  } else {
    ;[rows] = await pool.query<any[]>(`SELECT * FROM ticket_notifications ORDER BY created_at DESC`)
  }
  return rows.map(mapNotification)
}

export async function markNotificationRead(id: number): Promise<void> {
  const pool = getPool()
  await pool.query(
    `UPDATE ticket_notifications SET status = 'Read', read_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [id]
  )
}

export async function createTicketEscalation(input: Omit<TicketEscalation, 'id' | 'triggered_at'>): Promise<void> {
  const pool = getPool()
  await pool.query(
    `INSERT INTO ticket_escalations (ticket_id, escalation_level, rule_name, status, message)
     VALUES (?, ?, ?, ?, ?)`,
    [input.ticket_id, input.escalation_level, input.rule_name, input.status, input.message]
  )
}

export async function getTicketEscalations(ticketId?: string): Promise<TicketEscalation[]> {
  await ensureTicketOperationalTables()
  const pool = getPool()
  const [rows] = ticketId
    ? await pool.query<any[]>(`SELECT * FROM ticket_escalations WHERE ticket_id = ? ORDER BY triggered_at DESC`, [ticketId])
    : await pool.query<any[]>(`SELECT * FROM ticket_escalations ORDER BY triggered_at DESC`)
  return rows.map(mapEscalation)
}

export async function requestTicketApproval(ticketId: string, approverName: string, actorName?: string): Promise<void> {
  const pool = getPool()
  await pool.query(
    `INSERT INTO ticket_approvals (ticket_id, step_name, approver_name, status) VALUES (?, '승인', ?, 'Requested')`,
    [ticketId, approverName]
  )
  await pool.query(
    `UPDATE service_tickets
     SET approval_required = 1, approval_status = 'Requested', approval_requested_at = CURRENT_TIMESTAMP, approver_name = ?
     WHERE id = ?`,
    [approverName, ticketId]
  )
  await createTicketNotification({
    ticket_id: ticketId,
    notification_type: 'approval',
    recipient_name: approverName,
    title: '승인 요청',
    message: `${ticketId} 티켓의 승인이 요청되었습니다.`,
  })
  await addTicketAuditLog({
    entity_type: 'ticket',
    entity_id: ticketId,
    ticket_id: ticketId,
    action: 'approval_requested',
    actor_name: actorName,
    message: `승인 요청: ${approverName}`,
  })
}

export async function actOnTicketApproval(ticketId: string, approverName: string, action: 'approve' | 'reject', comments?: string): Promise<void> {
  const pool = getPool()
  const approvalStatus = action === 'approve' ? 'Approved' : 'Rejected'
  await pool.query(
    `UPDATE ticket_approvals
     SET status = ?, comments = ?, acted_at = CURRENT_TIMESTAMP
     WHERE ticket_id = ? AND approver_name = ? AND status = 'Requested'`,
    [approvalStatus, comments || null, ticketId, approverName]
  )
  await pool.query(
    `UPDATE service_tickets
     SET approval_status = ?, approval_completed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [approvalStatus, ticketId]
  )
  await addTicketAuditLog({
    entity_type: 'ticket',
    entity_id: ticketId,
    ticket_id: ticketId,
    action: action,
    actor_name: approverName,
    message: `승인 처리: ${approvalStatus}${comments ? ` (${comments})` : ''}`,
  })
}

export async function getTicketApprovals(ticketId?: string, approverName?: string): Promise<TicketApproval[]> {
  await ensureTicketOperationalTables()
  const pool = getPool()
  let rows: any[] = []
  if (ticketId) {
    ;[rows] = await pool.query<any[]>(`SELECT * FROM ticket_approvals WHERE ticket_id = ? ORDER BY requested_at DESC`, [ticketId])
  } else if (approverName) {
    ;[rows] = await pool.query<any[]>(
      `SELECT * FROM ticket_approvals WHERE approver_name = ? ORDER BY requested_at DESC`,
      [approverName]
    )
  } else {
    ;[rows] = await pool.query<any[]>(`SELECT * FROM ticket_approvals ORDER BY requested_at DESC`)
  }
  return rows.map(mapApproval)
}

export async function addTicketAuditLog(input: Omit<TicketAuditLog, 'id' | 'created_at'>): Promise<void> {
  const pool = getPool()
  await pool.query(
    `INSERT INTO ticket_audit_logs (entity_type, entity_id, ticket_id, action, field_name, old_value, new_value, actor_name, message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.entity_type,
      input.entity_id,
      input.ticket_id || null,
      input.action,
      input.field_name || null,
      input.old_value || null,
      input.new_value || null,
      input.actor_name || null,
      input.message,
    ]
  )
}

export async function getTicketAuditLogs(ticketId?: string): Promise<TicketAuditLog[]> {
  await ensureTicketOperationalTables()
  const pool = getPool()
  const [rows] = ticketId
    ? await pool.query<any[]>(`SELECT * FROM ticket_audit_logs WHERE ticket_id = ? ORDER BY created_at DESC`, [ticketId])
    : await pool.query<any[]>(`SELECT * FROM ticket_audit_logs ORDER BY created_at DESC`)
  return rows.map(mapAudit)
}

/** Problem/Incident 신규 생성 시 정책이 적용되도록 기본 impact/urgency 설정 */
function defaultImpactUrgencyForType(ticket: Partial<Ticket>): { impact: string; urgency: string } {
  const type = ticket.ticket_type
  if (type !== 'incident' && type !== 'problem') return { impact: '', urgency: '' }
  const impact = (ticket.impact || '').trim()
  const urgency = (ticket.urgency || '').trim()
  if (impact && urgency) return { impact, urgency }
  // 기본값: High/High → P2 정책 및 해당 유형의 SLA 정책(Incident P2, Problem P2) 적용
  return { impact: 'High', urgency: 'High' }
}

export async function applyOperationalPolicies(ticket: Partial<Ticket>): Promise<Partial<Ticket>> {
  const type = ticket.ticket_type
  const { impact: defaultImpact, urgency: defaultUrgency } = defaultImpactUrgencyForType(ticket)
  const impact = (ticket.impact || '').trim() || defaultImpact || 'Medium'
  const urgency = (ticket.urgency || '').trim() || defaultUrgency || 'Medium'
  const ticketWithResolved = { ...ticket, impact, urgency }

  const resolvedPriority = await resolvePriority(ticketWithResolved)
  const priority = resolvedPriority?.priority || ticket.priority || 'P3'
  const slaPolicy = await resolveSlaPolicy({ ...ticketWithResolved, priority })
  const openedAt = ticket.opened_at ? new Date(ticket.opened_at) : new Date()

  const approvalRequired =
    typeof ticket.approval_required === 'boolean'
      ? ticket.approval_required
      : ticket.ticket_type === 'change' || ticket.ticket_type === 'request'

  return {
    impact,
    urgency,
    priority,
    priority_policy_id: resolvedPriority?.id ?? undefined,
    approval_required: approvalRequired,
    approval_status: approvalRequired ? ticket.approval_status || 'Not Requested' : '',
    sla_policy_id: slaPolicy?.id ?? undefined,
    sla_status: slaPolicy ? 'Within SLA' : '',
    sla_due_at: slaPolicy ? toMysqlDateTime(new Date(openedAt.getTime() + slaPolicy.resolution_minutes * 60 * 1000)) : undefined,
  }
}

export async function evaluateTicketOperationalState(ticket: Ticket): Promise<Ticket> {
  if (!ticket.sla_due_at || isTerminalStatus(ticket.status)) {
    return ticket
  }

  const dueAt = new Date(ticket.sla_due_at)
  if (Number.isNaN(dueAt.getTime())) return ticket

  if (new Date().getTime() > dueAt.getTime()) {
    return {
      ...ticket,
      sla_status: 'Breached',
      sla_breached_at: ticket.sla_breached_at || new Date().toISOString(),
    }
  }

  return {
    ...ticket,
    sla_status: ticket.sla_status || 'Within SLA',
  }
}
