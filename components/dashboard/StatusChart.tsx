'use client'

import { useI18n } from '@/lib/i18n'

export function StatusChart({ data }: { data: Record<string, number> }) {
  const { t } = useI18n()
  const total = Object.values(data).reduce((sum, val) => sum + val, 0)
  const colors: Record<string, string> = {
    Planning: '#3b82f6',
    'In Progress': '#10b981',
    Issued: '#ef4444',
    Completed: '#22c55e',
  }

  if (total === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        <p>{t('comp.charts.noData')}</p>
      </div>
    )
  }

  return (
    <div>
      {Object.entries(data).map(([status, count]) => {
        const percentage = total > 0 ? (count / total) * 100 : 0
        return (
          <div key={status} style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>{status}</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                {count} ({Math.round(percentage)}%)
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: '24px',
                backgroundColor: '#f1f5f9',
                borderRadius: '0.5rem',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${percentage}%`,
                  height: '100%',
                  backgroundColor: colors[status] || '#94a3b8',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
