'use client'

import { useState, useEffect } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { Project, ProjectChild } from '@/types/project'
import { CommentsSection } from '../common/CommentsSection'

export function ProjectEditModal({
  project,
  mode,
  onClose,
  onSave,
  currentUser,
}: {
  project: Project
  mode: 'create' | 'edit'
  onClose: () => void
  onSave: (project: Project) => Promise<void> | void
  currentUser?: { name: string; username: string }
}) {
  const [formData, setFormData] = useState<any>({ ...project, description: (project as any).description || '', start: (project as any).start || new Date().toISOString().slice(0, 10), srb_ver: (project as any).srb_ver || '' })
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])

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
          setUsers(data.users || [])
        }
      } catch (error) {
        if (abortController.signal.aborted) return
        console.error('Error fetching users:', error)
      }
    }

    fetchUsers()
    const projectWithFields = { ...project } as any
    if (!projectWithFields.description) projectWithFields.description = ''
    if (!projectWithFields.start) projectWithFields.start = new Date().toISOString().slice(0, 10)
    if (!projectWithFields.srb_ver) projectWithFields.srb_ver = ''
    setFormData(projectWithFields)

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [project])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    if (formData.owner && !users.some(u => u.name === formData.owner)) {
      alert('등록되지 않은 사용자입니다.')
      return
    }
    
    // 진척률이 빈 값이면 0으로 변환
    const submitData = {
      ...formData,
      progress: formData.progress === '' ? 0 : (formData.progress || 0)
    }
    
    setSaving(true)
    try {
      await onSave(submitData)
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev: any) => ({
      ...prev,
      [name]:
        name === 'members'
          ? parseInt(value, 10) || 0
          : name === 'progress'
          ? value === '' ? '' : (isNaN(parseInt(value, 10)) ? 0 : parseInt(value, 10))
          : value,
    }))
  }

  return (
    <>
      <div className="modal-overlay side-panel" onClick={onClose} />
      <div className="modal-content side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{mode === 'edit' ? '프로젝트 수정' : '새 프로젝트 추가'}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="submit"
              form="project-form"
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

        <form id="project-form" onSubmit={handleSubmit} className="project-form">
          <div className="form-group">
            <label htmlFor="id">프로젝트 ID</label>
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
            <label htmlFor="name">프로젝트 이름</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="owner">담당 리더</label>
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

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="members">팀원 수</label>
              <input
                type="number"
                id="members"
                name="members"
                value={formData.members}
                onChange={handleChange}
                min="1"
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="progress">진행률 (%)</label>
              <input
                type="number"
                id="progress"
                name="progress"
                value={formData.progress === '' ? '' : formData.progress}
                onChange={handleChange}
                min="0"
                max="100"
                className="form-input"
              />
            </div>
          </div>

          <div className="form-row">
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
              <label htmlFor="srb_ver">SRB Ver.</label>
              <input
                type="text"
                id="srb_ver"
                name="srb_ver"
                value={formData.srb_ver || ''}
                onChange={handleChange}
                className="form-input"
                placeholder="예: SRB 26.1"
              />
            </div>

            <div className="form-group">
              <label htmlFor="start">시작일</label>
              <input
                type="date"
                id="start"
                name="start"
                value={formData.start || ''}
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
                required
                className="form-input"
              />
            </div>
          </div>

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
              placeholder="프로젝트의 상세 내용을 입력하세요..."
            />
          </div>

          {formData.children?.length ? (
            <div className="child-preview">
              <p>하위 아이템</p>
              <ul>
                {formData.children.map((child: ProjectChild, index: number) => (
                  <li key={`${formData.id}-${child.id}-${index}`}>
                    <span>{child.title}</span>
                    <span>{child.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {mode === 'edit' && currentUser && (
            <CommentsSection
              entityType="project"
              entityId={project.id}
              currentUser={currentUser}
            />
          )}

        </form>
      </div>
    </>
  )
}

