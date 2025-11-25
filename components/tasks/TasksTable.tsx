'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
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

  const fetchOrphanTasks = useCallback(async () => {
    try {
      setOrphanLoading(true)
      const apiEndpoint = isGmpRecords 
        ? '/api/gmp-records?type=orphan-records'
        : '/api/projects?type=orphan-tasks'
      const response = await fetch(apiEndpoint)
      if (response.ok) {
        const tasks = await response.json()
        setOrphanTasks(tasks || [])
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching orphan tasks:', error)
      }
      setOrphanTasks([])
    } finally {
      setOrphanLoading(false)
    }
  }, [isGmpRecords])

  useEffect(() => {
    if (!loading) {
      fetchOrphanTasks()
    }
  }, [loading, fetchOrphanTasks])

  const allTasks = useMemo(() => {
    const tasks: Array<{
      task: ProjectChild
      projectId: string | null
      projectName: string
    }> = []
    
    if (isGmpRecords && records) {
      // GMP Record 모드: records를 직접 사용 (프로젝트 정보 포함, orphan tasks는 records에 이미 포함됨)
      records.forEach((record: any) => {
        tasks.push({
          task: record,
          projectId: record.projectId || null,
          projectName: record.projectName || 'N/A',
        })
      })
    } else if (projects) {
      // 일반 일감 모드: projects에서 children 추출
      // "GMP-"로 시작하는 일감은 제외 (일감 목록에서는 GMP Record를 제외)
      projects.forEach((project) => {
        project.children?.forEach((child) => {
          // GMP-로 시작하는 ID를 가진 일감은 제외
          if (!child.id.startsWith('GMP-')) {
          tasks.push({
            task: child,
            projectId: project.id,
            projectName: project.name,
          })
          }
        })
      })
      // orphan tasks도 GMP-로 시작하는 것은 제외
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

  // 필터링된 일감 목록
  const filteredTasks = useMemo(() => {
    return allTasks.filter(({ task, projectName }) => {
      if (filterStatus && task.status !== filterStatus) return false
      if (filterOwner && task.owner !== filterOwner) return false
      if (filterProject && projectName !== filterProject) return false
      if (isGmpRecords && filterKind && (task as any).kind !== filterKind) return false
      return true
    })
  }, [allTasks, filterStatus, filterOwner, filterProject, filterKind, isGmpRecords])

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


  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>{title} <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: '#64748b' }}>({filteredTasks.length}개)</span></h2>
        <div className="table-actions">
          {renderFilterSection()}
          <button
            onClick={async () => {
              await onRefresh()
              await fetchOrphanTasks()
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
      {filteredTasks.length === 0 ? (
        <div className="placeholder">
          <p>필터 조건에 맞는 {title === '일감 목록' ? '일감' : 'GMP Record'}이 없습니다.</p>
        </div>
      ) : (
      <table>
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
            {filteredTasks.map(({ task, projectId, projectName }) => (
            <tr
              key={`${projectId || 'null'}-${task.id}`}
              className="project-row"
              onClick={() => !isDeleteMode && onTaskClick(task, projectId, projectName)}
              style={{ cursor: isDeleteMode ? 'default' : 'pointer' }}
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
          ))}
        </tbody>
      </table>
      )}
    </div>
  )
}

