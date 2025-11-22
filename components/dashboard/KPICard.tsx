'use client'

import { ReactNode } from 'react'

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  color?: string
}) {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        border: '1px solid #e2e8f0',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>{title}</p>
          <h3 style={{ fontSize: '2rem', fontWeight: 700, color: color || '#111827', margin: 0 }}>
            {value}
          </h3>
          {subtitle && (
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.5rem' }}>{subtitle}</p>
          )}
        </div>
        {icon && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: color || '#64748b' }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

