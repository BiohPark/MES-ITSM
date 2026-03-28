'use client'

import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '@/lib/i18n'

interface SystemSettingsPanelProps {
  onBack?: () => void
  onClose?: () => void
  embedInPanel?: boolean
}

export function SystemSettingsPanel({
  onBack,
  onClose,
  embedInPanel,
}: SystemSettingsPanelProps) {
  const { t } = useI18n()
  const [backupRetentionDays, setBackupRetentionDays] = useState<number>(10)
  const [backupListLimit, setBackupListLimit] = useState<number>(50)
  const [backupScheduleIntervalHours, setBackupScheduleIntervalHours] = useState<number>(1)
  const [meetingAutosaveIntervalSec, setMeetingAutosaveIntervalSec] = useState<number>(60)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setBackupRetentionDays(
          typeof data.backup_retention_days === 'number' ? data.backup_retention_days : 10
        )
        setBackupListLimit(
          typeof data.backup_list_limit === 'number' ? data.backup_list_limit : 50
        )
        setBackupScheduleIntervalHours(
          typeof data.backup_schedule_interval_hours === 'number'
            ? data.backup_schedule_interval_hours
            : 1
        )
        setMeetingAutosaveIntervalSec(
          typeof data.meeting_autosave_interval_sec === 'number'
            ? data.meeting_autosave_interval_sec
            : 60
        )
      }
    } catch (e) {
      console.error(e)
      setMessage({ type: 'error', text: t('comp.systemSettings.loadFail') })
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const handleSave = async () => {
    const days = Math.round(Number(backupRetentionDays))
    if (!Number.isFinite(days) || days < 0 || days > 365) {
      setMessage({ type: 'error', text: t('comp.systemSettings.errRetention') })
      return
    }
    const limit = Math.round(Number(backupListLimit))
    if (!Number.isFinite(limit) || limit < 1 || limit > 500) {
      setMessage({ type: 'error', text: t('comp.systemSettings.errListLimit') })
      return
    }
    const hours = Number(backupScheduleIntervalHours)
    if (!Number.isFinite(hours) || hours < 0.25 || hours > 168) {
      setMessage({ type: 'error', text: t('comp.systemSettings.errBackupHours') })
      return
    }
    const sec = Math.round(Number(meetingAutosaveIntervalSec))
    if (!Number.isFinite(sec) || sec < 30 || sec > 600) {
      setMessage({ type: 'error', text: t('comp.systemSettings.errAutosaveSec') })
      return
    }
    try {
      setSaving(true)
      setMessage(null)
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backup_retention_days: days,
          backup_list_limit: limit,
          backup_schedule_interval_hours: hours,
          meeting_autosave_interval_sec: sec,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setBackupRetentionDays(data.backup_retention_days ?? days)
        setBackupListLimit(data.backup_list_limit ?? limit)
        setBackupScheduleIntervalHours(data.backup_schedule_interval_hours ?? hours)
        setMeetingAutosaveIntervalSec(data.meeting_autosave_interval_sec ?? sec)
        setMessage({ type: 'ok', text: t('comp.systemSettings.saveOk') })
      } else {
        setMessage({ type: 'error', text: data.error || t('comp.systemSettings.saveFail') })
      }
    } catch (e) {
      console.error(e)
      setMessage({ type: 'error', text: t('comp.systemSettings.saveError') })
    } finally {
      setSaving(false)
    }
  }

  const backLabel = t('comp.userMgmt.back')

  if (loading) {
    return (
      <div style={{ padding: '1rem' }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{
              marginBottom: '1rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#3b82f6',
              fontSize: '0.875rem',
            }}
          >
            {backLabel}
          </button>
        )}
        <p>{t('comp.systemSettings.loading')}</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem' }}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          style={{
            marginBottom: '1rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#3b82f6',
            fontSize: '0.875rem',
          }}
        >
          {backLabel}
        </button>
      )}
      <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>
        {t('comp.systemSettings.pageTitle')}
      </h3>

      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <label htmlFor="backup-retention-days">
          {t('comp.systemSettings.backupRetentionLabel')}
        </label>
        <input
          id="backup-retention-days"
          type="number"
          min={0}
          max={365}
          value={backupRetentionDays}
          onChange={(e) => setBackupRetentionDays(Number(e.target.value) || 0)}
          className="form-input"
          style={{ maxWidth: '120px' }}
        />
        <span style={{ marginLeft: '0.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
          {t('comp.systemSettings.unitDays')}
        </span>
      </div>

      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <label htmlFor="backup-list-limit">{t('comp.systemSettings.backupListLimitLabel')}</label>
        <input
          id="backup-list-limit"
          type="number"
          min={1}
          max={500}
          value={backupListLimit}
          onChange={(e) => setBackupListLimit(Number(e.target.value) || 50)}
          className="form-input"
          style={{ maxWidth: '120px' }}
        />
        <span style={{ marginLeft: '0.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
          {t('comp.systemSettings.unitCount')}
        </span>
      </div>

      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <label htmlFor="backup-schedule-interval-hours">
          {t('comp.systemSettings.backupScheduleLabel')}
        </label>
        <input
          id="backup-schedule-interval-hours"
          type="number"
          min={0.25}
          max={168}
          step={0.25}
          value={backupScheduleIntervalHours}
          onChange={(e) => setBackupScheduleIntervalHours(Number(e.target.value) || 1)}
          className="form-input"
          style={{ maxWidth: '120px' }}
        />
        <span style={{ marginLeft: '0.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
          {t('comp.systemSettings.unitHoursHint')}
        </span>
      </div>

      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <label htmlFor="meeting-autosave-interval-sec">
          {t('comp.systemSettings.meetingAutosaveLabel')}
        </label>
        <input
          id="meeting-autosave-interval-sec"
          type="number"
          min={30}
          max={600}
          value={meetingAutosaveIntervalSec}
          onChange={(e) => setMeetingAutosaveIntervalSec(Number(e.target.value) || 60)}
          className="form-input"
          style={{ maxWidth: '120px' }}
        />
        <span style={{ marginLeft: '0.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
          {t('comp.systemSettings.unitSecHint')}
        </span>
      </div>

      {message && (
        <p
          style={{
            marginBottom: '1rem',
            color: message.type === 'error' ? '#dc2626' : '#059669',
            fontSize: '0.875rem',
          }}
        >
          {message.text}
        </p>
      )}

      <div className="form-actions">
        <button
          type="button"
          onClick={handleSave}
          className="btn btn-primary"
          disabled={saving}
          style={{ opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? t('comp.systemSettings.saveSaving') : t('comp.systemSettings.saveBtn')}
        </button>
      </div>
    </div>
  )
}
