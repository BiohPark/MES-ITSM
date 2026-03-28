'use client'

import { useI18n } from '@/lib/i18n'
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
  const { t } = useI18n()
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
        throw new Error(t('comp.actionItems.fetchFail'))
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
        throw new Error(t('comp.actionItems.updateFail'))
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
        <p>{t('comp.ui.loading')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="placeholder">
        <p style={{ color: '#e74c3c' }}>
          {t('comp.ui.errorPrefix')} {error}
        </p>
        <button onClick={() => void fetchActionItems()} className="refresh-button">
          {t('comp.ui.retry')}
        </button>
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>{t('comp.actionItems.title')}</h2>
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
            <option value="">{t('comp.actionItems.allOwners')}</option>
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
            <option value="all">{t('comp.actionItems.allStatus')}</option>
            <option value="pending">{t('comp.actionItems.stPending')}</option>
            <option value="in_progress">{t('comp.actionItems.stProgress')}</option>
            <option value="completed">{t('comp.actionItems.stDone')}</option>
          </select>
          <button onClick={() => void fetchActionItems()} className="refresh-button">
            {t('comp.ui.refresh')}
          </button>
        </div>
      </div>
      {filteredItems.length === 0 ? (
        <div className="placeholder">
          <p>{t('comp.actionItems.empty')}</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: '300px' }}>{t('comp.actionItems.colDescription')}</th>
              <th style={{ width: '120px' }}>{t('comp.actionItems.colAssigneeHeader')}</th>
              <th style={{ width: '120px' }}>{t('comp.actionItems.colDue')}</th>
              <th style={{ width: '120px' }}>{t('comp.personal.colStatus')}</th>
              <th style={{ width: '200px' }}>{t('comp.actionItems.colMeeting')}</th>
              <th style={{ width: '120px' }}>{t('comp.actionItems.colMeetingAt')}</th>
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
                    <option value="pending">{t('comp.actionItems.stPending')}</option>
                    <option value="in_progress">{t('comp.actionItems.stProgress')}</option>
                    <option value="completed">{t('comp.actionItems.stDone')}</option>
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


