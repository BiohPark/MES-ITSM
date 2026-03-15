'use client'

import type { Ticket, TicketType } from '@/types/ticket'

const TYPE_LABEL: Record<TicketType, string> = {
  request: 'Service Request',
  incident: 'Incident',
  problem: 'Problem',
  change: 'Change',
}

interface TicketsTableProps {
  title?: string
  ticketType: TicketType
  tickets: Ticket[]
  loading?: boolean
  error?: string | null
  onRefresh?: () => void | Promise<void>
  onNewTicket?: () => void | Promise<void>
  onTicketClick?: (ticket: Ticket) => void
}

export function TicketsTable({
  title,
  ticketType,
  tickets,
  loading = false,
  error,
  onRefresh,
  onNewTicket,
  onTicketClick,
}: TicketsTableProps) {
  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{title || TYPE_LABEL[ticketType]}</h2>
          <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.92rem' }}>
            {TYPE_LABEL[ticketType]} 목록과 SLA/승인 상태를 확인할 수 있습니다.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {onRefresh && (
            <button className="servicenow-button servicenow-button--secondary" onClick={() => void onRefresh()}>
              새로고침
            </button>
          )}
          {onNewTicket && (
            <button className="servicenow-button servicenow-button--primary" onClick={() => void onNewTicket()}>
              신규 등록
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c' }}>
          {error}
        </div>
      )}

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <table className="servicenow-table">
          <thead>
            <tr>
              <th>번호</th>
              <th>제목</th>
              <th>상태</th>
              <th>우선순위</th>
              <th>SLA</th>
              <th>승인</th>
              <th>요청자</th>
              <th>담당자</th>
              <th>생성일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: '#64748b' }}>로딩 중...</td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: '#64748b' }}>등록된 티켓이 없습니다.</td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr key={ticket.id} style={{ cursor: onTicketClick ? 'pointer' : 'default' }} onClick={() => onTicketClick?.(ticket)}>
                  <td>{ticket.ticket_no}</td>
                  <td style={{ maxWidth: 420 }}>
                    <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{ticket.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{TYPE_LABEL[ticket.ticket_type]}</div>
                  </td>
                  <td>{ticket.status}</td>
                  <td>{ticket.priority}</td>
                  <td>{ticket.sla_status || '-'}</td>
                  <td>{ticket.approval_required ? ticket.approval_status || 'Not Requested' : '미사용'}</td>
                  <td>{ticket.requester_name || '-'}</td>
                  <td>{ticket.assignee_name || '-'}</td>
                  <td>{ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('ko-KR') : '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
