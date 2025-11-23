'use client'

import { useState, useMemo } from 'react'
import type { MouseEvent } from 'react'
import type { Project, ProjectChild } from '@/types/project'
import { StatusBadge } from '../common/StatusBadge'
import { Progress } from '../common/Progress'

export function ProjectsTable({
  projects,
  loading,
  error,
  onRefresh,
  onProjectClick,
  onNewProject,
  onProjectContextMenu,
  isDeleteMode,
  selectedProjectIds,
  onToggleProjectSelection,
  onDeleteModeChange,
  onBatchDelete,
  selectedChildIds,
  onToggleChildSelection,
  onBatchDeleteChildren,
  onChildClick,
}: {
  projects: Project[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onProjectClick: (project: Project) => void
  onNewProject: () => void
  onProjectContextMenu: (event: MouseEvent, project: Project) => void
  isDeleteMode: boolean
  selectedProjectIds: Set<string>
  onToggleProjectSelection: (projectId: string) => void
  onDeleteModeChange: (enabled: boolean) => void
  onBatchDelete: () => void
  selectedChildIds: Set<string>
  onToggleChildSelection: (childId: string) => void
  onBatchDeleteChildren: () => void
  onChildClick: (child: ProjectChild, projectId: string, projectName: string) => void
}) {
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterOwner, setFilterOwner] = useState<string>('')

  // 고유한 상태 및 담당 리더 목록 추출
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>()
    projects.forEach((project) => {
      if (project.status) statuses.add(project.status)
    })
    return Array.from(statuses).sort()
  }, [projects])

  const uniqueOwners = useMemo(() => {
    const owners = new Set<string>()
    projects.forEach((project) => {
      if (project.owner) owners.add(project.owner)
    })
    return Array.from(owners).sort()
  }, [projects])

  // 필터링된 프로젝트 목록
  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      if (filterStatus && project.status !== filterStatus) return false
      if (filterOwner && project.owner !== filterOwner) return false
      return true
    })
  }, [projects, filterStatus, filterOwner])

  if (loading) {
    return (
      <div className="placeholder">
        <p>데이터를 불러오는 중...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="placeholder">
        <p style={{ color: '#e74c3c' }}>오류: {error}</p>
        <button onClick={onRefresh} className="refresh-button">
          다시 시도
        </button>
      </div>
    )
  }

  if (projects.length === 0) {
  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>프로젝트 목록</h2>
        <div className="table-actions">
            <button onClick={onRefresh} className="refresh-button">
              새로고침
            </button>
            {!isDeleteMode ? (
              <>
                <button onClick={onNewProject} className="primary-button">
                  New
                </button>
                <button
                  onClick={() => onDeleteModeChange(true)}
                  className="primary-button"
                  style={{ backgroundColor: '#e74c3c' }}
                >
                  삭제
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    onDeleteModeChange(false)
                  }}
                  className="refresh-button"
                >
                  취소
                </button>
              </>
            )}
          </div>
        </div>
        <div className="placeholder">
          <p>등록된 프로젝트가 없습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>프로젝트 목록 {filteredProjects.length > 0 && <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: '#64748b' }}>({filteredProjects.length}개)</span>}</h2>
        <div className="table-actions">
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginRight: '0.75rem' }}>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              <option value="">전체 상태</option>
              {uniqueStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
              style={{
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              <option value="">전체 담당 리더</option>
              {uniqueOwners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
            {(filterStatus || filterOwner) && (
              <button
                onClick={() => {
                  setFilterStatus('')
                  setFilterOwner('')
                }}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: '#f1f5f9',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                필터 초기화
              </button>
            )}
          </div>
          <button onClick={onRefresh} className="refresh-button">
            새로고침
          </button>
          {!isDeleteMode ? (
            <>
              <button onClick={onNewProject} className="primary-button">
                New
              </button>
              <button
                onClick={() => onDeleteModeChange(true)}
                className="primary-button"
                style={{ backgroundColor: '#e74c3c' }}
              >
                삭제
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  onDeleteModeChange(false)
                }}
                className="refresh-button"
              >
                취소
              </button>
              {(selectedProjectIds.size > 0 || selectedChildIds.size > 0) && (
                <>
                  {selectedProjectIds.size > 0 && (
                    <button
                      onClick={onBatchDelete}
                      className="primary-button"
                      style={{ backgroundColor: '#e74c3c' }}
                    >
                      프로젝트 삭제 ({selectedProjectIds.size})
                    </button>
                  )}
                  {selectedChildIds.size > 0 && (
                    <button
                      onClick={onBatchDeleteChildren}
                      className="primary-button"
                      style={{ backgroundColor: '#e74c3c' }}
                    >
                      하위 아이템 삭제 ({selectedChildIds.size})
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
      {filteredProjects.length === 0 ? (
        <div className="placeholder">
          <p>필터 조건에 맞는 프로젝트가 없습니다.</p>
        </div>
      ) : (
      <table>
        <thead>
          <tr>
            {isDeleteMode && <th style={{ width: '40px' }}></th>}
            <th>프로젝트</th>
            <th>담당 리더</th>
            <th>인원</th>
            <th>상태</th>
            <th>진척도(계획/실적)</th>
            <th>SRB Ver.</th>
            <th>시작일</th>
            <th>마감일</th>
          </tr>
        </thead>
        <tbody>
            {filteredProjects.flatMap((project) => [
            <tr
              key={project.id}
              className="project-row"
              onClick={() => !isDeleteMode && onProjectClick(project)}
              style={{ cursor: isDeleteMode ? 'default' : 'pointer' }}
            >
              {isDeleteMode && (
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedProjectIds.has(project.id)}
                    onChange={() => onToggleProjectSelection(project.id)}
                    style={{ cursor: 'pointer' }}
                  />
                </td>
              )}
              <td
                onContextMenu={(event) => {
                  if (!isDeleteMode) {
                    event.stopPropagation()
                    onProjectContextMenu(event, project)
                  }
                }}
              >
                <p className="project-name" title="오른쪽 클릭으로 메뉴 열기">
                  {project.name}
                </p>
                <span className="project-id">{project.id}</span>
              </td>
              <td>{project.owner}</td>
              <td>{project.members}명</td>
              <td>
                <StatusBadge status={project.status} />
              </td>
              <td>
                <Progress 
                  value={project.progress} 
                  start={(project as any).start}
                  due={project.due}
                />
              </td>
              <td>{(project as any).srb_ver || '-'}</td>
              <td>{(project as any).start || '-'}</td>
              <td>{project.due}</td>
            </tr>,
            ...(project.children && project.children.length > 0
              ? project.children.map((child) => (
                  <tr
                    key={`${project.id}-${child.id}`}
                    className="child-row"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!isDeleteMode && (e.target as HTMLElement).tagName !== 'INPUT') {
                        onChildClick(child, project.id, project.name)
                      }
                    }}
                    style={{ cursor: isDeleteMode ? 'default' : 'pointer' }}
                  >
                    {isDeleteMode && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedChildIds.has(child.id)}
                          onChange={() => onToggleChildSelection(child.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                    )}
                    <td className="child-cell">
                      <span className="child-indicator">└─</span>
                      <div className="child-content">
                        <p className="child-title">{child.title}</p>
                        <span className="child-id">{child.id}</span>
                        {(child as any).kind_number && (
                          <span className="child-id" style={{ display: 'block', marginTop: '0.25rem', color: '#64748b', fontSize: '0.875rem' }}>
                            {(child as any).kind_number}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{child.owner}</td>
                    <td>-</td>
                    <td>
                      <StatusBadge status={child.status} />
                    </td>
                    <td>
                      <Progress 
                        value={(child as any).progress || 0} 
                        start={(child as any).start}
                        due={child.due}
                      />
                    </td>
                    <td>-</td>
                    <td>{(child as any).start || '-'}</td>
                    <td>{child.due || '-'}</td>
                  </tr>
                ))
              : []),
          ])}
        </tbody>
      </table>
      )}
    </div>
  )
}

