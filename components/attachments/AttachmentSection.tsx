'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { formatFileSize } from '@/utils/file-utils'

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
  currentUser?: { id: string; name: string; role: string }
  onUploadComplete?: () => void
}

export function AttachmentSection({
  recordId,
  recordType = 'task',
  currentUser,
  onUploadComplete,
}: AttachmentSectionProps) {
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
        setError(errorData.error || '첨부파일 목록을 불러오는데 실패했습니다.')
      }
    } catch (err) {
      console.error('Error fetching attachments:', err)
      setError('첨부파일 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [recordId, recordType])

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
      setError('로그인이 필요합니다.')
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
      setError(err instanceof Error ? err.message : '파일 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
      setUploadProgress({})
    }
  }

  const handleDelete = async (attachmentId: string) => {
    if (!confirm('이 첨부파일을 삭제하시겠습니까?')) {
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
        setError(errorData.error || '첨부파일 삭제에 실패했습니다.')
      }
    } catch (err) {
      console.error('Error deleting attachment:', err)
      setError('첨부파일 삭제에 실패했습니다.')
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
    return currentUser.id === attachment.uploaded_by || currentUser.role === 'admin'
  }

  return (
    <div className="servicenow-attachment-section">
      <h3 className="servicenow-attachment-section__title">첨부파일</h3>

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
            파일을 여기에 드래그하거나 클릭하여 선택하세요
          </p>
          <button
            type="button"
            className="servicenow-button servicenow-button--primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !currentUser}
          >
            파일 선택
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
            <p>업로드 중...</p>
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
        <div className="servicenow-attachment-section__loading">로딩 중...</div>
      ) : attachments.length > 0 ? (
        <div className="servicenow-attachment-list">
          <table className="servicenow-table">
            <thead>
              <tr>
                <th>파일명</th>
                <th>크기</th>
                <th>업로더</th>
                <th>업로드 날짜</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {attachments.map((attachment) => (
                <tr key={attachment.id}>
                  <td>
                    <span className="servicenow-attachment-list__filename">
                      {attachment.file_name}
                    </span>
                  </td>
                  <td>{formatFileSize(attachment.file_size)}</td>
                  <td>{attachment.uploader_name || 'Unknown'}</td>
                  <td>
                    {new Date(attachment.upload_date).toLocaleString('ko-KR', {
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
                        title="다운로드"
                      >
                        다운로드
                      </button>
                      {canDelete(attachment) && (
                        <button
                          type="button"
                          className="servicenow-button servicenow-button--link servicenow-button--danger"
                          onClick={() => handleDelete(attachment.id)}
                          title="삭제"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="servicenow-attachment-section__empty">
          첨부된 파일이 없습니다.
        </div>
      )}
    </div>
  )
}

