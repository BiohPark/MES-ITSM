'use client'

import { useState, useEffect } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { Project, ProjectChild } from '@/types/project'
import { CommentsSection } from '../common/CommentsSection'
import { useI18n } from '@/lib/i18n'

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
  const { t } = useI18n()
  const [formData, setFormData] = useState<any>({ ...project, description: (project as any).description || '', start: (project as any).start || new Date().toISOString().slice(0, 10), srb_ver: (project as any).srb_ver || '' })
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])
  const [activeTab, setActiveTab] = useState<'info' | 'comments'>('info')

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
    if (projectWithFields.has_cc === undefined) projectWithFields.has_cc = false
    if (projectWithFields.cc_number === undefined) projectWithFields.cc_number = null
    setFormData(projectWithFields)

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [project])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    if (formData.owner && !users.some(u => u.name === formData.owner)) {
      alert(t('comp.projectEditModal.unknownUser'))
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
          <h2>{mode === 'edit' ? t('comp.projectEditModal.titleEdit') : t('comp.projectEditModal.titleCreate')}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {mode === 'edit' && (
              <div style={{ display: 'flex', gap: '0.25rem', marginRight: '0.5rem' }}>
                <button
                  onClick={() => setActiveTab('info')}
                  className={activeTab === 'info' ? 'btn btn-primary' : 'btn btn-secondary'}
                  style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
                >
                  {t('comp.projectEditModal.tabInfo')}
                </button>
                <button
                  onClick={() => setActiveTab('comments')}
                  className={activeTab === 'comments' ? 'btn btn-primary' : 'btn btn-secondary'}
                  style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
                >
                  {t('comp.projectEditModal.tabComments')}
                </button>
              </div>
            )}
            {activeTab === 'info' && (
              <button
                type="submit"
                form="project-form"
                disabled={saving}
                className="btn btn-primary"
                style={{ margin: 0 }}
              >
                {saving ? t('comp.ui.saving') : t('comp.ui.save')}
              </button>
            )}
            <button className="modal-close" onClick={onClose}>
              ×
            </button>
          </div>
        </div>

        {activeTab === 'info' && (
        <form id="project-form" onSubmit={handleSubmit} className="project-form">
          <div className="form-group">
            <label htmlFor="id">{t('comp.projectEditModal.projectId')}</label>
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
            <label htmlFor="owner">{t('comp.projectEditModal.owner')}</label>
            <select
              id="owner"
              name="owner"
              value={formData.owner || ''}
              onChange={handleChange}
              required
              className="form-input"
            >
              <option value="">{t('comp.projectEditModal.select')}</option>
              {users.map((user) => (
                <option key={user.id} value={user.name}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="members">{t('comp.projectEditModal.members')}</label>
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
              <label htmlFor="status">{t('comp.projectEditModal.status')}</label>
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
              <label htmlFor="srb_ver">{t('comp.projectEditModal.srbVer')}</label>
              <input
                type="text"
                id="srb_ver"
                name="srb_ver"
                value={formData.srb_ver || ''}
                onChange={handleChange}
                className="form-input"
                placeholder={t('comp.projectEditModal.srbPh')}
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.has_cc || false}
                  onChange={(e) => {
                    setFormData((prev: any) => ({
                      ...prev,
                      has_cc: e.target.checked,
                      cc_number: e.target.checked ? prev.cc_number : null,
                    }))
                  }}
                  style={{ cursor: 'pointer' }}
                />
                {t('comp.projectEditModal.ccExists')}
              </label>
            </div>

            {formData.has_cc && (
              <div className="form-group">
                <label htmlFor="cc_number">{t('comp.projectEditModal.ccNumber')}</label>
                <input
                  type="text"
                  id="cc_number"
                  name="cc_number"
                  value={formData.cc_number || ''}
                  onChange={handleChange}
                  className="form-input"
                  placeholder={t('comp.projectEditModal.ccNumberPh')}
                />
                <small style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', display: 'block' }}>
                  {t('comp.projectEditModal.ccHint')}
                </small>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="start">{t('comp.projectEditModal.start')}</label>
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
              <label htmlFor="due">{t('comp.projectEditModal.due')}</label>
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
            <label htmlFor="description">{t('comp.projectEditModal.detail')}</label>
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
              placeholder={t('comp.projectEditModal.detailPh')}
            />
          </div>

          {formData.children?.length ? (
            <div className="child-preview">
              <p>{t('comp.projectEditModal.childrenHeading')}</p>
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

        </form>
        )}

        {activeTab === 'comments' && mode === 'edit' && currentUser && (
          <div style={{ padding: '1rem', maxHeight: 'calc(100vh - 120px)', overflow: 'auto' }}>
            <CommentsSection
              entityType="project"
              entityId={project.id}
              currentUser={currentUser}
            />
          </div>
        )}
      </div>
    </>
  )
}

