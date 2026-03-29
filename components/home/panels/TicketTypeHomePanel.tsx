'use client'

import type { TicketType } from '@/types/ticket'
import { TicketsTable } from '@/components/tickets/TicketsTable'
import type { HomeTabContentProps } from '../home-tab-content.types'

export function TicketTypeHomePanel({ p, ticketTab }: { p: HomeTabContentProps; ticketTab: TicketType }) {
  const { ticketsByType, ticketsLoading, ticketsError, fetchTickets, handleCreateTicket, handleOpenTicketDetail } = p
  return (
    <TicketsTable
      ticketType={ticketTab}
      tickets={ticketsByType[ticketTab] || []}
      loading={ticketsLoading}
      error={ticketsError}
      onRefresh={() => void fetchTickets(ticketTab)}
      onNewTicket={() => void handleCreateTicket(ticketTab)}
      onTicketClick={(ticket) => void handleOpenTicketDetail(ticket.id)}
    />
  )
}
