'use client'

import { useI18n } from '@/lib/i18n'
import { useState, useEffect, useCallback } from 'react'

interface BackupMetadata {
  id: number
  filename: string
  file_path: string
  file_size: number
  backup_type: 'auto' | 'manual'
  created_by?: string
  created_at: Date
}

export function BackupView() {
  const { t, locale } = useI18n()
  const dateLocale = locale.startsWith('en') ? 'en-US' : 'ko-KR'
  const [backups, setBackups] = useState<BackupMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState<number | null>(null)

  const fetchBackups = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/backup')
      if (!response.ok) {
        throw new Error(t('comp.backup.listFail'))
      }
      const data = await response.json()
      setBackups(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('comp.backup.genericError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void fetchBackups()
  }, [fetchBackups])

  const handleCreateBackup = async () => {
    if (!confirm(t('comp.backup.confirmManual'))) {
      return
    }

    try {
      setCreating(true)
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('comp.backup.createFail'))
      }

      await fetchBackups()
      alert(t('comp.backup.created'))
    } catch (err) {
      alert(err instanceof Error ? err.message : t('comp.backup.genericError'))
    } finally {
      setCreating(false)
    }
  }

  const handleRestore = async (backupId: number, filename: string) => {
    if (
      !confirm(
        `${t('comp.backup.confirmRestore', { name: filename })}\n\n${t('comp.backup.restoreWarn1')}`
      )
    ) {
      return
    }

    if (!confirm(t('comp.backup.confirmRestoreFinal'))) {
      return
    }

    try {
      setRestoring(backupId)
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', backupId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('comp.backup.restoreFail'))
      }

      alert(t('comp.backup.restoreOkReload'))
      window.location.reload()
    } catch (err) {
      alert(err instanceof Error ? err.message : t('comp.backup.genericError'))
    } finally {
      setRestoring(null)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString(dateLocale)
  }

  if (loading) {
    return (
      <div className="placeholder">
        <p>{t('comp.ui.loading')}</p>
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>{t('comp.backup.title')}</h2>
        <div className="table-actions">
          <button
            onClick={() => void handleCreateBackup()}
            className="primary-button"
            disabled={creating}
          >
            {creating ? t('comp.backup.backingUp') : t('comp.backup.manualBackup')}
          </button>
          <button onClick={() => void fetchBackups()} className="refresh-button">
            {t('comp.ui.refresh')}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1rem', padding: '1rem', background: '#eff6ff', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
        <p style={{ margin: 0, marginBottom: '0.5rem' }}>
          <strong>{t('comp.backup.noticeLabel')}</strong> {t('comp.backup.intro1')}
        </p>
        <p style={{ margin: 0, marginBottom: '0.5rem' }}>
          {t('comp.backup.intro2')}
        </p>
        <p style={{ margin: 0 }}>
          {t('comp.backup.intro3')}
        </p>
      </div>

      {error && (
        <div className="placeholder">
          <p style={{ color: '#e74c3c' }}>
            {t('comp.ui.errorPrefix')} {error}
          </p>
        </div>
      )}

      {backups.length === 0 ? (
        <div className="placeholder">
          <p>{t('comp.backup.noBackups')}</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t('comp.backup.colFile')}</th>
              <th>{t('comp.backup.colType')}</th>
              <th>{t('comp.backup.colSize')}</th>
              <th>{t('comp.backup.colCreator')}</th>
              <th>{t('comp.backup.colCreated')}</th>
              <th>{t('comp.backup.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {backups.map((backup) => (
              <tr key={backup.id} className="project-row">
                <td>
                  <p className="project-name">{backup.filename}</p>
                </td>
                <td>
                  <span
                    style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'white',
                      backgroundColor: backup.backup_type === 'auto' ? '#3b82f6' : '#10b981',
                    }}
                  >
                    {backup.backup_type === 'auto' ? t('comp.backup.typeAuto') : t('comp.backup.typeManual')}
                  </span>
                </td>
                <td>{formatFileSize(backup.file_size)}</td>
                <td>{backup.created_by || '-'}</td>
                <td>{formatDate(backup.created_at)}</td>
                <td>
                  <button
                    onClick={() => void handleRestore(backup.id, backup.filename)}
                    className="primary-button"
                    style={{
                      backgroundColor: '#ef4444',
                      padding: '0.25rem 0.75rem',
                      fontSize: '0.875rem',
                    }}
                    disabled={restoring === backup.id}
                  >
                    {restoring === backup.id ? t('comp.backup.restoring') : t('comp.backup.restore')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
