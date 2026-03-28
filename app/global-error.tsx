'use client'

import { I18nProvider, useI18n } from '@/lib/i18n'

function GlobalErrorInner({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useI18n()

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
      <h2 style={{ marginBottom: '1rem', color: '#e74c3c' }}>{t('common.errorBoundaryTitleFatal')}</h2>
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

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ko">
      <body>
        <I18nProvider>
          <GlobalErrorInner error={error} reset={reset} />
        </I18nProvider>
      </body>
    </html>
  )
}
