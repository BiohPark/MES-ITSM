'use client'

import { useState, useEffect } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { Project, ProjectChild } from '@/types/project'
import { CommentsSection } from '../common/CommentsSection'

export function TaskEditModal({
  task,
  projectId,
  projectName,
  projects,
  mode,
  onClose,
  onSave,
  isGmpRecord = false,
  currentUser,
}: {
  task: ProjectChild
  projectId: string | null
  projectName: string
  projects: Project[]
  mode: 'create' | 'edit'
  onClose: () => void
  onSave: (task: ProjectChild, projectId: string | null) => Promise<void> | void
  isGmpRecord?: boolean
  currentUser?: { name: string; username: string }
}) {
  const [formData, setFormData] = useState<any>({ ...task, description: (task as any).description || '', progress: (task as any).progress || 0 })
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projectId || null)
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    fetchUsers()
    const taskWithFields = { ...task } as any
    if (!taskWithFields.description) taskWithFields.description = ''
    if (!taskWithFields.progress) taskWithFields.progress = 0
    if (!taskWithFields.start) taskWithFields.start = new Date().toISOString().slice(0, 10)
    if (isGmpRecord) {
      if (!taskWithFields.kind) taskWithFields.kind = 'CC'
      if (taskWithFields.number === undefined || taskWithFields.number === null) taskWithFields.number = 0
    }
    setFormData(taskWithFields)
    setSelectedProjectId(projectId || null)
  }, [task, projectId, isGmpRecord])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    if (formData.owner && !users.some(u => u.name === formData.owner)) {
      alert('등록되지 않은 사용자입니다.')
      return
    }
    
    // GMP Record의 number 필드가 빈 값이면 0으로 설정
    if (isGmpRecord && ((formData as any).number === '' || (formData as any).number === undefined || (formData as any).number === null)) {
      (formData as any).number = 0
    }
    
    setSaving(true)
    try {
      await onSave(formData, selectedProjectId)
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev: any) => ({
      ...prev,
      [name]:
        name === 'progress'
          ? parseInt(value, 10) || 0
          : name === 'number'
          ? parseInt(value, 10) || 0
          : value,
    }))
  }

  const handleNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // 숫자만 입력 가능, 최대 5자리
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 5)
    // 빈 값도 허용 (입력 중일 수 있음)
    setFormData((prev: any) => ({
      ...prev,
      number: numericValue === '' ? '' : parseInt(numericValue, 10),
    }))
  }

  const handleNumberBlur = () => {
    // 포커스를 잃을 때 빈 값이면 0으로 설정, 아니면 현재 값 유지
    setFormData((prev: any) => ({
      ...prev,
      number: prev.number === '' || prev.number === undefined || prev.number === null ? 0 : prev.number,
    }))
  }

  return (
    <>
      <div className="modal-overlay side-panel" onClick={onClose} />
      <div className="modal-content side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{mode === 'edit' ? 'Record 일감 수정' : '새 일감 추가'}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="submit"
              form="task-form"
              disabled={saving}
              className="btn btn-primary"
              style={{ margin: 0 }}
            >
              {saving ? '저장 중...' : 'Save'}
            </button>
            <button className="modal-close" onClick={onClose}>
              ×
            </button>
          </div>
        </div>

        <form id="task-form" onSubmit={handleSubmit} className="project-form">
          <div className="form-group">
            <label htmlFor="task-id">일감 ID</label>
            <input
              type="text"
              id="task-id"
              name="id"
              value={formData.id}
              disabled={mode === 'edit'}
              className="form-input"
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="project-select">프로젝트</label>
            <select
              id="project-select"
              value={selectedProjectId || 'N/A'}
              onChange={(e) => setSelectedProjectId(e.target.value === 'N/A' ? null : e.target.value)}
              className="form-input"
            >
              <option value="N/A">N/A (프로젝트 없음)</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.id})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="title">일감 제목</label>
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

          {isGmpRecord && (
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="kind">종류</label>
                <select
                  id="kind"
                  name="kind"
                  value={(formData as any).kind || 'CC'}
                  onChange={handleChange}
                  className="form-input"
                  required
                >
                  <option value="CC">CC</option>
                  <option value="CAPA">CAPA</option>
                  <option value="CPA">CPA</option>
                  <option value="Deviation">Deviation</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="number">번호</label>
                <input
                  type="text"
                  id="number"
                  name="number"
                  value={
                    (formData as any).number === '' || (formData as any).number === undefined || (formData as any).number === null
                      ? ''
                      : String((formData as any).number || 0)
                  }
                  onChange={handleNumberChange}
                  onBlur={handleNumberBlur}
                  maxLength={5}
                  className="form-input"
                  placeholder="00000"
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="description">상세 내용</label>
            <textarea
              id="description"
              name="description"
              value={formData.description || ''}
              onChange={handleChange}
              className="form-input"
              rows={6}
              style={{
                minHeight: '120px',
                resize: 'vertical',
                fontFamily: 'inherit',
                fontSize: '0.875rem',
                lineHeight: '1.4',
              }}
              placeholder="일감의 상세 내용을 입력하세요..."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="owner">담당자</label>
              <select
                id="owner"
                name="owner"
                value={formData.owner || ''}
                onChange={handleChange}
                required
                className="form-input"
              >
                <option value="">선택하세요</option>
                {users.map((user) => (
                  <option key={user.id} value={user.name}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="status">상태</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
                className="form-input"
              >
                <option value="Planning">Planning</option>
                <option value="In Progress">In Progress</option>
                <option value="Issued">Issued</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="progress">진행률 (%)</label>
              <input
                type="number"
                id="progress"
                name="progress"
                value={(formData as any).progress || 0}
                onChange={handleChange}
                min="0"
                max="100"
                className="form-input"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="start">시작일</label>
              <input
                type="date"
                id="start"
                name="start"
                value={(formData as any).start || new Date().toISOString().slice(0, 10)}
                onChange={handleChange}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="due">마감일</label>
              <input
                type="date"
                id="due"
                name="due"
                value={formData.due}
                onChange={handleChange}
                className="form-input"
              />
            </div>
          </div>

          {mode === 'edit' && currentUser && (
            <CommentsSection
              entityType={isGmpRecord ? 'gmp_record' : 'task'}
              entityId={task.id}
              currentUser={currentUser}
            />
          )}
        </form>
      </div>
    </>
  )
}

