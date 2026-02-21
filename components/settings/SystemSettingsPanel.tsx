'use client'

import { useState, useEffect } from 'react'

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
  const [backupRetentionDays, setBackupRetentionDays] = useState<number>(10)
  const [backupListLimit, setBackupListLimit] = useState<number>(50)
  const [backupScheduleIntervalHours, setBackupScheduleIntervalHours] = useState<number>(1)
  const [meetingAutosaveIntervalSec, setMeetingAutosaveIntervalSec] = useState<number>(60)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
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
      setMessage({ type: 'error', text: '설정을 불러오지 못했습니다.' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    const days = Math.round(Number(backupRetentionDays))
    if (!Number.isFinite(days) || days < 0 || days > 365) {
      setMessage({ type: 'error', text: '백업 보관 일수는 0~365 사이로 입력하세요.' })
      return
    }
    const limit = Math.round(Number(backupListLimit))
    if (!Number.isFinite(limit) || limit < 1 || limit > 500) {
      setMessage({ type: 'error', text: '백업 목록 limit은 1~500 사이로 입력하세요.' })
      return
    }
    const hours = Number(backupScheduleIntervalHours)
    if (!Number.isFinite(hours) || hours < 0.25 || hours > 168) {
      setMessage({ type: 'error', text: '자동 백업 주기는 0.25~168(시간) 사이로 입력하세요.' })
      return
    }
    const sec = Math.round(Number(meetingAutosaveIntervalSec))
    if (!Number.isFinite(sec) || sec < 30 || sec > 600) {
      setMessage({ type: 'error', text: '회의록 자동 저장 주기는 30~600(초) 사이로 입력하세요.' })
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
        setMessage({ type: 'ok', text: '저장되었습니다. 자동 백업 주기는 서버 재시작 후 적용됩니다.' })
      } else {
        setMessage({ type: 'error', text: data.error || '저장에 실패했습니다.' })
      }
    } catch (e) {
      console.error(e)
      setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' })
    } finally {
      setSaving(false)
    }
  }

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
            ← 설정 목록
          </button>
        )}
        <p>로딩 중...</p>
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
          ← 설정 목록
        </button>
      )}
      <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>
        시스템 설정
      </h3>

      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <label htmlFor="backup-retention-days">
          백업 보관 일수 (이 기간이 지난 백업 파일은 자동 삭제됩니다)
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
          일 (0~365)
        </span>
      </div>

      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <label htmlFor="backup-list-limit">백업 목록 조회 개수</label>
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
          개 (1~500)
        </span>
      </div>

      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <label htmlFor="backup-schedule-interval-hours">자동 백업 실행 주기 (시간)</label>
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
          시간 (0.25~168, 서버 재시작 후 적용)
        </span>
      </div>

      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <label htmlFor="meeting-autosave-interval-sec">회의록 자동 저장 주기 (초)</label>
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
          초 (30~600)
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
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}
