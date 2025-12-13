'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { Project, ProjectChild } from '@/types/project'
import { CommentsSection } from '../common/CommentsSection'

export function ValPackageEditModal({
  valPackage,
  mode,
  onClose,
  onSave,
  currentUser,
}: {
  valPackage: Project
  mode: 'create' | 'edit'
  onClose: () => void
  onSave: (valPackage: Project) => Promise<void> | void
  currentUser?: { name: string; username: string }
}) {
  const [formData, setFormData] = useState<any>({ ...valPackage, description: (valPackage as any).description || '', start: (valPackage as any).start || new Date().toISOString().slice(0, 10), srb_ver: (valPackage as any).srb_ver || '' })
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])
  const [availableTasks, setAvailableTasks] = useState<ProjectChild[]>([])
  const [linkedTasks, setLinkedTasks] = useState<ProjectChild[]>([])
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [loadingTasks, setLoadingTasks] = useState(false)

  const fetchLinkedTasks = useCallback(async () => {
    if (mode !== 'edit' || !valPackage.id) return
    try {
      const response = await fetch(`/api/val-packages/${valPackage.id}/tasks`)
      if (response.ok) {
        const data = await response.json()
        setLinkedTasks(data || [])
        // 이미 링크된 일감들을 선택 상태로 설정
        const linkedIds = new Set<string>(data.map((t: ProjectChild) => t.id))
        setSelectedTaskIds(linkedIds)
      }
    } catch (error) {
      console.error('Error fetching linked tasks:', error)
    }
  }, [mode, valPackage.id])

  useEffect(() => {
    fetchUsers()
    const valPackageWithFields = { ...valPackage } as any
    if (!valPackageWithFields.description) valPackageWithFields.description = ''
    if (!valPackageWithFields.start) valPackageWithFields.start = new Date().toISOString().slice(0, 10)
    if (!valPackageWithFields.srb_ver) valPackageWithFields.srb_ver = ''
    setFormData(valPackageWithFields)
    
    if (mode === 'edit') {
      fetchAvailableTasks()
      fetchLinkedTasks()
    }
  }, [valPackage, mode, fetchLinkedTasks])

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

  const fetchAvailableTasks = async () => {
    try {
      setLoadingTasks(true)
      const response = await fetch('/api/val-packages/available-tasks')
      if (response.ok) {
        const data = await response.json()
        setAvailableTasks(data || [])
      }
    } catch (error) {
      console.error('Error fetching available tasks:', error)
    } finally {
      setLoadingTasks(false)
    }
  }


  const handleTaskToggle = (taskId: string) => {
    const newSet = new Set(selectedTaskIds)
    if (newSet.has(taskId)) {
      newSet.delete(taskId)
    } else {
      newSet.add(taskId)
    }
    setSelectedTaskIds(newSet)
  }

  const handleUnlinkTask = async (taskId: string) => {
    if (!confirm('이 일감과의 링크를 해제하시겠습니까?')) {
      return
    }
    try {
      const response = await fetch(`/api/val-packages/${valPackage.id}/unlink-task?taskId=${taskId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        await fetchLinkedTasks()
        const newSet = new Set(selectedTaskIds)
        newSet.delete(taskId)
        setSelectedTaskIds(newSet)
      } else {
        alert('링크 해제에 실패했습니다.')
      }
    } catch (error) {
      console.error('Error unlinking task:', error)
      alert('링크 해제에 실패했습니다.')
    }
  }

  const handleLinkTasks = async () => {
    if (selectedTaskIds.size === 0) {
      alert('링크할 일감을 선택해주세요.')
      return
    }
    try {
      const response = await fetch(`/api/val-packages/${valPackage.id}/link-tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskIds: Array.from(selectedTaskIds),
        }),
      })
      if (response.ok) {
        await fetchLinkedTasks()
        alert('일감 링크가 완료되었습니다.')
      } else {
        alert('일감 링크에 실패했습니다.')
      }
    } catch (error) {
      console.error('Error linking tasks:', error)
      alert('일감 링크에 실패했습니다.')
    }
  }

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
          <h2>{mode === 'edit' ? 'VAL Pkg 수정' : '새 VAL Pkg 추가'}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="submit"
              form="val-package-form"
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

        <form id="val-package-form" onSubmit={handleSubmit} className="project-form">
          <div className="form-group">
            <label htmlFor="id">VAL Pkg ID</label>
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
            <label htmlFor="name">VAL Pkg 이름</label>
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
              placeholder="VAL Pkg의 상세 내용을 입력하세요..."
            />
          </div>

          {mode === 'edit' && (
            <>
              <div className="form-group">
                <label>개발 일감(링크) 연결</label>
                <div style={{ 
                  border: '1px solid #d1d5db', 
                  borderRadius: '0.5rem', 
                  padding: '1rem',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  backgroundColor: '#f9fafb'
                }}>
                  {loadingTasks ? (
                    <p>일감 목록을 불러오는 중...</p>
                  ) : availableTasks.length === 0 ? (
                    <p style={{ color: '#6b7280' }}>링크 가능한 일감이 없습니다.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {availableTasks.map((task) => (
                        <label
                          key={task.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem',
                            cursor: 'pointer',
                            borderRadius: '0.25rem',
                            backgroundColor: selectedTaskIds.has(task.id) ? '#e0e7ff' : 'transparent',
                          }}
                          onMouseEnter={(e) => {
                            if (!selectedTaskIds.has(task.id)) {
                              e.currentTarget.style.backgroundColor = '#f3f4f6'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!selectedTaskIds.has(task.id)) {
                              e.currentTarget.style.backgroundColor = 'transparent'
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedTaskIds.has(task.id)}
                            onChange={() => handleTaskToggle(task.id)}
                            style={{ cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500 }}>{task.title}</div>
                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                              {task.id} | {task.owner} | {task.status}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleLinkTasks}
                  disabled={selectedTaskIds.size === 0}
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem 1rem',
                    backgroundColor: selectedTaskIds.size === 0 ? '#d1d5db' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: selectedTaskIds.size === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  선택한 일감 링크 ({selectedTaskIds.size}개)
                </button>
              </div>

              <div className="form-group">
                <label>링크된 일감 목록</label>
                {linkedTasks.length === 0 ? (
                  <p style={{ color: '#6b7280', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                    링크된 일감이 없습니다.
                  </p>
                ) : (
                  <div style={{ 
                    border: '1px solid #d1d5db', 
                    borderRadius: '0.5rem', 
                    padding: '1rem',
                    backgroundColor: '#f9fafb'
                  }}>
                    {linkedTasks.map((task) => (
                      <div
                        key={task.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.75rem',
                          marginBottom: '0.5rem',
                          backgroundColor: 'white',
                          borderRadius: '0.25rem',
                          border: '1px solid #e5e7eb',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500 }}>{task.title}</div>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            {task.id} | {task.owner} | {task.status}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUnlinkTask(task.id)}
                          style={{
                            padding: '0.25rem 0.75rem',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                          }}
                        >
                          링크 해제
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {mode === 'edit' && currentUser && (
            <CommentsSection
              entityType="project"
              entityId={valPackage.id}
              currentUser={currentUser}
            />
          )}

        </form>
      </div>
    </>
  )
}

