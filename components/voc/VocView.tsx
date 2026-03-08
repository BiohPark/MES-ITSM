'use client'

import { useState, useEffect, useCallback } from 'react'
import type { VocFeedback } from '@/lib/voc'

const CATEGORIES = [
  'UI/UX 개선',
  '기능 요청',
  '버그 신고',
  '성능 문제',
  '사용성 개선',
  '기타',
]

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']
const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed']

interface VocViewProps {
  currentUser?: { name: string; username: string; role: string }
}

export function VocView({ currentUser }: VocViewProps) {
  const [feedbacks, setFeedbacks] = useState<VocFeedback[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [selectedFeedback, setSelectedFeedback] = useState<VocFeedback | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [formData, setFormData] = useState({
    category: '기타',
    title: '',
    content: '',
    priority: 'Medium',
  })
  const [adminResponse, setAdminResponse] = useState('')
  const [isAdmin] = useState(currentUser?.role === 'admin' || !!currentUser?.isAdmin)

  const fetchFeedbacks = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (filterStatus) {
        params.append('status', filterStatus)
      }
      // 모든 권한에서 모든 피드백을 볼 수 있도록 수정
      // 특정 사용자의 피드백만 보려면 아래 주석을 해제하고 userId를 전달
      // if (!isAdmin) {
      //   params.append('userId', currentUser?.username || '')
      // }

      const response = await fetch(`/api/voc?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || '피드백 조회에 실패했습니다.'
        
        // 테이블이 없는 경우 특별 처리
        if (errorData.code === 'TABLE_NOT_FOUND') {
          throw new Error(`${errorMessage}\n\n터미널에서 다음 명령어를 실행해주세요:\nnpm run add-voc-table`)
        }
        
        throw new Error(errorMessage)
      }
      const data = await response.json()
      setFeedbacks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [filterStatus, isAdmin, currentUser])

  useEffect(() => {
    fetchFeedbacks()
  }, [fetchFeedbacks])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/voc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...formData,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '피드백 제출에 실패했습니다.')
      }

      setShowForm(false)
      setFormData({ category: '기타', title: '', content: '', priority: 'Medium' })
      await fetchFeedbacks()
      alert('피드백이 제출되었습니다.')
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.')
    }
  }

  const handleUpdateStatus = async (id: number, status: string, responseText?: string) => {
    try {
      const response = await fetch('/api/voc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id,
          status,
          admin_response: responseText || adminResponse,
        }),
      })

      if (!response.ok) {
        throw new Error('상태 업데이트에 실패했습니다.')
      }

      setSelectedFeedback(null)
      setAdminResponse('')
      await fetchFeedbacks()
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.')
    }
  }

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString('ko-KR')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return '#3b82f6'
      case 'In Progress':
        return '#f59e0b'
      case 'Resolved':
        return '#10b981'
      case 'Closed':
        return '#6b7280'
      default:
        return '#6b7280'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return '#ef4444'
      case 'High':
        return '#f59e0b'
      case 'Medium':
        return '#3b82f6'
      case 'Low':
        return '#6b7280'
      default:
        return '#6b7280'
    }
  }

  if (loading) {
    return (
      <div className="placeholder">
        <p>데이터를 불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>VOC 관리</h2>
        <div className="table-actions">
          {isAdmin && (
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
              }}
            >
              <option value="">전체 상태</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowForm(!showForm)}
            className="primary-button"
          >
            {showForm ? '취소' : '피드백 제출'}
          </button>
          <button onClick={fetchFeedbacks} className="refresh-button">
            새로고침
          </button>
        </div>
      </div>

      {error && (
        <div className="placeholder">
          <p style={{ color: '#e74c3c' }}>오류: {error}</p>
        </div>
      )}

      {showForm && (
        <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f9fafb', borderRadius: '0.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>새 피드백 제출</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                카테고리
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="form-input"
                required
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                우선순위
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="form-input"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                제목
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="form-input"
                required
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                내용
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="form-input"
                rows={6}
                required
              />
            </div>
            <button type="submit" className="primary-button">
              제출
            </button>
          </form>
        </div>
      )}

      {feedbacks.length === 0 ? (
        <div className="placeholder">
          <p>피드백이 없습니다.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>카테고리</th>
              <th>제목</th>
              <th>작성자</th>
              <th>우선순위</th>
              <th>상태</th>
              <th>작성일</th>
              {isAdmin && <th>관리</th>}
            </tr>
          </thead>
          <tbody>
            {feedbacks.map((feedback) => (
              <tr
                key={feedback.id}
                className="project-row"
                onClick={() => !isAdmin && setSelectedFeedback(feedback)}
                style={{ cursor: 'pointer' }}
              >
                <td>#{feedback.id}</td>
                <td>{feedback.category}</td>
                <td>
                  <p className="project-name">{feedback.title}</p>
                </td>
                <td>{feedback.user_name}</td>
                <td>
                  <span
                    style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'white',
                      backgroundColor: getPriorityColor(feedback.priority),
                    }}
                  >
                    {feedback.priority}
                  </span>
                </td>
                <td>
                  <span
                    style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'white',
                      backgroundColor: getStatusColor(feedback.status),
                    }}
                  >
                    {feedback.status}
                  </span>
                </td>
                <td>{formatDate(feedback.created_at)}</td>
                {isAdmin && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedFeedback(feedback)}
                      className="primary-button"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      상세
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedFeedback && (
        <div className="modal-overlay" onClick={() => setSelectedFeedback(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2>피드백 상세</h2>
              <button className="modal-close" onClick={() => setSelectedFeedback(null)}>
                ×
              </button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <strong>제목:</strong> {selectedFeedback.title}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <strong>카테고리:</strong> {selectedFeedback.category}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <strong>작성자:</strong> {selectedFeedback.user_name}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <strong>우선순위:</strong>{' '}
                <span
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'white',
                    backgroundColor: getPriorityColor(selectedFeedback.priority),
                  }}
                >
                  {selectedFeedback.priority}
                </span>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <strong>상태:</strong>{' '}
                <span
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'white',
                    backgroundColor: getStatusColor(selectedFeedback.status),
                  }}
                >
                  {selectedFeedback.status}
                </span>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <strong>내용:</strong>
                <div style={{ marginTop: '0.5rem', padding: '1rem', background: '#f9fafb', borderRadius: '0.5rem', whiteSpace: 'pre-wrap' }}>
                  {selectedFeedback.content}
                </div>
              </div>
              {selectedFeedback.admin_response && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong>관리자 응답:</strong>
                  <div style={{ marginTop: '0.5rem', padding: '1rem', background: '#eff6ff', borderRadius: '0.5rem', whiteSpace: 'pre-wrap' }}>
                    {selectedFeedback.admin_response}
                  </div>
                </div>
              )}
              {isAdmin && (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                      관리자 응답
                    </label>
                    <textarea
                      value={adminResponse}
                      onChange={(e) => setAdminResponse(e.target.value)}
                      className="form-input"
                      rows={4}
                      placeholder="응답을 입력하세요..."
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleUpdateStatus(selectedFeedback.id, 'In Progress')}
                      className="primary-button"
                      disabled={selectedFeedback.status === 'In Progress'}
                    >
                      진행 중
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedFeedback.id, 'Resolved', adminResponse)}
                      className="primary-button"
                      style={{ backgroundColor: '#10b981' }}
                    >
                      해결됨
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedFeedback.id, 'Closed', adminResponse)}
                      className="primary-button"
                      style={{ backgroundColor: '#6b7280' }}
                    >
                      종료
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

