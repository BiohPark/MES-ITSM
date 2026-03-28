'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { Issue } from '@/types/issue'
import { AttachmentSection } from '@/components/attachments/AttachmentSection'
import { useI18n } from '@/lib/i18n'

/** 설명 본문 HTML 허용 태그만 남기기 (XSS 방지) */
function sanitizeDescriptionHtml(html: string): string {
  if (!html || typeof html !== 'string') return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const allowedTags = new Set(['p', 'div', 'br', 'span', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'img', 'a'])
  const allowedAttrs: Record<string, Set<string>> = {
    img: new Set(['src', 'alt', 'style', 'width', 'height']),
    a: new Set(['href', 'target', 'rel']),
    span: new Set(['style']),
    p: new Set(['style']),
    div: new Set(['style']),
  }
  function sanitizeNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) return node.cloneNode(true)
    if (node.nodeType !== Node.ELEMENT_NODE) return null
    const el = node as Element
    const tag = el.tagName.toLowerCase()
    if (!allowedTags.has(tag)) return null
    const attrs = allowedAttrs[tag]
    const newEl = document.createElement(tag)
    if (attrs && el.hasAttributes()) {
      for (const a of Array.from(el.attributes)) {
        if (!attrs.has(a.name.toLowerCase())) continue
        if (tag === 'img' && a.name === 'src' && !/^\/api\/attachments\/[^/]+\/download$/.test(a.value)) continue
        if (tag === 'a' && a.name === 'href' && (a.value.startsWith('javascript:') || a.value.startsWith('data:'))) continue
        newEl.setAttribute(a.name, a.value)
      }
    }
    for (const child of Array.from(el.childNodes)) {
      const sanitized = sanitizeNode(child)
      if (sanitized) newEl.appendChild(sanitized)
    }
    return newEl
  }
  const body = doc.body
  const fragment = document.createDocumentFragment()
  for (const child of Array.from(body.childNodes)) {
    const sanitized = sanitizeNode(child)
    if (sanitized) fragment.appendChild(sanitized)
  }
  const out = document.createElement('div')
  out.appendChild(fragment)
  return out.innerHTML
}

// 원인 분류 옵션
const CAUSE_CATEGORIES = [
  '코드 오류',
  '설정 오류',
  '인프라 문제',
  '데이터 문제',
  '사용자 오류',
  '외부 의존성',
  '성능 문제',
  '보안 문제',
  '기타',
]

// 모듈 옵션 (예시, 실제로는 시스템에 맞게 수정 필요)
const MODULES = [
  'MES 1.0(eOM)',
  'MES 1.0(eDM)',
  'MES 1.0(eWF)',
  'MES 1.0(Report)',
  '1단지 WD',
  '2단지 WD',
  '1단지 ET',
  '2단지 ET',
  '1단지 eMBR(MX)',
  'EAI',
  'GMP 절차 위반',
]

const CAUSE_VALUE_TO_I18N: Record<string, string> = {
  '코드 오류': 'causeCode',
  '설정 오류': 'causeConfig',
  '인프라 문제': 'causeInfra',
  '데이터 문제': 'causeData',
  '사용자 오류': 'causeUser',
  '외부 의존성': 'causeExternal',
  '성능 문제': 'causePerf',
  '보안 문제': 'causeSecurity',
  '기타': 'causeOther',
}

/** 연결 일감 선택용 옵션 (프로젝트명 - 일감명) */
export type TaskLinkOption = { value: string; label: string }

interface IssueEditModalProps {
  issue: Issue
  mode: 'create' | 'edit'
  onClose: () => void
  onSave: (issue: Issue) => Promise<void> | void
  allIssues?: Issue[] // 관련 이슈 선택용
  /** 첨부파일 업로드/삭제 시 필요 (id, name, role) */
  currentUser?: { id: string; name: string; role: string; isAdmin?: boolean }
  /** 연결 일감 선택 목록 (해결용 일감 연결) */
  taskLinkOptions?: TaskLinkOption[]
  /** 프로젝트 목록 (이슈에서 일감 생성 시 선택용) */
  projectOptions?: { id: string; name: string }[]
  /** 연결된 GMP Record로 이동 (Deviation 시 자동 생성된 레코드) */
  onOpenGmpRecord?: (gmpRecordId: string) => void
  /** 연결된 일감으로 이동 */
  onOpenTask?: (taskId: string) => void
  /** 해결용 일감 새로 만들기 (projectId, title, issueId) → 새 일감 ID. 생성 후 linked_issue_id·linked_task_id 연결됨 */
  onCreateTask?: (projectId: string, title: string, issueId: string) => Promise<string | null>
  /** 일감 생성 후 목록 갱신용 */
  onTaskCreated?: () => void
}

export function IssueEditModal({
  issue,
  mode,
  onClose,
  onSave,
  allIssues = [],
  currentUser,
  taskLinkOptions = [],
  projectOptions = [],
  onOpenGmpRecord,
  onOpenTask,
  onCreateTask,
  onTaskCreated,
}: IssueEditModalProps) {
  const { t } = useI18n()
  const [showCreateTaskForm, setShowCreateTaskForm] = useState(false)
  const [newTaskProjectId, setNewTaskProjectId] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [creatingTask, setCreatingTask] = useState(false)
  const [formData, setFormData] = useState<Issue>({
    ...issue,
    description: issue.description || '',
    status: issue.status || 'Open',
    occurred_date: issue.occurred_date || new Date().toISOString().slice(0, 10),
    due_date: issue.due_date || '',
    resolved_date: issue.resolved_date || '',
    sw_version: issue.sw_version || '',
    resolved_sw_version: issue.resolved_sw_version || '',
    cause: issue.cause || '',
    cause_category: issue.cause_category || '',
    module: issue.module || '',
    is_deviation: issue.is_deviation || false,
    related_issue_id: issue.related_issue_id || '',
    linked_gmp_record_id: issue.linked_gmp_record_id || '',
    linked_task_id: issue.linked_task_id || '',
  })
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])
  const [pastingImage, setPastingImage] = useState(false)
  const descriptionRef = useRef<HTMLDivElement>(null)

  // 모달을 열거나 다른 이슈를 선택할 때 설명 본문 초기화
  useEffect(() => {
    const el = descriptionRef.current
    if (!el) return
    el.innerHTML = issue.description || ''
    if (!(issue.description || '').trim()) el.classList.add('description-empty')
    else el.classList.remove('description-empty')
  }, [issue.id])

  const syncDescriptionToForm = useCallback(() => {
    const el = descriptionRef.current
    if (!el) return
    const raw = el.innerHTML
    const value = raw === '<br>' || raw === '' ? '' : raw
    if (el.innerText?.trim() === '') el.classList.add('description-empty')
    else el.classList.remove('description-empty')
    setFormData((prev) => ({ ...prev, description: sanitizeDescriptionHtml(value) || value }))
  }, [])

  const handleDescriptionPaste = useCallback(
    async (e: React.ClipboardEvent<HTMLDivElement>) => {
      const items = e.clipboardData?.items
      if (!items) return
      let imageFile: File | null = null
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          imageFile = items[i].getAsFile()
          break
        }
      }
      if (!imageFile || !issue.id) return

      e.preventDefault()
      setPastingImage(true)
      try {
        const formDataUpload = new FormData()
        formDataUpload.append('file', imageFile, imageFile.name || `pasted-image.${imageFile.type.split('/')[1] || 'png'}`)
        formDataUpload.append('record_id', issue.id)
        formDataUpload.append('record_type', 'issue')

        const res = await fetch('/api/attachments/upload', {
          method: 'POST',
          credentials: 'include',
          body: formDataUpload,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.attachment_id) {
          setPastingImage(false)
          return
        }

        const img = document.createElement('img')
        img.src = `/api/attachments/${data.attachment_id}/download`
        img.alt = t('comp.issueModal.screenCaptureAlt')
        img.style.maxWidth = '100%'
        img.style.height = 'auto'
        img.style.display = 'block'
        img.setAttribute('data-pasted', '1')

        const sel = window.getSelection()
        const range = sel?.getRangeAt(0)
        if (range && descriptionRef.current?.contains(range.commonAncestorContainer)) {
          range.deleteContents()
          range.insertNode(img)
          range.collapse(false)
        } else if (descriptionRef.current) {
          descriptionRef.current.appendChild(img)
        }
        syncDescriptionToForm()
      } finally {
        setPastingImage(false)
      }
    },
    [issue.id, syncDescriptionToForm, t]
  )

  useEffect(() => {
    const abortController = new AbortController()
    let isMounted = true

    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users', {
          signal: abortController.signal,
        })
        if (abortController.signal.aborted || !isMounted) return
        if (response.ok) {
          const data = await response.json()
          if (abortController.signal.aborted || !isMounted) return
          const userList = data.users || []
          setUsers(userList)
          // 신규 이슈 생성 시 담당자 미입력이면 그룹 매니저를 1차 담당자로 기본 설정
          if (mode === 'create' && (!issue.owner || String(issue.owner).trim() === '') && userList.length > 0) {
            const groupManager = userList.find((u: { role?: string }) => u.role === '그룹 매니저')
            if (groupManager?.name) {
              setFormData((prev) => ({ ...prev, owner: groupManager.name }))
            }
          }
        }
      } catch (error) {
        if (abortController.signal.aborted) return
        console.error('Error fetching users:', error)
      }
    }

    fetchUsers()
    const issueWithFields = { ...issue } as any
    if (!issueWithFields.description) issueWithFields.description = ''
    if (!issueWithFields.status) issueWithFields.status = 'Open'
    if (!issueWithFields.occurred_date) issueWithFields.occurred_date = new Date().toISOString().slice(0, 10)
    if (!issueWithFields.is_deviation) issueWithFields.is_deviation = false
    setFormData(issueWithFields as Issue)

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [issue])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const rawDesc = descriptionRef.current?.innerHTML ?? formData.description ?? ''
    const sanitizedDesc = sanitizeDescriptionHtml(rawDesc === '<br>' ? '' : rawDesc) || (formData.description || '')
    if (formData.owner && !users.some(u => u.name === formData.owner)) {
      alert(t('comp.childModal.unknownUser'))
      return
    }
    setSaving(true)
    try {
      const toSave: Issue = { ...formData, description: sanitizedDesc }
      await onSave(toSave)
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const updatedData: any = {
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }
    
    // 해결일과 해결 S/W 버전이 모두 입력되면 상태를 Closed로 자동 변경
    // (상태를 직접 변경하는 경우는 제외)
    if (name !== 'status' && 
        updatedData.resolved_date && 
        updatedData.resolved_sw_version && 
        updatedData.resolved_date.trim() !== '' && 
        updatedData.resolved_sw_version.trim() !== '') {
      updatedData.status = 'Closed'
    }
    
    setFormData(updatedData)
  }

  // 현재 이슈를 제외한 관련 이슈 선택 가능 목록
  const availableRelatedIssues = allIssues.filter((i) => i.id !== issue.id)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>{mode === 'edit' ? t('comp.issueModal.titleEdit') : t('comp.issueModal.titleCreate')}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="submit"
              form="issue-form"
              disabled={saving}
              className="btn btn-primary"
              style={{ margin: 0 }}
            >
              {saving ? t('comp.ui.saving') : t('comp.ui.save')}
            </button>
            <button className="modal-close" onClick={onClose}>
              ×
            </button>
          </div>
        </div>

        <form id="issue-form" onSubmit={handleSubmit} className="project-form">
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '1.125rem', fontWeight: 600 }}>
              <input
                type="checkbox"
                id="is_deviation"
                name="is_deviation"
                checked={formData.is_deviation || false}
                onChange={handleChange}
                style={{ width: 'auto', cursor: 'pointer', transform: 'scale(1.2)' }}
              />
              <span>{t('comp.issueModal.deviationLabel')}</span>
            </label>
          </div>

          <div className="form-group">
            <label htmlFor="id">{t('comp.issueModal.issueId')}</label>
            <input
              type="text"
              id="id"
              name="id"
              value={formData.id}
              disabled={mode === 'edit'}
              className="form-input"
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="title">{t('comp.issueModal.issueTitle')}</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="status">{t('comp.issueModal.status')}</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
                className="form-input"
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="owner">{t('comp.issueModal.owner')}</label>
              <select
                id="owner"
                name="owner"
                value={formData.owner || ''}
                onChange={handleChange}
                required
                className="form-input"
              >
                <option value="">{t('comp.issueModal.select')}</option>
                {users.map((user) => (
                  <option key={user.id} value={user.name}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="occurred_date">{t('comp.issueModal.occurredDate')}</label>
              <input
                type="date"
                id="occurred_date"
                name="occurred_date"
                value={formData.occurred_date || ''}
                onChange={handleChange}
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="due_date">{t('comp.issueModal.dueDate')}</label>
              <input
                type="date"
                id="due_date"
                name="due_date"
                value={formData.due_date || ''}
                onChange={handleChange}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="sw_version">{t('comp.issueModal.swVersion')}</label>
              <input
                type="text"
                id="sw_version"
                name="sw_version"
                value={formData.sw_version || ''}
                onChange={handleChange}
                className="form-input"
                placeholder={t('comp.issueModal.swVersionPh')}
              />
            </div>

            <div className="form-group">
              <label htmlFor="cause_category">{t('comp.issueModal.causeCategory')}</label>
              <select
                id="cause_category"
                name="cause_category"
                value={formData.cause_category || ''}
                onChange={handleChange}
                className="form-input"
              >
                <option value="">{t('comp.issueModal.select')}</option>
                {CAUSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t(`comp.issueModal.${CAUSE_VALUE_TO_I18N[category]}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="module">{t('comp.issueModal.module')}</label>
              <select
                id="module"
                name="module"
                value={formData.module || ''}
                onChange={handleChange}
                className="form-input"
              >
                <option value="">{t('comp.issueModal.select')}</option>
                {MODULES.map((module) => (
                  <option key={module} value={module}>
                    {module === 'GMP 절차 위반' ? t('comp.issueModal.moduleGmpViolation') : module}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="related_issue_id">{t('comp.issueModal.relatedIssueId')}</label>
            <select
              id="related_issue_id"
              name="related_issue_id"
              value={formData.related_issue_id || ''}
              onChange={handleChange}
              className="form-input"
            >
              <option value="">{t('comp.issueModal.selectNone')}</option>
              {availableRelatedIssues.map((relatedIssue) => (
                <option key={relatedIssue.id} value={relatedIssue.id}>
                  {relatedIssue.id} - {relatedIssue.title}
                </option>
              ))}
            </select>
          </div>

          {/* 연결된 GMP Record (Deviation 체크 시 자동 생성·링크) */}
          {(formData.linked_gmp_record_id || formData.is_deviation) && (
            <div className="form-group">
              <label>{t('comp.issueModal.linkedGmpRecord')}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {formData.linked_gmp_record_id ? (
                  <>
                    <span className="form-input" style={{ flex: 1, minWidth: 0 }}>
                      {formData.linked_gmp_record_id}
                    </span>
                    {onOpenGmpRecord && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ backgroundColor: '#2563eb', color: '#fff', borderColor: '#2563eb' }}
                        onClick={() => onOpenGmpRecord(formData.linked_gmp_record_id!)}
                      >
                        {t('comp.issueModal.openGmpRecord')}
                      </button>
                    )}
                  </>
                ) : (
                  <span style={{ fontSize: '0.9rem', color: '#64748b' }}>
                    {t('comp.issueModal.gmpHintOnSave')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 연결된 일감 (해결을 위한 일감 연결) */}
          <div className="form-group">
            <label htmlFor="linked_task_id">{t('comp.issueModal.linkedTask')}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select
                id="linked_task_id"
                name="linked_task_id"
                value={formData.linked_task_id || ''}
                onChange={handleChange}
                className="form-input"
                style={{ flex: 1, minWidth: 0 }}
              >
                <option value="">{t('comp.issueModal.selectNone')}</option>
                {taskLinkOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {formData.linked_task_id && onOpenTask && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ backgroundColor: '#2563eb', color: '#fff', borderColor: '#2563eb' }}
                  onClick={() => onOpenTask(formData.linked_task_id!)}
                >
                  {t('comp.issueModal.openTask')}
                </button>
              )}
            </div>
            {onCreateTask && projectOptions.length > 0 && issue.id && (
              <>
                {!showCreateTaskForm ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ marginTop: '0.5rem' }}
                    onClick={() => {
                      setShowCreateTaskForm(true)
                      setNewTaskTitle(formData.title || issue.title || '')
                    }}
                  >
                    {t('comp.issueModal.newResolveTask')}
                  </button>
                ) : (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                      {t('comp.issueModal.createResolveTaskTitle')}
                    </div>
                    <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                      <label>{t('comp.issueModal.project')}</label>
                      <select
                        className="form-input"
                        value={newTaskProjectId}
                        onChange={(e) => setNewTaskProjectId(e.target.value)}
                      >
                        <option value="">{t('comp.issueModal.select')}</option>
                        {projectOptions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                      <label>{t('comp.issueModal.taskTitle')}</label>
                      <input
                        type="text"
                        className="form-input"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder={t('comp.issueModal.taskTitlePh')}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={creatingTask || !newTaskProjectId.trim() || !newTaskTitle.trim()}
                        onClick={async () => {
                          if (!newTaskProjectId.trim() || !newTaskTitle.trim()) return
                          setCreatingTask(true)
                          try {
                            const taskId = await onCreateTask(newTaskProjectId.trim(), newTaskTitle.trim(), issue.id)
                            if (taskId) {
                              setFormData((prev) => ({ ...prev, linked_task_id: taskId }))
                              setShowCreateTaskForm(false)
                              setNewTaskProjectId('')
                              setNewTaskTitle('')
                              onTaskCreated?.()
                            }
                          } finally {
                            setCreatingTask(false)
                          }
                        }}
                      >
                        {creatingTask ? t('comp.issueModal.creating') : t('comp.issueModal.createAndLink')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={creatingTask}
                        onClick={() => {
                          setShowCreateTaskForm(false)
                          setNewTaskProjectId('')
                          setNewTaskTitle('')
                        }}
                      >
                        {t('comp.ui.cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="cause">{t('comp.issueModal.cause')}</label>
            <textarea
              id="cause"
              name="cause"
              value={formData.cause || ''}
              onChange={handleChange}
              className="form-input"
              rows={4}
              placeholder={t('comp.issueModal.causePh')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">{t('comp.issueModal.descriptionLabel')}</label>
            <div style={{ position: 'relative' }}>
              {(pastingImage || null) && (
                <div style={{ position: 'absolute', top: 8, right: 8, fontSize: '0.8rem', color: '#64748b', zIndex: 2 }}>
                  {t('comp.issueModal.pastingImage')}
                </div>
              )}
              <div
                ref={descriptionRef}
                contentEditable
                suppressContentEditableWarning
                id="description"
                role="textbox"
                aria-label={t('comp.issueModal.descriptionAria')}
                className="form-input"
                data-placeholder={t('comp.issueModal.descriptionDataPh')}
                onInput={syncDescriptionToForm}
                onBlur={syncDescriptionToForm}
                onPaste={handleDescriptionPaste}
                style={{
                  minHeight: '8rem',
                  maxHeight: '20rem',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              />
              <style>{`
                #description.description-empty::before,
                #description[data-placeholder]:empty::before { content: attr(data-placeholder); color: #94a3b8; }
                #description img { max-width: 100%; height: auto; display: block; margin: 0.5rem 0; border-radius: 4px; border: 1px solid #e2e8f0; }
              `}</style>
            </div>
          </div>

          {/* 첨부파일: 화면 캡처, 로그 등 — 편집 시에만 표시(저장된 이슈 ID 필요) */}
          {issue.id ? (
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <AttachmentSection
                recordId={issue.id}
                recordType="issue"
                currentUser={currentUser}
                titleHint={t('comp.issueModal.attachmentHint')}
              />
            </div>
          ) : (
            <div className="form-group" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: 6, fontSize: '0.9rem', color: '#64748b' }}>
              <strong>{t('comp.issueModal.attachmentStrong')}</strong> {t('comp.issueModal.attachmentAfterSave')}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="resolved_date">{t('comp.issueModal.resolvedDate')}</label>
              <input
                type="date"
                id="resolved_date"
                name="resolved_date"
                value={formData.resolved_date || ''}
                onChange={handleChange}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="resolved_sw_version">{t('comp.issueModal.resolvedSwVersion')}</label>
              <input
                type="text"
                id="resolved_sw_version"
                name="resolved_sw_version"
                value={formData.resolved_sw_version || ''}
                onChange={handleChange}
                className="form-input"
                placeholder={t('comp.issueModal.resolvedSwVersionPh')}
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

