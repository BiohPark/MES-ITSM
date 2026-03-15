'use client'

import { useCallback, useEffect, useState } from 'react'
import type { TicketApproval } from '@/types/ticket'

interface ApprovalInboxViewProps {
  onOpenTicket?: (ticketId: string) => void
}

export function ApprovalInboxView({ onOpenTicket }: ApprovalInboxViewProps) {
  const [approvals, setApprovals] = useState<TicketApproval[]>([])
  const [loading, setLoading] = useState(true)

  const fetchApprovals = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/ticket-approvals?scope=mine', { credentials: 'include' })
      const data = await response.json()
      setApprovals(data.approvals || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchApprovals()
  }, [fetchApprovals])

  const handleAction = async (ticketId: string, action: 'approve' | 'reject') => {
    const comments = window.prompt(action === 'approve' ? '승인 의견을 입력하세요. (선택)' : '반려 사유를 입력하세요.')
    const response = await fetch('/api/ticket-approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action, ticketId, comments }),
    })
    if (response.ok) {
      await fetchApprovals()
    }
  }

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>승인 Inbox</h2>
          <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.92rem' }}>내가 처리해야 할 승인 요청을 확인하고 바로 승인/반려할 수 있습니다.</p>
        </div>
        <button className="servicenow-button servicenow-button--secondary" onClick={() => void fetchApprovals()}>
          새로고침
        </button>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <table className="servicenow-table">
          <thead>
            <tr>
              <th>티켓</th>
              <th>단계</th>
              <th>승인자</th>
              <th>상태</th>
              <th>요청일</th>
              <th>처리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center' }}>로딩 중...</td></tr>
            ) : approvals.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#64748b' }}>대기 중인 승인 요청이 없습니다.</td></tr>
            ) : (
              approvals.map((approval) => (
                <tr key={approval.id}>
                  <td>
                    <button
                      type="button"
                      className="servicenow-button servicenow-button--link"
                      onClick={() => onOpenTicket?.(approval.ticket_id)}
                    >
                      {approval.ticket_id}
                    </button>
                  </td>
                  <td>{approval.step_name}</td>
                  <td>{approval.approver_name}</td>
                  <td>{approval.status}</td>
                  <td>{approval.requested_at ? new Date(approval.requested_at).toLocaleString('ko-KR') : '-'}</td>
                  <td>
                    {approval.status === 'Requested' ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="servicenow-button servicenow-button--primary servicenow-button--sm" onClick={() => void handleAction(approval.ticket_id, 'approve')}>
                          승인
                        </button>
                        <button className="servicenow-button servicenow-button--danger servicenow-button--sm" onClick={() => void handleAction(approval.ticket_id, 'reject')}>
                          반려
                        </button>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
