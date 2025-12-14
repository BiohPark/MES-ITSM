'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import type { Project, ProjectChild } from '@/types/project'
import { StatusBadge } from '../common/StatusBadge'
import { Progress } from '../common/Progress'

export function TasksTable({
  projects,
  records,
  loading,
  error,
  onRefresh,
  onTaskClick,
  onNewTask,
  isDeleteMode,
  selectedTaskIds,
  onToggleTaskSelection,
  onDeleteModeChange,
  onBatchDelete,
  title = '일감 목록',
}: {
  projects?: Project[]
  records?: ProjectChild[]
  loading: boolean
  error: string | null
  onRefresh: () => void | Promise<void>
  onTaskClick: (task: ProjectChild, projectId: string | null, projectName: string) => void
  onNewTask: () => void
  isDeleteMode: boolean
  selectedTaskIds: Set<string>
  onToggleTaskSelection: (taskId: string) => void
  onDeleteModeChange: (enabled: boolean) => void
  onBatchDelete: () => void
  title?: string
}) {
  const [orphanTasks, setOrphanTasks] = useState<ProjectChild[]>([])
  const [orphanLoading, setOrphanLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterOwner, setFilterOwner] = useState<string>('')
  const [filterProject, setFilterProject] = useState<string>('')
  const [filterKind, setFilterKind] = useState<string>('')
  const isGmpRecords = !!records
  
  // Accordion 상태 관리
  const [isPimTasksOpen, setIsPimTasksOpen] = useState(true)
  const [isDevelopmentTasksOpen, setIsDevelopmentTasksOpen] = useState(true)
  const [isCompletedTasksOpen, setIsCompletedTasksOpen] = useState(true)
  const [isDroppedTasksOpen, setIsDroppedTasksOpen] = useState(true)

  const fetchOrphanTasks = useCallback(async (signal?: AbortSignal) => {
    try {
      setOrphanLoading(true)
      const apiEndpoint = isGmpRecords 
        ? '/api/gmp-records?type=orphan-records'
        : '/api/projects?type=orphan-tasks'
      const response = await fetch(apiEndpoint, {
        signal,
      })
      if (signal?.aborted) return
      if (response.ok) {
        const tasks = await response.json()
        if (signal?.aborted) return
        setOrphanTasks(tasks || [])
      }
    } catch (error) {
      if (signal?.aborted) return
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching orphan tasks:', error)
      }
      setOrphanTasks([])
    } finally {
      if (!signal?.aborted) {
        setOrphanLoading(false)
      }
    }
  }, [isGmpRecords])

  useEffect(() => {
    if (loading) return
    
    const abortController = new AbortController()
    fetchOrphanTasks(abortController.signal)

    return () => {
      abortController.abort()
    }
  }, [loading, fetchOrphanTasks])

  const allTasks = useMemo(() => {
    const tasks: Array<{
      task: ProjectChild
      projectId: string | null
      projectName: string
    }> = []
    
    if (isGmpRecords && records) {
      // GMP Record 모드: records를 직접 사용
      records.forEach((record: any) => {
        tasks.push({
          task: record,
          projectId: record.projectId || null,
          projectName: record.projectName || 'N/A',
        })
      })
    } else if (projects) {
      // 일반 일감 모드: projects에서 children 추출
      projects.forEach((project) => {
        project.children?.forEach((child) => {
          if (!child.id.startsWith('GMP-')) {
            tasks.push({
              task: child,
              projectId: project.id,
              projectName: project.name,
            })
          }
        })
      })
      orphanTasks.forEach((task) => {
        if (!task.id.startsWith('GMP-')) {
          tasks.push({
            task,
            projectId: null,
            projectName: 'N/A',
          })
        }
      })
    }
    return tasks
  }, [projects, records, orphanTasks, isGmpRecords])

  // 일감을 4개 목록으로 분류 (PIM일감, 개발일감, 완료일감, Dropped일감)
  const { pimTasks, developmentTasks, completedTasks, droppedTasks } = useMemo(() => {
    const pim: Array<{ task: ProjectChild; projectId: string | null; projectName: string }> = []
    const dev: Array<{ task: ProjectChild; projectId: string | null; projectName: string }> = []
    const completed: Array<{ task: ProjectChild; projectId: string | null; projectName: string }> = []
    const dropped: Array<{ task: ProjectChild; projectId: string | null; projectName: string }> = []

    allTasks.forEach(({ task, projectId, projectName }) => {
      // GMP Record는 분류하지 않음 (기존 로직 유지)
      if (isGmpRecords) {
        if (task.status === 'Completed') {
          completed.push({ task, projectId, projectName })
        } else {
          dev.push({ task, projectId, projectName })
        }
        return
      }

      // Dropped 일감: status가 Dropped인 경우
      if (task.status === 'Dropped') {
        dropped.push({ task, projectId, projectName })
        return
      }

      // 일반 일감 분류
      const phases = (task as any).phases || {}
      const piProgress = Number(phases?.pi?.progress) || 0
      const pmProgress = Number(phases?.pm?.progress) || 0
      
      // 완료일감: status가 Completed인 경우
      if (task.status === 'Completed') {
        completed.push({ task, projectId, projectName })
      }
      // PIM일감: PI와 PM 진척율이 모두 100%가 아닌 경우
      else if (piProgress < 100 || pmProgress < 100) {
        pim.push({ task, projectId, projectName })
      }
      // 개발일감: PI와 PM 진척율이 모두 100%이고 완료되지 않은 경우
      else {
        dev.push({ task, projectId, projectName })
      }
    })

    return { pimTasks: pim, developmentTasks: dev, completedTasks: completed, droppedTasks: dropped }
  }, [allTasks, isGmpRecords])

  // 필터링 함수
  const filterTasks = useCallback((tasks: Array<{ task: ProjectChild; projectId: string | null; projectName: string }>) => {
    return tasks.filter(({ task, projectName }) => {
      if (filterStatus && task.status !== filterStatus) return false
      if (filterOwner && task.owner !== filterOwner) return false
      if (filterProject && projectName !== filterProject) return false
      if (isGmpRecords && filterKind && (task as any).kind !== filterKind) return false
      return true
    })
  }, [filterStatus, filterOwner, filterProject, filterKind, isGmpRecords])

  const filteredPimTasks = useMemo(() => filterTasks(pimTasks), [pimTasks, filterTasks])
  const filteredDevelopmentTasks = useMemo(() => filterTasks(developmentTasks), [developmentTasks, filterTasks])
  const filteredCompletedTasks = useMemo(() => filterTasks(completedTasks), [completedTasks, filterTasks])
  const filteredDroppedTasks = useMemo(() => filterTasks(droppedTasks), [droppedTasks, filterTasks])

  // 고유한 값들 추출
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>()
    allTasks.forEach(({ task }) => {
      if (task.status) statuses.add(task.status)
    })
    return Array.from(statuses).sort()
  }, [allTasks])

  const uniqueOwners = useMemo(() => {
    const owners = new Set<string>()
    allTasks.forEach(({ task }) => {
      if (task.owner) owners.add(task.owner)
    })
    return Array.from(owners).sort()
  }, [allTasks])

  const uniqueProjects = useMemo(() => {
    const projectSet = new Set<string>()
    allTasks.forEach(({ projectName }) => {
      if (projectName && projectName !== 'N/A') projectSet.add(projectName)
    })
    return Array.from(projectSet).sort()
  }, [allTasks])

  const uniqueKinds = useMemo(() => {
    if (!isGmpRecords) return []
    const kinds = new Set<string>()
    allTasks.forEach(({ task }) => {
      if ((task as any).kind) kinds.add((task as any).kind)
    })
    return Array.from(kinds).sort()
  }, [allTasks, isGmpRecords])

  // 필터 섹션 렌더링 함수
  const renderFilterSection = () => (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginRight: '0.75rem', flexWrap: 'wrap' }}>
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
        <option value="">전체 담당자</option>
        {uniqueOwners.map((owner) => (
          <option key={owner} value={owner}>
            {owner}
          </option>
        ))}
      </select>
      <select
        value={filterProject}
        onChange={(e) => setFilterProject(e.target.value)}
        style={{
          padding: '0.5rem',
          border: '1px solid #d1d5db',
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
          background: 'white',
          cursor: 'pointer',
        }}
      >
        <option value="">전체 프로젝트</option>
        {uniqueProjects.map((project) => (
          <option key={project} value={project}>
            {project}
          </option>
        ))}
      </select>
      {isGmpRecords && (
        <select
          value={filterKind}
          onChange={(e) => setFilterKind(e.target.value)}
          style={{
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            background: 'white',
            cursor: 'pointer',
          }}
        >
          <option value="">전체 종류</option>
          {uniqueKinds.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      )}
      {(filterStatus || filterOwner || filterProject || filterKind) && (
        <button
          onClick={() => {
            setFilterStatus('')
            setFilterOwner('')
            setFilterProject('')
            setFilterKind('')
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
  )

  // 테이블 렌더링 함수
  const renderTable = (
    tasks: Array<{ task: ProjectChild; projectId: string | null; projectName: string }>,
    showPhaseStatuses: boolean = false,
    isTaskList: boolean = false // PIM일감, 개발일감, 완료일감 목록인지 여부
  ) => {
    if (tasks.length === 0) return null

    return (
      <table style={{ width: '100%', marginTop: '0.5rem' }}>
        <thead>
          <tr>
            {isDeleteMode && <th style={{ width: '40px' }}></th>}
            <th>일감</th>
            {isGmpRecords && <th>종류-번호</th>}
            <th>프로젝트</th>
            <th>담당자</th>
            <th>상태</th>
            <th>진척도(계획/실적)</th>
            <th>시작일</th>
            <th>마감일</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(({ task, projectId, projectName }) => {
            const phases = (task as any).phases || {}
            const piStatus = phases?.pi?.status || '-'
            const pmStatus = phases?.pm?.status || '-'
            const devStatus = phases?.development?.status || '-'
            
            // colSpan 계산
            // 일반 일감: 체크박스(삭제모드만) + 일감(1) + 프로젝트(1) + 담당자(1) = 3 또는 4
            // GMP Record: 체크박스(삭제모드만) + 일감(1) + 종류-번호(1) + 프로젝트(1) + 담당자(1) = 4 또는 5
            const firstColSpan = (isDeleteMode ? 1 : 0) + 1 + (isGmpRecords ? 1 : 0) + 1 + 1
            // 나머지: 상태(1) + 진척도(1) + 시작일(1) + 마감일(1) = 4
            const remainingCols = 4
            
            return (
              <React.Fragment key={`${projectId || 'null'}-${task.id}`}>
                <tr
                  className="project-row"
                  onClick={() => !isDeleteMode && onTaskClick(task, projectId, projectName)}
                  style={{ 
                    cursor: isDeleteMode ? 'default' : 'pointer',
                    borderBottom: showPhaseStatuses && !isGmpRecords 
                      ? '1px solid #e5e7eb'  // 단계별 상태 행이 있으면 얇게
                      : (isTaskList && !isGmpRecords ? '2px solid #d1d5db' : '1px solid #e5e7eb')  // 단계별 상태 행이 없으면 목록에 따라
                  }}
                >
                  {isDeleteMode && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedTaskIds.has(task.id)}
                        onChange={() => onToggleTaskSelection(task.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                  )}
                  <td>
                    <p className="project-name">{task.title}</p>
                    <span className="project-id">{task.id}</span>
                    {(task as any).linked_gmp_record_id && (
                      <span style={{ fontSize: '0.75rem', color: '#3b82f6', marginLeft: '0.5rem' }}>
                        🔗 Link: {(task as any).linked_gmp_record_id}
                      </span>
                    )}
                    {(task as any).linked_val_packages && (task as any).linked_val_packages.length > 0 && (
                      <div style={{ marginTop: '0.25rem' }}>
                        {(task as any).linked_val_packages.map((vp: any, idx: number) => (
                          <span
                            key={vp.id}
                            style={{
                              fontSize: '0.75rem',
                              color: '#10b981',
                              marginLeft: idx > 0 ? '0.5rem' : '0',
                              display: 'inline-block',
                            }}
                          >
                            📦 VAL: {vp.name} ({vp.id})
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  {isGmpRecords && (
                    <td>
                      <span className="project-id">{(task as any).kind_number || 'CC-00000'}</span>
                      {(task as any).linked_task_id && (
                        <span style={{ fontSize: '0.75rem', color: '#3b82f6', marginLeft: '0.5rem', display: 'block' }}>
                          🔗 Link: {(task as any).linked_task_id}
                        </span>
                      )}
                    </td>
                  )}
                  <td>
                    <span className="project-name">{projectName || 'N/A'}</span>
                    <span className="project-id">{projectId || 'N/A'}</span>
                  </td>
                  <td>{task.owner}</td>
                  <td>
                    <StatusBadge status={task.status} />
                  </td>
                  <td>
                    <Progress 
                      value={(task as any).progress || 0} 
                      start={(task as any).start}
                      due={task.due}
                    />
                  </td>
                  <td>{(task as any).start || '-'}</td>
                  <td>{task.due}</td>
                </tr>
                {showPhaseStatuses && !isGmpRecords && (
                  <tr
                    style={{ 
                      backgroundColor: '#f9fafb', 
                      fontSize: '0.875rem',
                      borderBottom: '2px solid #d1d5db'
                    }}
                    onClick={() => !isDeleteMode && onTaskClick(task, projectId, projectName)}
                  >
                    {isDeleteMode && <td></td>}
                    <td colSpan={firstColSpan} style={{ padding: '0.5rem 1rem', color: '#6b7280' }}>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <span>
                          <strong style={{ color: '#374151' }}>PI:</strong> {piStatus}
                        </span>
                        <span>
                          <strong style={{ color: '#374151' }}>PM:</strong> {pmStatus}
                        </span>
                        <span>
                          <strong style={{ color: '#374151' }}>개발:</strong> {devStatus}
                        </span>
                      </div>
                    </td>
                    <td colSpan={remainingCols}></td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    )
  }

  // Accordion 섹션 렌더링 함수
  const renderAccordionSection = (
    title: string,
    count: number,
    isOpen: boolean,
    onToggle: () => void,
    tasks: Array<{ task: ProjectChild; projectId: string | null; projectName: string }>,
    color: string
  ) => {
    if (tasks.length === 0 && !filterStatus && !filterOwner && !filterProject && !filterKind) {
      return null
    }

    return (
      <div style={{ marginBottom: '1.5rem', border: `2px solid ${color}`, borderRadius: '0.75rem', overflow: 'hidden' }}>
        <div
          onClick={onToggle}
          style={{
            padding: '1rem',
            backgroundColor: color,
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontWeight: 600,
          }}
        >
          <span>
            {title} ({count}개)
          </span>
          <span style={{ fontSize: '1.2rem' }}>
            {isOpen ? '▼' : '▶'}
          </span>
        </div>
        {isOpen && (
          <div style={{ padding: '1rem', backgroundColor: '#f9fafb' }}>
            {tasks.length === 0 ? (
              <div className="placeholder">
                <p>필터 조건에 맞는 일감이 없습니다.</p>
              </div>
            ) : (
              renderTable(
                tasks, 
                title === 'PIM일감' || title === '개발일감',
                title === 'PIM일감' || title === '개발일감' || title === '완료일감'
              )
            )}
          </div>
        )}
      </div>
    )
  }

  if (loading || orphanLoading) {
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

  const totalCount = filteredPimTasks.length + filteredDevelopmentTasks.length + filteredCompletedTasks.length

  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>
          {title} 
          <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: '#64748b' }}>
            ({totalCount}개)
          </span>
        </h2>
        <div className="table-actions">
          {renderFilterSection()}
          <button
            onClick={async () => {
              await onRefresh()
              await fetchOrphanTasks(undefined)
            }}
            className="refresh-button"
          >
            새로고침
          </button>
          {!isDeleteMode ? (
            <>
              <button onClick={onNewTask} className="primary-button">
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
              {selectedTaskIds.size > 0 && (
                <button
                  onClick={onBatchDelete}
                  className="primary-button"
                  style={{ backgroundColor: '#e74c3c' }}
                >
                  선택 삭제 ({selectedTaskIds.size})
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {!isGmpRecords ? (
        // 일반 일감: 4개 목록으로 분리 (PIM일감, 개발일감, 완료일감, Dropped일감)
        <div>
          {renderAccordionSection(
            'PIM일감',
            filteredPimTasks.length,
            isPimTasksOpen,
            () => setIsPimTasksOpen(!isPimTasksOpen),
            filteredPimTasks,
            '#3b82f6'
          )}
          {renderAccordionSection(
            '개발일감',
            filteredDevelopmentTasks.length,
            isDevelopmentTasksOpen,
            () => setIsDevelopmentTasksOpen(!isDevelopmentTasksOpen),
            filteredDevelopmentTasks,
            '#10b981'
          )}
          {renderAccordionSection(
            '완료일감',
            filteredCompletedTasks.length,
            isCompletedTasksOpen,
            () => setIsCompletedTasksOpen(!isCompletedTasksOpen),
            filteredCompletedTasks,
            '#6b7280'
          )}
          {renderAccordionSection(
            'Dropped일감',
            filteredDroppedTasks.length,
            isDroppedTasksOpen,
            () => setIsDroppedTasksOpen(!isDroppedTasksOpen),
            filteredDroppedTasks,
            '#52525b'
          )}
          {totalCount === 0 && (
            <div className="placeholder">
              <p>필터 조건에 맞는 일감이 없습니다.</p>
            </div>
          )}
        </div>
      ) : (
        // GMP Record: 기존 방식 유지
        <div>
          {filteredDevelopmentTasks.length > 0 && renderTable(filteredDevelopmentTasks)}
          {filteredCompletedTasks.length > 0 && renderTable(filteredCompletedTasks)}
          {totalCount === 0 && (
            <div className="placeholder">
              <p>필터 조건에 맞는 GMP Record가 없습니다.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
