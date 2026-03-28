'use client'

import { useState, useMemo } from 'react'
import type { MouseEvent } from 'react'
import type { Project, ProjectChild } from '@/types/project'
import { StatusBadge } from '../common/StatusBadge'
import { Progress } from '../common/Progress'
import { useI18n } from '@/lib/i18n'

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
  const { t } = useI18n()
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterOwner, setFilterOwner] = useState<string>('')
  // Accordion: 각 프로젝트의 하위 아이템 표시/숨김 상태 관리
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

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

  // Accordion 토글 함수
  const toggleProjectExpansion = (projectId: string, e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    setExpandedProjects((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(projectId)) {
        newSet.delete(projectId)
      } else {
        newSet.add(projectId)
      }
      return newSet
    })
  }

  // 하위 아이템 개수 계산 (Dropped 제외)
  const getChildCount = (project: Project): number => {
    if (!project.children) return 0
    return project.children.filter((child) => child.status !== 'Dropped').length
  }

  if (loading) {
    return (
      <div className="placeholder">
        <p>{t('comp.ui.loading')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="placeholder">
        <p style={{ color: '#e74c3c' }}>{t('comp.ui.errorPrefix')} {error}</p>
        <button onClick={onRefresh} className="refresh-button">
          {t('comp.ui.retry')}
        </button>
      </div>
    )
  }

  if (projects.length === 0) {
  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>{t('comp.projects.listTitle')}</h2>
        <div className="table-actions">
            <button onClick={onRefresh} className="refresh-button">
              {t('comp.ui.refresh')}
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
                  {t('comp.ui.delete')}
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
                  {t('comp.ui.cancel')}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="placeholder">
          <p>{t('comp.projects.noProjects')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>
          {t('comp.projects.listTitle')}
          {filteredProjects.length > 0 && (
            <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: '#64748b' }}>
              {t('comp.projects.listCount', { n: filteredProjects.length })}
            </span>
          )}
        </h2>
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
              <option value="">{t('comp.projects.filterAllStatus')}</option>
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
              <option value="">{t('comp.projects.filterAllLeaders')}</option>
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
                {t('comp.tasks.resetFilters')}
              </button>
            )}
          </div>
          <button onClick={onRefresh} className="refresh-button">
            {t('comp.ui.refresh')}
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
                {t('comp.ui.delete')}
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
                {t('comp.ui.cancel')}
              </button>
              {(selectedProjectIds.size > 0 || selectedChildIds.size > 0) && (
                <>
                  {selectedProjectIds.size > 0 && (
                    <button
                      onClick={onBatchDelete}
                      className="primary-button"
                      style={{ backgroundColor: '#e74c3c' }}
                    >
                      {t('comp.projects.deleteProjects')} ({selectedProjectIds.size})
                    </button>
                  )}
                  {selectedChildIds.size > 0 && (
                    <button
                      onClick={onBatchDeleteChildren}
                      className="primary-button"
                      style={{ backgroundColor: '#e74c3c' }}
                    >
                      {t('comp.projects.deleteChildren')} ({selectedChildIds.size})
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
          <p>{t('comp.projects.noMatch')}</p>
        </div>
      ) : (
      <table>
        <thead>
          <tr>
            {isDeleteMode && <th style={{ width: '40px' }}></th>}
            <th style={{ width: '40px' }}></th>
            <th>{t('comp.projects.colProject')}</th>
            <th>{t('comp.projects.colLeader')}</th>
            <th>{t('comp.projects.colHeadcount')}</th>
            <th>{t('comp.projects.colStatus')}</th>
            <th>{t('comp.projects.colProgress')}</th>
            <th>{t('comp.projects.colSrb')}</th>
            <th>{t('comp.projects.colStart')}</th>
            <th>{t('comp.projects.colDue')}</th>
          </tr>
        </thead>
        <tbody>
            {filteredProjects.flatMap((project) => {
              const childCount = getChildCount(project)
              const isExpanded = expandedProjects.has(project.id)
              const hasChildren = childCount > 0
              
              return [
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
              <td onClick={(e) => e.stopPropagation()}>
                {hasChildren ? (
                  <button
                    onClick={(e) => toggleProjectExpansion(project.id, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#666666',
                      fontSize: '0.875rem',
                    }}
                    title={isExpanded ? t('comp.projects.hideChildren') : t('comp.projects.showChildren')}
                  >
                    {isExpanded ? '▼' : '▶'}
                  </button>
                ) : (
                  <span style={{ display: 'inline-block', width: '20px' }}></span>
                )}
              </td>
              <td
                onContextMenu={(event) => {
                  if (!isDeleteMode) {
                    event.stopPropagation()
                    onProjectContextMenu(event, project)
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <p className="project-name" title={t('comp.projects.ctxHint')} style={{ margin: 0 }}>
                    {project.name}
                  </p>
                  {hasChildren && !isExpanded && (
                    <span style={{ 
                      fontSize: '0.75rem', 
                      color: '#666666',
                      backgroundColor: '#F4F6F8',
                      padding: '0.125rem 0.375rem',
                      borderRadius: '0.25rem',
                    }}>
                      ({childCount})
                    </span>
                  )}
                </div>
                <span className="project-id">{project.id}</span>
              </td>
              <td>{project.owner}</td>
              <td>
                {project.members}
                {t('comp.ui.name')}
              </td>
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
            ...(isExpanded && project.children && project.children.length > 0
              ? project.children
                  .filter((child) => child.status !== 'Dropped') // Dropped 일감 제외
                  .map((child) => (
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
                    <td>
                      {/* Accordion 버튼 컬럼 정렬을 위한 빈 셀 */}
                    </td>
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
          ]
          })}
        </tbody>
      </table>
      )}
    </div>
  )
}

