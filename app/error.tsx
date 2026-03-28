'use client'

import { useEffect } from 'react'
import { useI18n } from '@/lib/i18n'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <h2 style={{ marginBottom: '1rem', color: '#e74c3c' }}>{t('common.errorBoundaryTitle')}</h2>
      <p style={{ marginBottom: '2rem', color: '#666' }}>
        {error.message || t('common.errorBoundaryFallback')}
      </p>
      <button
        onClick={reset}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#3498db',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '1rem',
        }}
      >
        {t('comp.ui.retry')}
      </button>
    </div>
  )
}
