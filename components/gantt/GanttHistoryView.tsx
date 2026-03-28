'use client'

import { useI18n } from '@/lib/i18n'
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
  const { t, locale } = useI18n()
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
        throw new Error(
          details
            ? t('comp.ganttHistory.fetchFailDetail', { details: String(details) })
            : t('comp.ganttHistory.fetchFail')
        )
      }
      setHistory(data.history ?? [])
      if (data.message) setError(null)
    } catch (e: any) {
      setError(e.message ?? t('comp.ganttHistory.loadFail'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadHistory()
  }, [projectIdFilter])

  const formatDate = (iso: string) => {
    if (!iso) return '-'
    const d = new Date(iso)
    const dateLocale = locale.startsWith('en') ? 'en-US' : 'ko-KR'
    return d.toLocaleString(dateLocale, {
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
        <h2>{t('comp.ganttHistory.title')}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem' }}>{t('comp.ganttHistory.filterLabel')}</label>
          <input
            type="text"
            placeholder={t('comp.ganttHistory.filterHint')}
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
            onClick={() => void loadHistory()}
          >
            {t('comp.ui.refresh')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="placeholder">
          <p>{t('comp.ganttHistory.loading')}</p>
        </div>
      ) : error ? (
        <div className="placeholder">
          <p>
            {t('comp.ganttChart.error')} {error}
          </p>
        </div>
      ) : history.length === 0 ? (
        <div className="placeholder">
          <p>{t('comp.ganttHistory.empty')}</p>
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
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>{t('comp.ganttHistory.colAt')}</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>{t('comp.ganttHistory.colProject')}</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>{t('comp.ganttHistory.colUser')}</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>{t('comp.ganttHistory.colAction')}</th>
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
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    {entry.action === 'save' ? t('comp.ganttHistory.actionSave') : entry.action}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
