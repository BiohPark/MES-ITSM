'use client'

import { useCallback, useEffect, useState } from 'react'
import type { TicketAuditLog } from '@/types/ticket'

export function AuditLogView() {
  const [auditLogs, setAuditLogs] = useState<TicketAuditLog[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/ticket-audit', { credentials: 'include' })
      const data = await response.json()
      setAuditLogs(data.auditLogs || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>감사 로그</h2>
          <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.92rem' }}>티켓, 승인, 링크 변경 이력을 감사 관점으로 조회합니다.</p>
        </div>
        <button className="servicenow-button servicenow-button--secondary" onClick={() => void fetchData()}>
          새로고침
        </button>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <table className="servicenow-table">
          <thead>
            <tr>
              <th>엔터티</th>
              <th>행동</th>
              <th>수행자</th>
              <th>메시지</th>
              <th>생성일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center' }}>로딩 중...</td></tr>
            ) : auditLogs.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#64748b' }}>감사 로그가 없습니다.</td></tr>
            ) : (
              auditLogs.map((log) => (
                <tr key={log.id}>
                  <td>{log.entity_type} / {log.entity_id}</td>
                  <td>{log.action}</td>
                  <td>{log.actor_name || '-'}</td>
                  <td style={{ overflowWrap: 'anywhere' }}>{log.message}</td>
                  <td>{log.created_at ? new Date(log.created_at).toLocaleString('ko-KR') : '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
