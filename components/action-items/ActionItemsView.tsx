'use client'

import { useState, useEffect } from 'react'
import { StatusBadge } from '../common/StatusBadge'

interface ActionItem {
  id: string
  description: string
  assignee: string
  due_date: string | null
  status: 'pending' | 'in_progress' | 'completed'
  meeting_note_id: string
  meeting_title: string
  meeting_date: string
  created_at: string
}

export function ActionItemsView({
  currentUser,
  onMeetingNoteClick,
}: {
  currentUser?: { name: string; username: string }
  onMeetingNoteClick?: (meetingNoteId: string) => void
}) {
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterAssignee, setFilterAssignee] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const fetchActionItems = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/action-items', {
        cache: 'no-store',
      })
      if (!response.ok) {
        throw new Error('액션 아이템 조회 실패')
      }
      const data = await response.json()
      setActionItems(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActionItems()
  }, [])

  const handleStatusChange = async (meetingNoteId: string, actionItemId: string, newStatus: 'pending' | 'in_progress' | 'completed') => {
    try {
      const response = await fetch('/api/action-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updateStatus',
          meetingNoteId,
          actionItemId,
          status: newStatus,
        }),
      })

      if (!response.ok) {
        throw new Error('상태 업데이트 실패')
      }

      // 로컬 상태 업데이트
      setActionItems((prev) =>
        prev.map((item) =>
          item.id === actionItemId && item.meeting_note_id === meetingNoteId
            ? { ...item, status: newStatus }
            : item
        )
      )
    } catch (err) {
      alert('상태 업데이트에 실패했습니다.')
      console.error('Error updating action item status:', err)
    }
  }

  // 담당자 목록 추출
  const assignees = Array.from(new Set(actionItems.map((item) => item.assignee))).sort()

  // 필터링된 액션 아이템
  const filteredItems = actionItems.filter((item) => {
    const matchesAssignee = !filterAssignee || item.assignee === filterAssignee
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus
    return matchesAssignee && matchesStatus
  })

  if (loading) {
    return (
      <div className="placeholder">
        <p>데이터를 불러오는 중...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="placeholder">
        <p style={{ color: '#e74c3c' }}>오류: {error}</p>
        <button onClick={fetchActionItems} className="refresh-button">
          다시 시도
        </button>
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>액션 아이템 목록</h2>
        <div className="table-actions">
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #ddd',
              borderRadius: '2px',
              fontSize: '0.875rem',
              marginRight: '0.5rem',
            }}
          >
            <option value="">모든 담당자</option>
            {assignees.map((assignee) => (
              <option key={assignee} value={assignee}>
                {assignee}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #ddd',
              borderRadius: '2px',
              fontSize: '0.875rem',
              marginRight: '0.5rem',
            }}
          >
            <option value="all">모든 상태</option>
            <option value="pending">대기</option>
            <option value="in_progress">진행중</option>
            <option value="completed">완료</option>
          </select>
          <button onClick={fetchActionItems} className="refresh-button">
            새로고침
          </button>
        </div>
      </div>
      {filteredItems.length === 0 ? (
        <div className="placeholder">
          <p>액션 아이템이 없습니다.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: '300px' }}>설명</th>
              <th style={{ width: '120px' }}>담당자</th>
              <th style={{ width: '120px' }}>마감일</th>
              <th style={{ width: '120px' }}>상태</th>
              <th style={{ width: '200px' }}>회의록</th>
              <th style={{ width: '120px' }}>회의 일시</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={`${item.meeting_note_id}-${item.id}`}>
                <td style={{ fontWeight: 500 }}>{item.description}</td>
                <td>{item.assignee}</td>
                <td>{item.due_date || '-'}</td>
                <td>
                  <select
                    value={item.status}
                    onChange={(e) =>
                      handleStatusChange(
                        item.meeting_note_id,
                        item.id,
                        e.target.value as 'pending' | 'in_progress' | 'completed'
                      )
                    }
                    style={{
                      padding: '0.25rem 0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '2px',
                      fontSize: '0.875rem',
                    }}
                  >
                    <option value="pending">대기</option>
                    <option value="in_progress">진행중</option>
                    <option value="completed">완료</option>
                  </select>
                </td>
                <td>
                  {onMeetingNoteClick ? (
                    <button
                      onClick={() => onMeetingNoteClick(item.meeting_note_id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2A84D5',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        padding: 0,
                        fontSize: '0.875rem',
                      }}
                    >
                      {item.meeting_title}
                    </button>
                  ) : (
                    item.meeting_title
                  )}
                </td>
                <td>{item.meeting_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}


