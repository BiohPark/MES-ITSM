'use client'

import { useI18n } from '@/lib/i18n'
import { useState, useEffect, useCallback, useMemo } from 'react'
import type { VocFeedback } from '@/lib/voc'

const CATEGORY_VALUES = [
  'UI/UX 개선',
  '기능 요청',
  '버그 신고',
  '성능 문제',
  '사용성 개선',
  '기타',
] as const

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']
const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed']

interface VocViewProps {
  currentUser?: { name: string; username: string; role: string; isAdmin?: boolean }
}

export function VocView({ currentUser }: VocViewProps) {
  const { t, locale } = useI18n()
  const dateLocale = locale.startsWith('en') ? 'en-US' : 'ko-KR'

  const categoryLabel = useMemo(() => {
    const m: Record<string, string> = {
      'UI/UX 개선': t('comp.voc.catUi'),
      '기능 요청': t('comp.voc.catFeature'),
      '버그 신고': t('comp.voc.catBug'),
      '성능 문제': t('comp.voc.catPerf'),
      '사용성 개선': t('comp.voc.catUx'),
      기타: t('comp.voc.catOther'),
    }
    return (v: string) => m[v] || v
  }, [t])

  const [feedbacks, setFeedbacks] = useState<VocFeedback[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [selectedFeedback, setSelectedFeedback] = useState<VocFeedback | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [formData, setFormData] = useState({
    category: '기타' as string,
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

      const response = await fetch(`/api/voc?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || t('comp.voc.fetchFail')

        if (errorData.code === 'TABLE_NOT_FOUND') {
          throw new Error(`${errorMessage}${t('comp.voc.tableNotFoundExtra')}`)
        }

        throw new Error(errorMessage)
      }
      const data = await response.json()
      setFeedbacks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('comp.voc.genericError'))
    } finally {
      setLoading(false)
    }
  }, [filterStatus, t])

  useEffect(() => {
    void fetchFeedbacks()
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
        throw new Error(errorData.error || t('comp.voc.submitFail'))
      }

      setShowForm(false)
      setFormData({ category: '기타', title: '', content: '', priority: 'Medium' })
      await fetchFeedbacks()
      alert(t('comp.voc.submitOk'))
    } catch (err) {
      alert(err instanceof Error ? err.message : t('comp.voc.genericError'))
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
        throw new Error(t('comp.voc.statusFail'))
      }

      setSelectedFeedback(null)
      setAdminResponse('')
      await fetchFeedbacks()
    } catch (err) {
      alert(err instanceof Error ? err.message : t('comp.voc.genericError'))
    }
  }

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString(dateLocale)
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
        <p>{t('comp.voc.loading')}</p>
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>{t('comp.voc.title')}</h2>
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
              <option value="">{t('comp.voc.allStatus')}</option>
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
            {showForm ? t('comp.voc.cancel') : t('comp.voc.newSubmit')}
          </button>
          <button onClick={() => void fetchFeedbacks()} className="refresh-button">
            {t('comp.ui.refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="placeholder">
          <p style={{ color: '#e74c3c' }}>
            {t('comp.voc.errorLine')} {error}
          </p>
        </div>
      )}

      {showForm && (
        <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f9fafb', borderRadius: '0.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>{t('comp.voc.newSubmit')}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                {t('comp.voc.category')}
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="form-input"
                required
              >
                {CATEGORY_VALUES.map((cat) => (
                  <option key={cat} value={cat}>
                    {categoryLabel(cat)}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                {t('comp.voc.priority')}
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
                {t('comp.voc.vocTitle')}
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
                {t('comp.voc.content')}
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
              {t('comp.voc.submit')}
            </button>
          </form>
        </div>
      )}

      {feedbacks.length === 0 ? (
        <div className="placeholder">
          <p>{t('comp.voc.empty')}</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t('comp.voc.tableId')}</th>
              <th>{t('comp.voc.category')}</th>
              <th>{t('comp.voc.vocTitle')}</th>
              <th>{t('comp.voc.author')}</th>
              <th>{t('comp.voc.priority')}</th>
              <th>{t('comp.voc.colStatus')}</th>
              <th>{t('comp.voc.created')}</th>
              {isAdmin && <th>{t('comp.voc.manage')}</th>}
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
                <td>{categoryLabel(feedback.category)}</td>
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
                      {t('comp.voc.detail')}
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
              <h2>{t('comp.voc.detailTitle')}</h2>
              <button className="modal-close" onClick={() => setSelectedFeedback(null)}>
                ×
              </button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <strong>{t('comp.voc.labelTitleStrong')}</strong> {selectedFeedback.title}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <strong>{t('comp.voc.labelCategoryStrong')}</strong> {categoryLabel(selectedFeedback.category)}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <strong>{t('comp.voc.labelAuthorStrong')}</strong> {selectedFeedback.user_name}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <strong>{t('comp.voc.labelPriorityStrong')}</strong>{' '}
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
                <strong>{t('comp.voc.labelStatusStrong')}</strong>{' '}
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
                <strong>{t('comp.voc.labelContentStrong')}</strong>
                <div style={{ marginTop: '0.5rem', padding: '1rem', background: '#f9fafb', borderRadius: '0.5rem', whiteSpace: 'pre-wrap' }}>
                  {selectedFeedback.content}
                </div>
              </div>
              {selectedFeedback.admin_response && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong>{t('comp.voc.labelAdminReplyStrong')}</strong>
                  <div style={{ marginTop: '0.5rem', padding: '1rem', background: '#eff6ff', borderRadius: '0.5rem', whiteSpace: 'pre-wrap' }}>
                    {selectedFeedback.admin_response}
                  </div>
                </div>
              )}
              {isAdmin && (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                      {t('comp.voc.adminReplyLabel')}
                    </label>
                    <textarea
                      value={adminResponse}
                      onChange={(e) => setAdminResponse(e.target.value)}
                      className="form-input"
                      rows={4}
                      placeholder={t('comp.voc.replyPh')}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => void handleUpdateStatus(selectedFeedback.id, 'In Progress')}
                      className="primary-button"
                      disabled={selectedFeedback.status === 'In Progress'}
                    >
                      {t('comp.voc.stProgress')}
                    </button>
                    <button
                      onClick={() => void handleUpdateStatus(selectedFeedback.id, 'Resolved', adminResponse)}
                      className="primary-button"
                      style={{ backgroundColor: '#10b981' }}
                    >
                      {t('comp.voc.stResolved')}
                    </button>
                    <button
                      onClick={() => void handleUpdateStatus(selectedFeedback.id, 'Closed', adminResponse)}
                      className="primary-button"
                      style={{ backgroundColor: '#6b7280' }}
                    >
                      {t('comp.voc.stClosed')}
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
