'use client'

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
  const [backups, setBackups] = useState<BackupMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState<number | null>(null)

  const fetchBackups = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/backup?limit=100')
      if (!response.ok) {
        throw new Error('백업 목록 조회에 실패했습니다.')
      }
      const data = await response.json()
      setBackups(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBackups()
  }, [fetchBackups])

  const handleCreateBackup = async () => {
    if (!confirm('수동 백업을 생성하시겠습니까?')) {
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
        throw new Error(errorData.error || '백업 생성에 실패했습니다.')
      }

      await fetchBackups()
      alert('백업이 생성되었습니다.')
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setCreating(false)
    }
  }

  const handleRestore = async (backupId: number, filename: string) => {
    if (!confirm(`정말로 "${filename}" 백업으로 데이터베이스를 복구하시겠습니까?\n\n주의: 현재 데이터는 모두 삭제되고 백업 데이터로 대체됩니다.`)) {
      return
    }

    if (!confirm('이 작업은 되돌릴 수 없습니다. 정말 진행하시겠습니까?')) {
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
        throw new Error(errorData.error || '복구에 실패했습니다.')
      }

      alert('데이터베이스가 성공적으로 복구되었습니다. 페이지를 새로고침합니다.')
      window.location.reload()
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.')
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
    return d.toLocaleString('ko-KR')
  }

  if (loading) {
    return (
      <div className="placeholder">
        <p>데이터를 불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>백업 및 복구 관리</h2>
        <div className="table-actions">
          <button
            onClick={handleCreateBackup}
            className="primary-button"
            disabled={creating}
          >
            {creating ? '백업 중...' : '수동 백업 생성'}
          </button>
          <button onClick={fetchBackups} className="refresh-button">
            새로고침
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1rem', padding: '1rem', background: '#eff6ff', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
        <p style={{ margin: 0, marginBottom: '0.5rem' }}>
          <strong>안내:</strong> 시스템은 1시간마다 자동으로 백업을 생성합니다.
        </p>
        <p style={{ margin: 0, marginBottom: '0.5rem' }}>
          <strong>10일이 지난 백업 파일은 자동으로 삭제</strong>됩니다.
        </p>
        <p style={{ margin: 0 }}>
          복구 시 현재 데이터는 모두 삭제되고 선택한 백업 데이터로 대체됩니다.
        </p>
      </div>

      {error && (
        <div className="placeholder">
          <p style={{ color: '#e74c3c' }}>오류: {error}</p>
        </div>
      )}

      {backups.length === 0 ? (
        <div className="placeholder">
          <p>백업이 없습니다.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>파일명</th>
              <th>타입</th>
              <th>크기</th>
              <th>생성자</th>
              <th>생성일</th>
              <th>작업</th>
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
                    {backup.backup_type === 'auto' ? '자동' : '수동'}
                  </span>
                </td>
                <td>{formatFileSize(backup.file_size)}</td>
                <td>{backup.created_by || '-'}</td>
                <td>{formatDate(backup.created_at)}</td>
                <td>
                  <button
                    onClick={() => handleRestore(backup.id, backup.filename)}
                    className="primary-button"
                    style={{
                      backgroundColor: '#ef4444',
                      padding: '0.25rem 0.75rem',
                      fontSize: '0.875rem',
                    }}
                    disabled={restoring === backup.id}
                  >
                    {restoring === backup.id ? '복구 중...' : '복구'}
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

