'use client'

import { useState, useEffect } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { Issue } from '@/types/issue'

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

interface IssueEditModalProps {
  issue: Issue
  mode: 'create' | 'edit'
  onClose: () => void
  onSave: (issue: Issue) => Promise<void> | void
  allIssues?: Issue[] // 관련 이슈 선택용
}

export function IssueEditModal({
  issue,
  mode,
  onClose,
  onSave,
  allIssues = [],
}: IssueEditModalProps) {
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
  })
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    fetchUsers()
    const issueWithFields = { ...issue } as any
    if (!issueWithFields.description) issueWithFields.description = ''
    if (!issueWithFields.status) issueWithFields.status = 'Open'
    if (!issueWithFields.occurred_date) issueWithFields.occurred_date = new Date().toISOString().slice(0, 10)
    if (!issueWithFields.is_deviation) issueWithFields.is_deviation = false
    setFormData(issueWithFields as Issue)
  }, [issue])

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
    
    setSaving(true)
    try {
      await onSave(formData)
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
          <h2>{mode === 'edit' ? '이슈 수정' : '새 이슈 추가'}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="submit"
              form="issue-form"
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
              <span>Deviation 판정</span>
            </label>
          </div>

          <div className="form-group">
            <label htmlFor="id">이슈 ID</label>
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
            <label htmlFor="title">이슈 제목</label>
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
              <label htmlFor="status">상태</label>
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
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="occurred_date">발생일</label>
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
              <label htmlFor="due_date">마감일 (완료 예정일)</label>
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
              <label htmlFor="sw_version">S/W 버전</label>
              <input
                type="text"
                id="sw_version"
                name="sw_version"
                value={formData.sw_version || ''}
                onChange={handleChange}
                className="form-input"
                placeholder="예: SRB 26.1"
              />
            </div>

            <div className="form-group">
              <label htmlFor="cause_category">원인 분류</label>
              <select
                id="cause_category"
                name="cause_category"
                value={formData.cause_category || ''}
                onChange={handleChange}
                className="form-input"
              >
                <option value="">선택하세요</option>
                {CAUSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="module">발생 모듈</label>
              <select
                id="module"
                name="module"
                value={formData.module || ''}
                onChange={handleChange}
                className="form-input"
              >
                <option value="">선택하세요</option>
                {MODULES.map((module) => (
                  <option key={module} value={module}>
                    {module}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="related_issue_id">관련 이슈 ID (재발 추적용)</label>
            <select
              id="related_issue_id"
              name="related_issue_id"
              value={formData.related_issue_id || ''}
              onChange={handleChange}
              className="form-input"
            >
              <option value="">선택하세요 (없음)</option>
              {availableRelatedIssues.map((relatedIssue) => (
                <option key={relatedIssue.id} value={relatedIssue.id}>
                  {relatedIssue.id} - {relatedIssue.title}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="cause">원인</label>
            <textarea
              id="cause"
              name="cause"
              value={formData.cause || ''}
              onChange={handleChange}
              className="form-input"
              rows={4}
              placeholder="이슈 발생 원인을 상세히 입력하세요..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">설명</label>
            <textarea
              id="description"
              name="description"
              value={formData.description || ''}
              onChange={handleChange}
              className="form-input"
              rows={6}
              placeholder="이슈에 대한 상세 설명을 입력하세요..."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="resolved_date">해결일</label>
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
              <label htmlFor="resolved_sw_version">해결 S/W 버전</label>
              <input
                type="text"
                id="resolved_sw_version"
                name="resolved_sw_version"
                value={formData.resolved_sw_version || ''}
                onChange={handleChange}
                className="form-input"
                placeholder="예: 1.1.0"
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

