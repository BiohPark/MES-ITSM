'use client'

import { useI18n } from '@/lib/i18n'

export function UpcomingDeadlinesList({
  items,
}: {
  items: Array<{ id: string; name: string; due: Date; type: 'project' | 'task'; owner: string }>
}) {
  const { t, locale } = useI18n()
  const dateLocale = locale === 'ko' ? 'ko-KR' : 'en-US'

  if (items.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        <p>{t('comp.upcoming.empty')}</p>
      </div>
    )
  }

  const getDaysUntil = (due: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffTime = due.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const dueLabel = (daysUntil: number) => {
    if (daysUntil === 0) return t('comp.upcoming.dueToday')
    if (daysUntil === 1) return t('comp.upcoming.dueTomorrow')
    return t('comp.upcoming.dueInDays', { n: daysUntil })
  }

  return (
    <div>
      {items.map((item) => {
        const daysUntil = getDaysUntil(item.due)
        const isUrgent = daysUntil <= 3
        const isWarning = daysUntil <= 5

        return (
          <div
            key={item.id}
            style={{
              padding: '1rem',
              marginBottom: '0.75rem',
              borderRadius: '0.5rem',
              backgroundColor: isUrgent ? '#fef2f2' : isWarning ? '#fffbeb' : '#f8fafc',
              border: `1px solid ${isUrgent ? '#fecaca' : isWarning ? '#fde68a' : '#e2e8f0'}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem' }}>{item.type === 'project' ? '📁' : '└─'}</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>{item.name}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '1.5rem' }}>
                  {t('comp.upcoming.owner')} {item.owner}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: isUrgent ? '#dc2626' : isWarning ? '#d97706' : '#475569',
                  }}
                >
                  {dueLabel(daysUntil)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                  {item.due.toLocaleDateString(dateLocale)}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
