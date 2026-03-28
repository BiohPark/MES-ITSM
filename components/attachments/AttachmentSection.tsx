'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { formatFileSize } from '@/utils/file-utils'
import { useI18n } from '@/lib/i18n'

interface Attachment {
  id: string
  record_id: string
  record_type: string
  file_name: string
  file_size: number
  mime_type: string | null
  uploaded_by: string
  upload_date: string
  uploader_name?: string
}

interface AttachmentSectionProps {
  recordId: string
  recordType?: string
  currentUser?: { id: string; name: string; role: string; isAdmin?: boolean }
  onUploadComplete?: () => void
  /** 제목 옆 안내 (예: 이슈에서는 "화면 캡처·로그 등") */
  titleHint?: string
}

export function AttachmentSection({
  recordId,
  recordType = 'task',
  currentUser,
  onUploadComplete,
  titleHint,
}: AttachmentSectionProps) {
  const { t, locale } = useI18n()
  const dateLocale = locale.startsWith('en') ? 'en-US' : 'ko-KR'
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const fetchAttachments = useCallback(async () => {
    if (!recordId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/attachments/list/${recordId}?record_type=${recordType}`, {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setAttachments(data.attachments || [])
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.error || t('comp.attachmentSection.loadFail'))
      }
    } catch (err) {
      console.error('Error fetching attachments:', err)
      setError(t('comp.attachmentSection.loadFail'))
    } finally {
      setLoading(false)
    }
  }, [recordId, recordType, t])

  useEffect(() => {
    fetchAttachments()
  }, [fetchAttachments])

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)
    await uploadFiles(fileArray)
  }

  const uploadFiles = async (files: File[]) => {
    if (!currentUser) {
      setError(t('comp.attachmentSection.loginRequired'))
      return
    }

    setUploading(true)
    setError(null)

    const uploadPromises = files.map(async (file) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('record_id', recordId)
      formData.append('record_type', recordType)

      try {
        const xhr = new XMLHttpRequest()

        // 업로드 진행률 추적
        return new Promise<void>((resolve, reject) => {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const percentComplete = (e.loaded / e.total) * 100
              setUploadProgress((prev) => ({
                ...prev,
                [file.name]: percentComplete,
              }))
            }
          })

          xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
              setUploadProgress((prev) => {
                const next = { ...prev }
                delete next[file.name]
                return next
              })
              resolve()
            } else {
              reject(new Error(`Upload failed: ${xhr.statusText}`))
            }
          })

          xhr.addEventListener('error', () => {
            reject(new Error('Upload failed'))
          })

          xhr.open('POST', '/api/attachments/upload')
          xhr.send(formData)
        })
      } catch (err) {
        console.error('Error uploading file:', err)
        throw err
      }
    })

    try {
      await Promise.all(uploadPromises)
      await fetchAttachments()
      if (onUploadComplete) {
        onUploadComplete()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('comp.attachmentSection.uploadFail'))
    } finally {
      setUploading(false)
      setUploadProgress({})
    }
  }

  const handleDelete = async (attachmentId: string) => {
    if (!confirm(t('comp.attachmentSection.deleteConfirm'))) {
      return
    }

    try {
      const response = await fetch(`/api/attachments/${attachmentId}/delete`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (response.ok) {
        await fetchAttachments()
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.error || t('comp.attachmentSection.deleteFail'))
      }
    } catch (err) {
      console.error('Error deleting attachment:', err)
      setError(t('comp.attachmentSection.deleteFail'))
    }
  }

  const handleDownload = (attachmentId: string, fileName: string) => {
    window.open(`/api/attachments/${attachmentId}/download`, '_blank')
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files)
    }
  }

  const canDelete = (attachment: Attachment) => {
    if (!currentUser) return false
    return currentUser.id === attachment.uploaded_by || currentUser.role === 'admin' || !!currentUser.isAdmin
  }

  return (
    <div className="servicenow-attachment-section">
      <h3 className="servicenow-attachment-section__title">
        {t('comp.attachmentSection.title')}
        {titleHint && <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.9em' }}> — {titleHint}</span>}
      </h3>

      {/* 업로드 영역 */}
      <div
        ref={dropZoneRef}
        className={`servicenow-attachment-upload ${dragActive ? 'servicenow-attachment-upload--active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="servicenow-attachment-upload__content">
          <p className="servicenow-attachment-upload__text">
            {t('comp.attachmentSection.dropHint')}
          </p>
          <button
            type="button"
            className="servicenow-button servicenow-button--primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !currentUser}
          >
            {t('comp.attachmentSection.chooseFile')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleFileSelect(e.target.files)}
          />
        </div>
        {uploading && (
          <div className="servicenow-attachment-upload__progress">
            <p>{t('comp.attachmentSection.uploading')}</p>
            {Object.entries(uploadProgress).map(([fileName, progress]) => (
              <div key={fileName} className="servicenow-attachment-upload__progress-item">
                <span>{fileName}</span>
                <div className="servicenow-attachment-upload__progress-bar">
                  <div
                    className="servicenow-attachment-upload__progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="servicenow-attachment-section__error">
          {error}
        </div>
      )}

      {/* 첨부파일 목록 */}
      {loading ? (
        <div className="servicenow-attachment-section__loading">{t('comp.attachmentSection.loading')}</div>
      ) : attachments.length > 0 ? (
        <div className="servicenow-attachment-list">
          <table className="servicenow-table">
            <thead>
              <tr>
                <th style={{ width: '72px' }}>{t('comp.attachmentSection.colPreview')}</th>
                <th>{t('comp.attachmentSection.colName')}</th>
                <th>{t('comp.attachmentSection.colSize')}</th>
                <th>{t('comp.attachmentSection.colUploader')}</th>
                <th>{t('comp.attachmentSection.colUploadedAt')}</th>
                <th>{t('comp.attachmentSection.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {attachments.map((attachment) => {
                const isImage = (attachment.mime_type || '').startsWith('image/')
                return (
                  <tr key={attachment.id}>
                    <td style={{ verticalAlign: 'middle' }}>
                      {isImage ? (
                        <a
                          href={`/api/attachments/${attachment.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={t('comp.attachmentSection.previewLarge')}
                          style={{ display: 'inline-block', lineHeight: 0 }}
                        >
                          <img
                            src={`/api/attachments/${attachment.id}/download`}
                            alt={attachment.file_name}
                            style={{
                              maxWidth: 56,
                              maxHeight: 56,
                              objectFit: 'contain',
                              border: '1px solid #e2e8f0',
                              borderRadius: 4,
                              backgroundColor: '#f8fafc',
                            }}
                          />
                        </a>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className="servicenow-attachment-list__filename">
                        {attachment.file_name}
                      </span>
                    </td>
                    <td>{formatFileSize(attachment.file_size)}</td>
                    <td>{attachment.uploader_name || 'Unknown'}</td>
                    <td>
                      {new Date(attachment.upload_date).toLocaleString(dateLocale, {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td>
                      <div className="servicenow-attachment-list__actions">
                        <button
                          type="button"
                          className="servicenow-button servicenow-button--link"
                          onClick={() => handleDownload(attachment.id, attachment.file_name)}
                          title={t('comp.attachmentSection.download')}
                        >
                          {t('comp.attachmentSection.download')}
                        </button>
                        {canDelete(attachment) && (
                          <button
                            type="button"
                            className="servicenow-button servicenow-button--link servicenow-button--danger"
                            onClick={() => handleDelete(attachment.id)}
                            title={t('comp.attachmentSection.delete')}
                          >
                            {t('comp.attachmentSection.delete')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="servicenow-attachment-section__empty">
          {t('comp.attachmentSection.empty')}
        </div>
      )}
    </div>
  )
}

