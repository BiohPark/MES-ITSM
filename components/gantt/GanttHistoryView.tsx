'use client'

import { useEffect, useState } from 'react'

interface HistoryEntry {
  id: number
  projectId: number
  projectName: string
  userId: string
  userName: string
  action: string
  createdAt: string
}

export function GanttHistoryView() {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectIdFilter, setProjectIdFilter] = useState<string>('')

  const loadHistory = async () => {
    setLoading(true)
    setError(null)
    try {
      const url = projectIdFilter
        ? `/api/gantt/history?projectId=${encodeURIComponent(projectIdFilter)}`
        : '/api/gantt/history'
      const res = await fetch(url)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const details = data.details ?? data.error ?? ''
        throw new Error(details ? `이력 조회 실패: ${details}` : '이력 조회 실패')
      }
      setHistory(data.history ?? [])
      if (data.message) setError(null)
    } catch (e: any) {
      setError(e.message ?? '이력을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [projectIdFilter])

  const formatDate = (iso: string) => {
    if (!iso) return '-'
    const d = new Date(iso)
    return d.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="table-wrapper">
      <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h2>WBS 수정 이력</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem' }}>프로젝트 ID 필터:</label>
          <input
            type="text"
            placeholder="비우면 전체"
            value={projectIdFilter}
            onChange={(e) => setProjectIdFilter(e.target.value)}
            style={{
              padding: '0.35rem 0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              width: 120,
            }}
          />
          <button
            type="button"
            className="servicenow-button servicenow-button--secondary"
            onClick={loadHistory}
          >
            새로고침
          </button>
        </div>
      </div>

      {loading ? (
        <div className="placeholder">
          <p>이력을 불러오는 중...</p>
        </div>
      ) : error ? (
        <div className="placeholder">
          <p>에러: {error}</p>
        </div>
      ) : history.length === 0 ? (
        <div className="placeholder">
          <p>수정 이력이 없습니다.</p>
        </div>
      ) : (
        <div
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>일시</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>프로젝트</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>수정자</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr
                  key={entry.id}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <td style={{ padding: '0.5rem 0.75rem' }}>{formatDate(entry.createdAt)}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <span style={{ fontWeight: 500 }}>{entry.projectName}</span>
                    <span style={{ color: '#94a3b8', marginLeft: '0.35rem' }}>#{entry.projectId}</span>
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    {entry.userName}
                    <span style={{ color: '#94a3b8', marginLeft: '0.35rem', fontSize: '0.8rem' }}>({entry.userId})</span>
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{entry.action === 'save' ? '저장' : entry.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
