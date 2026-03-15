'use client'

import { useCallback, useEffect, useState } from 'react'
import type { TicketEscalation, TicketNotification } from '@/types/ticket'

export function NotificationsView() {
  const [notifications, setNotifications] = useState<TicketNotification[]>([])
  const [escalations, setEscalations] = useState<TicketEscalation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/ticket-notifications', { credentials: 'include' })
      const data = await response.json()
      setNotifications(data.notifications || [])
      setEscalations(data.escalations || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const markRead = async (id: number) => {
    const response = await fetch('/api/ticket-notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'markRead', id }),
    })
    if (response.ok) {
      await fetchData()
    }
  }

  return (
    <section style={{ display: 'grid', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>알림 및 에스컬레이션</h2>
          <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.92rem' }}>티켓 상태 변화와 SLA 경고를 한 곳에서 확인합니다.</p>
        </div>
        <button className="servicenow-button servicenow-button--secondary" onClick={() => void fetchData()}>
          새로고침
        </button>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <table className="servicenow-table">
          <thead>
            <tr>
              <th>알림</th>
              <th>유형</th>
              <th>상태</th>
              <th>생성일</th>
              <th>처리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center' }}>로딩 중...</td></tr>
            ) : notifications.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#64748b' }}>알림이 없습니다.</td></tr>
            ) : (
              notifications.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.title}</div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', overflowWrap: 'anywhere' }}>{item.message}</div>
                  </td>
                  <td>{item.notification_type}</td>
                  <td>{item.status}</td>
                  <td>{item.created_at ? new Date(item.created_at).toLocaleString('ko-KR') : '-'}</td>
                  <td>
                    {item.status === 'Unread' ? (
                      <button className="servicenow-button servicenow-button--secondary servicenow-button--sm" onClick={() => void markRead(item.id)}>
                        읽음
                      </button>
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

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <table className="servicenow-table">
          <thead>
            <tr>
              <th>티켓</th>
              <th>규칙</th>
              <th>상태</th>
              <th>메시지</th>
              <th>발생일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center' }}>로딩 중...</td></tr>
            ) : escalations.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#64748b' }}>에스컬레이션 이력이 없습니다.</td></tr>
            ) : (
              escalations.map((item) => (
                <tr key={item.id}>
                  <td>{item.ticket_id}</td>
                  <td>{item.rule_name}</td>
                  <td>{item.status}</td>
                  <td style={{ overflowWrap: 'anywhere' }}>{item.message}</td>
                  <td>{item.triggered_at ? new Date(item.triggered_at).toLocaleString('ko-KR') : '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
