'use client'

import { useState, useEffect } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { Project, ProjectChild } from '@/types/project'
import { buildNewChild } from '@/utils/project-utils'

export function ChildItemModal({
  project,
  onClose,
  onSave,
}: {
  project: Project
  onClose: () => void
  onSave: (child: ProjectChild) => Promise<void> | void
}) {
  const [formData, setFormData] = useState<ProjectChild>({
    id: 'TASK-00000',
    title: '',
    owner: '',
    status: 'Planning',
    due: new Date().toISOString().slice(0, 10),
  })
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
    const initFormData = async () => {
      const newChild = await buildNewChild()
      if (!abortController.signal.aborted && isMounted) {
        setFormData({
          ...newChild,
          title: '',
          owner: '',
          status: 'Planning',
        })
      }
    }
    initFormData()

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
    
    setSaving(true)
    try {
      await onSave(formData)
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{project.name} - 하위 아이템 추가</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="submit"
              form="child-form"
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

        <form id="child-form" onSubmit={handleSubmit} className="project-form">
          <div className="form-group">
            <label htmlFor="childTitle">아이템 이름</label>
            <input
              id="childTitle"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="childOwner">담당자</label>
            <select
              id="childOwner"
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
              <label htmlFor="childStatus">상태</label>
              <select
                id="childStatus"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="form-input"
              >
                <option value="Planning">Planning</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Dropped">Dropped</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="childStart">시작일</label>
              <input
                id="childStart"
                name="start"
                type="date"
                value={formData.start || new Date().toISOString().slice(0, 10)}
                onChange={handleChange}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="childDue">마감일</label>
              <input
                id="childDue"
                name="due"
                type="date"
                value={formData.due}
                onChange={handleChange}
                className="form-input"
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

