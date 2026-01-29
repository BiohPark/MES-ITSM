'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { Project, ProjectChild } from '@/types/project'
import { CommentsSection } from '../common/CommentsSection'
import { DevelopmentPhaseStatusActions } from './DevelopmentPhaseStatusActions'
import { AttachmentSection } from '../attachments/AttachmentSection'

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
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [valPackages, setValPackages] = useState<Array<{ id: string; name: string }>>([])
  const [linkedValPackageIds, setLinkedValPackageIds] = useState<string[]>([])
  
  // PIM일감 여부 확인 (PI 진척율이 100%가 아니면 PIM일감)
  const isPimTask = useMemo(() => {
    if (isGmpRecord) return false
    const piProgress = Number(formData.phases?.pi?.progress) || 0
    return piProgress < 100
  }, [formData.phases, isGmpRecord])

  // 계획 진척도 계산 함수
  const calculatePlannedProgress = (start: string | null | undefined, due: string | null | undefined): number => {
    if (!start || !due) return 0
    
    const startDate = new Date(start)
    const dueDate = new Date(due)
    const today = new Date()
    
    startDate.setHours(0, 0, 0, 0)
    dueDate.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    
    const totalDays = Math.ceil((dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const elapsedDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (totalDays <= 0) {
      if (elapsedDays >= 0) return 100
      return 0
    }
    if (elapsedDays < 0) return 0
    if (elapsedDays > totalDays) return 100
    
    return Math.round((elapsedDays / totalDays) * 100)
  }

  // 단계별 상태에서 전체 상태 자동 계산
  const calculateStatusFromPhases = (phases: any): string => {
    const piStatus = phases?.pi?.status || '요구사항 접수'
    const devStatus = phases?.development?.status || '설계 리뷰'
    
    // PI 단계가 Dropped면 Dropped로 전환
    if (piStatus === 'Dropped') {
      return 'Dropped'
    }
    
    // PI 단계가 "진행여부 확정"이면 In Progress로 전환
    if (piStatus === '진행여부 확정') {
      return 'In Progress'
    }
    
    // 모두 Completed면 Completed (단계별 완료 상태 확인 필요)
    // 개발 단계가 "Val서버 이관"이면 Completed로 간주
    if (devStatus === 'Val서버 이관') {
      return 'Completed'
    }
    
    // 하나라도 In Progress면 In Progress
    // PI/개발 단계 중 하나라도 진행 중이면 In Progress
    if (piStatus !== '요구사항 접수' || devStatus !== '설계 리뷰') {
      return 'In Progress'
    }
    
    // 기본값은 Planning
    return 'Planning'
  }

  // 단계별 데이터에서 자동 계산된 값들 업데이트
  const updateCalculatedFields = useCallback((prev: any) => {
    const phases = prev.phases || {}
    const pi = phases.pi || {}
    const dev = phases.development || {}
    
    // 담당자: PI 단계 담당자
    const owner = pi.owner || ''
    
    // Dropped 상태인 경우 진행률을 100%로 유지
    const isDropped = prev.status === 'Dropped' || pi.status === 'Dropped'
    
    // 진행률: Dropped 상태면 100%, 아니면 평균
    let progress: number
    if (isDropped) {
      progress = 100
    } else {
      const piProgress = Number(pi.progress) || 0
      const devProgress = Number(dev.progress) || 0
      progress = Math.round((piProgress + devProgress) / 2)
    }
    
    // 시작일: 가장 빠른 날짜
    const startDates = [pi.start, dev.start].filter(Boolean)
    const start = startDates.length > 0 ? startDates.sort()[0] : (prev.start || new Date().toISOString().slice(0, 10))
    
    // 마감일: 가장 느린 날짜
    const dueDates = [pi.due, dev.due].filter(Boolean)
    const due = dueDates.length > 0 ? dueDates.sort().reverse()[0] : (prev.due || '')
    
    // 상태: Dropped 상태면 유지, 아니면 단계별 상태에서 계산
    let status: string
    if (isDropped) {
      status = 'Dropped'
    } else {
      status = calculateStatusFromPhases(phases)
    }
    
    return {
      ...prev,
      owner,
      progress,
      start,
      due,
      status,
    }
  }, [])

  useEffect(() => {
    fetchUsers()
    fetchUserSession()
    fetchValPackages()
    fetchLinkedValPackages()
    const taskWithFields = { ...task } as any
    if (!taskWithFields.description) taskWithFields.description = ''
    if (!taskWithFields.progress) taskWithFields.progress = 0
    if (!taskWithFields.start) taskWithFields.start = new Date().toISOString().slice(0, 10)
    if (taskWithFields.issue_reason === undefined) taskWithFields.issue_reason = null
    
    // 2단계 초기화 (PI, Development)
    if (!taskWithFields.phases) {
      taskWithFields.phases = {
        pi: {
          owner: '',
          status: '요구사항 접수',
          progress: 0,
          start: new Date().toISOString().slice(0, 10),
          due: '',
        },
        development: {
          owner: '',
          status: '설계 리뷰',
          progress: 0,
          start: new Date().toISOString().slice(0, 10),
          due: '',
        },
      }
    } else {
      // 기존 데이터가 있으면 각 단계별로 기본값 설정
      const today = new Date().toISOString().slice(0, 10)
      if (!taskWithFields.phases.pi) {
        taskWithFields.phases.pi = { owner: '', status: '요구사항 접수', progress: 0, start: today, due: '' }
      }
      if (!taskWithFields.phases.development) {
        taskWithFields.phases.development = { owner: '', status: '설계 리뷰', progress: 0, start: today, due: '' }
      }
      // PM 단계 제거
      if (taskWithFields.phases.pm) {
        delete taskWithFields.phases.pm
      }
    }
    
    if (isGmpRecord) {
      if (!taskWithFields.kind) taskWithFields.kind = 'CC'
      if (taskWithFields.number === undefined || taskWithFields.number === null) taskWithFields.number = 0
    }
    
    // 초기화 후 자동 계산된 필드 업데이트 (GMP Record가 아닐 때만)
    if (!isGmpRecord) {
      const updatedData = updateCalculatedFields(taskWithFields)
      setFormData(updatedData)
    } else {
      setFormData(taskWithFields)
    }
    setSelectedProjectId(projectId || null)
  }, [task, projectId, isGmpRecord, updateCalculatedFields])

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

  const fetchValPackages = async () => {
    try {
      const response = await fetch('/api/val-packages')
      if (response.ok) {
        const data = await response.json()
        setValPackages(data.map((vp: any) => ({ id: vp.id, name: vp.name })))
      }
    } catch (error) {
      console.error('Error fetching VAL packages:', error)
    }
  }

  const fetchLinkedValPackages = async () => {
    if (mode !== 'edit' || !task.id) return
    try {
      const response = await fetch(`/api/val-packages?taskId=${task.id}`)
      if (response.ok) {
        const data = await response.json()
        setLinkedValPackageIds(data.map((vp: any) => vp.id))
      }
    } catch (error) {
      console.error('Error fetching linked VAL packages:', error)
    }
  }

  const fetchUserSession = async () => {
    try {
      const response = await fetch('/api/auth', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        if (data.authenticated && data.user) {
          setUserRole(data.user.role || null)
          setUserId(data.user.id || data.user.userId || null)
        }
      }
    } catch (error) {
      console.error('Error fetching user session:', error)
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
    
    // CPA 종류 GMP Record이고 Link된 일감이 있으면 Completed 상태 제한 확인
    if (isGmpRecord && (formData as any).kind === 'CPA' && (formData as any).linked_task_id && formData.status === 'Completed') {
      try {
        const response = await fetch(`/api/projects?taskId=${(formData as any).linked_task_id}`)
        if (response.ok) {
          const taskData = await response.json()
          if (taskData && taskData.status !== 'Completed') {
            alert('Link된 일감이 Completed 상태가 아니면 GMP Record를 Completed로 변경할 수 없습니다.')
            return
          }
        }
      } catch (error) {
        console.error('Link된 일감 상태 확인 실패:', error)
        // 확인 실패해도 계속 진행 (서버에서도 검증함)
      }
    }
    
    // 진척률이 빈 값이면 0으로 변환
    const submitData = {
      ...formData,
      progress: (formData as any).progress === '' ? 0 : ((formData as any).progress || 0),
      issue_reason: (formData as any).issue_reason || null
    }
    
    // PI 100% 완료 체크 (일감인 경우만)
    if (!isGmpRecord && mode === 'edit') {
      const piProgress = Number(submitData.phases?.pi?.progress) || 0
      const wasPimTask = isPimTask
      const isNowComplete = piProgress >= 100
      
      if (wasPimTask && isNowComplete) {
        // PIM일감에서 개발일감으로 이동됨
        // 저장 후 알림은 onSave에서 처리하도록 함
      }
    }
    
    setSaving(true)
    try {
      await onSave(submitData, selectedProjectId)
      
      // PI 100% 완료 시 알림
      if (!isGmpRecord && mode === 'edit') {
        const piProgress = Number(submitData.phases?.pi?.progress) || 0
        if (piProgress >= 100 && isPimTask) {
          // 저장 성공 후 알림 (다음 렌더링에서 개발일감 목록으로 이동됨)
          setTimeout(() => {
            alert('PI 단계가 100% 완료되어 개발일감 목록으로 이동되었습니다.')
          }, 100)
        }
      }

      // VAL Pkg 연결 정보 저장 (일감 저장 후)
      if (linkedValPackageIds.length > 0 && !isGmpRecord) {
        try {
          // 저장된 일감의 ID 사용 (새로 생성된 경우 submitData.id, 편집인 경우 task.id)
          const taskId = submitData.id || task.id
          if (taskId) {
            // 각 VAL Pkg에 일감 연결
            for (const valPackageId of linkedValPackageIds) {
              await fetch(`/api/val-packages/${valPackageId}/link-tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskIds: [taskId] }),
              })
            }
          }
        } catch (error) {
          console.error('Error linking VAL packages:', error)
          // VAL Pkg 연결 실패해도 일감 저장은 성공한 것으로 처리
        }
      }
    } catch (error: any) {
      if (error.message && error.message.includes('Link된 일감')) {
        alert(error.message)
      } else {
        throw error
      }
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
          ? value === '' ? '' : (isNaN(parseInt(value, 10)) ? 0 : parseInt(value, 10))
          : name === 'number'
          ? parseInt(value, 10) || 0
          : value,
    }))
  }

  const handlePhaseChange = (phase: 'pi' | 'development', field: string, value: string | number) => {
    setFormData((prev: any) => {
      const updated = {
        ...prev,
        phases: {
          ...prev.phases,
          [phase]: {
            ...prev.phases[phase],
            [field]: field === 'progress' 
              ? (value === '' ? '' : (isNaN(Number(value)) ? 0 : Number(value)))
              : value,
          },
        },
      }
      
      // PI 단계 상태가 "진행여부 확정"으로 변경되면 전체 상태를 In Progress로 설정
      if (phase === 'pi' && field === 'status' && value === '진행여부 확정') {
        updated.status = 'In Progress'
      }
      
      // PI 단계 상태가 Dropped로 변경되면 전체 상태를 Dropped로 설정하고 진행률을 100%로 설정
      if (phase === 'pi' && field === 'status' && value === 'Dropped') {
        updated.status = 'Dropped'
        updated.progress = 100
        // PI, 개발 단계의 진행률도 모두 100%로 설정
        if (updated.phases) {
          if (updated.phases.pi) {
            updated.phases.pi.progress = 100
          }
          if (updated.phases.development) {
            updated.phases.development.progress = 100
          }
        }
      }
      
      // 진행률이나 날짜가 변경되면 계획 진척도와 실적 진척도를 비교하여 상태 자동 설정
      // (Issued 상태는 제거되었으므로 이 로직은 제거)
      
      // 단계 변경 후 자동 계산된 필드 업데이트
      return updateCalculatedFields(updated)
    })
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
          <h2>
            {mode === 'edit' ? (isGmpRecord ? 'GMP Record 수정' : '일감 수정') : (isGmpRecord ? '새 GMP Record 추가' : '새 일감 추가')}
            {isGmpRecord && (formData as any).linked_task_id && (
              <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: '#3b82f6', marginLeft: '0.5rem' }}>
                🔗 Link: {(formData as any).linked_task_id}
              </span>
            )}
            {!isGmpRecord && (formData as any).linked_gmp_record_id && (
              <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: '#3b82f6', marginLeft: '0.5rem' }}>
                🔗 Link: {(formData as any).linked_gmp_record_id}
              </span>
            )}
          </h2>
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
              <label htmlFor="owner">{isGmpRecord ? '대표 담당자' : '대표 담당자(PI)'}</label>
              <select
                id="owner"
                name="owner"
                value={formData.owner || ''}
                onChange={handleChange}
                required
                className="form-input"
                disabled={!isGmpRecord}
                style={{ 
                  backgroundColor: !isGmpRecord ? '#f3f4f6' : 'white',
                  cursor: !isGmpRecord ? 'not-allowed' : 'pointer'
                }}
              >
                <option value="">선택하세요</option>
                {users.map((user) => (
                  <option key={user.id} value={user.name}>
                    {user.name}
                  </option>
                ))}
              </select>
              <small style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', display: 'block' }}>
                {isGmpRecord ? '담당자를 선택하세요' : 'PI 단계 담당자로 자동 설정됩니다'}
              </small>
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
                disabled={!isGmpRecord}
                style={{ 
                  backgroundColor: !isGmpRecord ? '#f3f4f6' : 'white',
                  cursor: !isGmpRecord ? 'not-allowed' : 'pointer'
                }}
              >
                <option value="Planning">Planning</option>
                <option value="In Progress">In Progress</option>
                <option value="Issue">Issue</option>
                <option value="Completed">Completed</option>
                <option value="Dropped">Dropped</option>
              </select>
              <small style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', display: 'block' }}>
                {isGmpRecord && (formData as any).kind === 'CPA' && (formData as any).linked_task_id
                  ? 'Link된 일감이 Completed되기 전까지 Completed로 변경할 수 없습니다'
                  : isGmpRecord
                  ? '상태를 선택하세요'
                  : '단계별 상태에서 자동 계산됩니다'}
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="progress">진행률 (%)</label>
              <input
                type="number"
                id="progress"
                name="progress"
                value={(formData as any).progress === '' ? '' : ((formData as any).progress || 0)}
                onChange={handleChange}
                min="0"
                max="100"
                className="form-input"
                disabled={!isGmpRecord}
                style={{ 
                  backgroundColor: !isGmpRecord ? '#f3f4f6' : 'white',
                  cursor: !isGmpRecord ? 'not-allowed' : 'pointer'
                }}
              />
              <small style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', display: 'block' }}>
                {isGmpRecord ? '진행률을 입력하세요 (0-100)' : 'PI, 개발 단계 진행률의 평균으로 자동 계산됩니다'}
              </small>
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
                disabled={!isGmpRecord}
                style={{ 
                  backgroundColor: !isGmpRecord ? '#f3f4f6' : 'white',
                  cursor: !isGmpRecord ? 'not-allowed' : 'pointer'
                }}
              />
              <small style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', display: 'block' }}>
                {isGmpRecord ? '시작일을 선택하세요' : '단계별 시작일 중 가장 빠른 날짜로 자동 설정됩니다'}
              </small>
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
                disabled={!isGmpRecord}
                style={{ 
                  backgroundColor: !isGmpRecord ? '#f3f4f6' : 'white',
                  cursor: !isGmpRecord ? 'not-allowed' : 'pointer'
                }}
              />
              <small style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', display: 'block' }}>
                {isGmpRecord ? '마감일을 선택하세요' : '단계별 마감일 중 가장 느린 날짜로 자동 설정됩니다'}
              </small>
            </div>
          </div>

          {/* VAL Pkg 연결 */}
          {!isGmpRecord && (
            <div className="form-group">
              <label htmlFor="val-package-select">VAL Pkg 연결</label>
              <select
                id="val-package-select"
                multiple
                value={linkedValPackageIds}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value)
                  setLinkedValPackageIds(selected)
                }}
                className="form-input"
                style={{ minHeight: '100px' }}
              >
                {valPackages.map((vp) => (
                  <option key={vp.id} value={vp.id}>
                    {vp.name} ({vp.id})
                  </option>
                ))}
              </select>
              <small style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', display: 'block' }}>
                Ctrl(또는 Cmd) 키를 누른 채로 여러 개 선택할 수 있습니다
              </small>
            </div>
          )}

          {/* Issue 상태 설명 */}
          {!isGmpRecord && formData.status === 'Issue' && (formData as any).issue_reason && (
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>Issue 해결 가이드</label>
              <div style={{
                padding: '1rem',
                backgroundColor: '#fef3c7',
                border: '1px solid #fcd34d',
                borderRadius: '0.5rem',
                color: '#92400e',
                whiteSpace: 'pre-line',
                fontSize: '0.875rem',
                lineHeight: '1.6'
              }}>
                {(formData as any).issue_reason}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Issue가 해결되었나요? 설명을 삭제하시겠습니까?')) {
                    setFormData((prev: any) => ({
                      ...prev,
                      issue_reason: null,
                    }))
                  }
                }}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem 1rem',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Issue 해결됨 (설명 삭제)
              </button>
            </div>
          )}

          {/* 2단계 입력 섹션 - GMP Record가 아닐 때만 표시 */}
          {!isGmpRecord && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem', color: '#111827' }}>업무 단계별 관리</h3>
            
            {/* PI 단계 */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem', display: 'block' }}>PI 단계</label>
              <div className="form-row" style={{ marginBottom: '0.5rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>담당자</label>
                  <select
                    value={(formData.phases?.pi?.owner || '')}
                    onChange={(e) => handlePhaseChange('pi', 'owner', e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '0.5rem' }}
                  >
                    <option value="">선택</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.name}>{user.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>상태</label>
                  <select
                    value={(formData.phases?.pi?.status || '요구사항 접수')}
                    onChange={(e) => handlePhaseChange('pi', 'status', e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '0.5rem' }}
                  >
                    <option value="요구사항 접수">요구사항 접수</option>
                    <option value="진행여부 확정">진행여부 확정</option>
                    <option value="URS 분석">URS 분석</option>
                    <option value="설계 확정">설계 확정</option>
                    <option value="Dropped">Dropped</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>진행률 (계획/실적)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="number"
                      value={(formData.phases?.pi?.progress === '' ? '' : (formData.phases?.pi?.progress || 0))}
                      onChange={(e) => handlePhaseChange('pi', 'progress', e.target.value)}
                      min="0"
                      max="100"
                      className="form-input"
                      style={{ fontSize: '0.8rem', padding: '0.5rem', flex: 1 }}
                    />
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {(() => {
                        const planned = calculatePlannedProgress(formData.phases?.pi?.start, formData.phases?.pi?.due)
                        const actual = Number(formData.phases?.pi?.progress) || 0
                        return `${planned}% / ${actual}%`
                      })()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>시작일</label>
                  <input
                    type="date"
                    value={(formData.phases?.pi?.start || new Date().toISOString().slice(0, 10))}
                    onChange={(e) => handlePhaseChange('pi', 'start', e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '0.5rem' }}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>마감일</label>
                  <input
                    type="date"
                    value={(formData.phases?.pi?.due || '')}
                    onChange={(e) => handlePhaseChange('pi', 'due', e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '0.5rem' }}
                  />
                </div>
              </div>
            </div>

            {/* 개발 단계 */}
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem', display: 'block' }}>개발 단계</label>
              <div className="form-row" style={{ marginBottom: '0.5rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>담당자</label>
                  <select
                    value={(formData.phases?.development?.owner || '')}
                    onChange={(e) => handlePhaseChange('development', 'owner', e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '0.5rem' }}
                    disabled={isPimTask}
                  >
                    <option value="">선택</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.name}>{user.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>상태</label>
                  <input
                    type="text"
                    value={(formData.phases?.development?.status || '설계 리뷰')}
                    className="form-input"
                    style={{ 
                      fontSize: '0.8rem', 
                      padding: '0.5rem',
                      backgroundColor: '#f3f4f6',
                      cursor: 'not-allowed',
                      color: '#6b7280'
                    }}
                    disabled={true}
                    readOnly
                  />
                  <small style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.25rem', display: 'block' }}>
                    워크플로우 전환을 통해서만 변경 가능
                  </small>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>진행률 (계획/실적)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="number"
                      value={(formData.phases?.development?.progress === '' ? '' : (formData.phases?.development?.progress || 0))}
                      onChange={(e) => handlePhaseChange('development', 'progress', e.target.value)}
                      min="0"
                      max="100"
                      className="form-input"
                      style={{ fontSize: '0.8rem', padding: '0.5rem', flex: 1 }}
                      disabled={isPimTask}
                    />
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {(() => {
                        const planned = calculatePlannedProgress(formData.phases?.development?.start, formData.phases?.development?.due)
                        const actual = Number(formData.phases?.development?.progress) || 0
                        return `${planned}% / ${actual}%`
                      })()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>시작일</label>
                  <input
                    type="date"
                    value={(formData.phases?.development?.start || new Date().toISOString().slice(0, 10))}
                    onChange={(e) => handlePhaseChange('development', 'start', e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '0.5rem' }}
                    disabled={isPimTask}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>마감일</label>
                  <input
                    type="date"
                    value={(formData.phases?.development?.due || '')}
                    onChange={(e) => handlePhaseChange('development', 'due', e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '0.5rem' }}
                    disabled={isPimTask}
                  />
                </div>
              </div>
              {/* 개발 단계 워크플로우 전환 버튼 */}
              {!isGmpRecord && !isPimTask && (
                <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f0f9ff', borderRadius: '0.375rem', border: '1px solid #bae6fd' }}>
                  <label style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 500, marginBottom: '0.375rem', display: 'block' }}>
                    워크플로우 전환 (상태 변경)
                  </label>
                  {mode === 'edit' ? (
                    <DevelopmentPhaseStatusActions
                      taskId={task.id}
                      currentStatus={formData.phases?.development?.status}
                      onStatusChange={(newStatus) => {
                        handlePhaseChange('development', 'status', newStatus)
                      }}
                      userRole={userRole || undefined}
                      userId={userId || undefined}
                      style={{ fontSize: '0.75rem' }}
                    />
                  ) : (
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                      일감 저장 후 워크플로우 전환을 사용할 수 있습니다.
                    </p>
                  )}
                </div>
              )}
              {isPimTask && (
                <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#fef3c7', borderRadius: '0.375rem', border: '1px solid #fcd34d' }}>
                  <p style={{ fontSize: '0.75rem', color: '#92400e', margin: 0 }}>
                    ℹ️ PIM일감입니다. PI 단계가 100% 완료되면 개발일감으로 이동되어 개발 단계를 입력할 수 있습니다.
                  </p>
                </div>
              )}
            </div>
          </div>
          )}

          {mode === 'edit' && currentUser && (
            <>
              <AttachmentSection
                recordId={task.id}
                recordType={isGmpRecord ? 'gmp_record' : 'task'}
                currentUser={
                  userId && userRole
                    ? {
                        id: userId,
                        name: currentUser.name,
                        role: userRole,
                      }
                    : undefined
                }
                onUploadComplete={() => {
                  // 업로드 완료 후 필요한 경우 추가 작업 수행
                }}
              />
              <CommentsSection
                entityType={isGmpRecord ? 'gmp_record' : 'task'}
                entityId={task.id}
                currentUser={currentUser}
              />
            </>
          )}
        </form>
      </div>
    </>
  )
}

