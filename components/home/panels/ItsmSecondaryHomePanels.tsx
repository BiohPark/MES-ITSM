'use client'

import { ApprovalInboxView } from '@/components/tickets/ApprovalInboxView'
import { NotificationsView } from '@/components/tickets/NotificationsView'
import { AuditLogView } from '@/components/tickets/AuditLogView'
import { TicketPoliciesView } from '@/components/tickets/TicketPoliciesView'
import type { HomeTabContentProps } from '../home-tab-content.types'

export function ApprovalInboxHomePanel({ p }: { p: HomeTabContentProps }) {
  return <ApprovalInboxView onOpenTicket={(ticketId) => void p.handleOpenTicketDetail(ticketId)} />
}

export function NotificationsHomePanel() {
  return <NotificationsView />
}

export function AuditLogHomePanel() {
  return <AuditLogView />
}

export function PriorityPolicyHomePanel({ p }: { p: HomeTabContentProps }) {
  const { user } = p
  return <TicketPoliciesView mode="priority" isAdmin={!!(user?.role === 'admin' || user?.isAdmin)} />
}

export function SlaPolicyHomePanel({ p }: { p: HomeTabContentProps }) {
  const { user } = p
  return <TicketPoliciesView mode="sla" isAdmin={!!(user?.role === 'admin' || user?.isAdmin)} />
}
