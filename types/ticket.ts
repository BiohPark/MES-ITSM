export type TicketType = 'request' | 'incident' | 'problem' | 'change'

export type ApprovalStatus = '' | 'Not Requested' | 'Requested' | 'Approved' | 'Rejected'

export interface TicketLink {
  id: number
  ticket_id: string
  link_type: string
  linked_entity_type: string
  linked_entity_id: string
  linked_entity_label?: string
  created_at?: string
}

export interface TicketActivityLog {
  id: number
  ticket_id: string
  action: string
  actor_name?: string
  message: string
  created_at?: string
}

export interface TicketApproval {
  id: number
  ticket_id: string
  step_name: string
  approver_name: string
  status: 'Requested' | 'Approved' | 'Rejected'
  comments?: string
  requested_at?: string
  acted_at?: string
}

export interface TicketNotification {
  id: number
  ticket_id?: string
  notification_type: string
  recipient_name: string
  title: string
  message: string
  status: 'Unread' | 'Read'
  created_at?: string
  read_at?: string
}

export interface TicketEscalation {
  id: number
  ticket_id: string
  escalation_level: number
  rule_name: string
  status: string
  message: string
  triggered_at?: string
}

export interface TicketAuditLog {
  id: number
  entity_type: string
  entity_id: string
  ticket_id?: string
  action: string
  field_name?: string
  old_value?: string
  new_value?: string
  actor_name?: string
  message: string
  created_at?: string
}

export interface PriorityPolicy {
  id?: number
  name: string
  impact: string
  urgency: string
  priority: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface SlaPolicy {
  id?: number
  name: string
  ticket_type: TicketType
  priority: string
  response_minutes: number
  resolution_minutes: number
  escalation_minutes: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface Ticket {
  id: string
  ticket_no: string
  title: string
  description: string
  ticket_type: TicketType
  category?: string
  subcategory?: string
  status: string
  priority: string
  impact: string
  urgency: string
  requester_name: string
  requester_dept?: string
  assignee_name?: string
  approver_name?: string
  related_project_id?: string
  related_task_id?: string
  related_issue_id?: string
  catalog_item_id?: string
  detail_fields: Record<string, string>
  approval_required: boolean
  approval_status: ApprovalStatus
  approval_requested_at?: string
  approval_completed_at?: string
  priority_policy_id?: number
  sla_policy_id?: number
  sla_status?: string
  sla_due_at?: string
  sla_breached_at?: string
  opened_at?: string
  resolved_at?: string
  closed_at?: string
  created_by?: string
  updated_by?: string
  created_at?: string
  updated_at?: string
  links?: TicketLink[]
  activity_logs?: TicketActivityLog[]
  approvals?: TicketApproval[]
  notifications?: TicketNotification[]
  escalations?: TicketEscalation[]
  audit_logs?: TicketAuditLog[]
}

export interface TicketListResponse {
  tickets: Ticket[]
}
