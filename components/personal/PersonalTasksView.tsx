'use client'

import { useMemo, useState, useEffect } from 'react'
import type { Project, ProjectChild } from '@/types/project'
import { StatusBadge } from '../common/StatusBadge'
import { Progress } from '../common/Progress'

export function PersonalTasksView({
  projects,
  gmpRecords = [],
  orphanTasks = [],
  loading,
  error,
  searchOwner,
  onSearchOwnerChange,
  onRefresh,
  onTaskClick,
  onProjectClick,
  currentUser,
}: {
  projects: Project[]
  gmpRecords?: Array<ProjectChild & { projectId?: string | null; projectName?: string; kind?: string; kind_number?: string }>
  orphanTasks?: ProjectChild[]
  loading: boolean
  error: string | null
  searchOwner: string
  onSearchOwnerChange: (value: string) => void
  onRefresh: () => void
  onTaskClick: (task: ProjectChild, projectId: string | null, projectName: string) => void
  onProjectClick: (project: Project) => void
  currentUser?: { name: string; username: string }
}) {
  const allOwners = useMemo(() => {
    const owners = new Set<string>()
    projects.forEach((project) => {
      if (project.owner) owners.add(project.owner)
      project.children?.forEach((child) => {
        // 대표 담당자
        if (child.owner) owners.add(child.owner)
        // 단계별 담당자들도 추가
        if ((child as any).phases?.pi?.owner) owners.add((child as any).phases.pi.owner)
        if ((child as any).phases?.development?.owner) owners.add((child as any).phases.development.owner)
      })
    })
    // Orphan tasks의 담당자들도 추가
    orphanTasks.forEach((task) => {
      if (task.owner) owners.add(task.owner)
      if ((task as any).phases?.pi?.owner) owners.add((task as any).phases.pi.owner)
      if ((task as any).phases?.development?.owner) owners.add((task as any).phases.development.owner)
    })
    // GMP Record 중 Deviation인 것들의 owner도 추가
    gmpRecords.forEach((record) => {
      if (record.kind === 'Deviation' && record.owner) {
        owners.add(record.owner)
      }
    })
    return Array.from(owners).sort()
  }, [projects, gmpRecords, orphanTasks])

  const filteredOwners = useMemo(() => {
    if (!searchOwner.trim()) return allOwners
    return allOwners.filter((owner) =>
      owner.toLowerCase().includes(searchOwner.toLowerCase())
    )
  }, [allOwners, searchOwner])

  const ownerData = useMemo(() => {
    const data: Record<string, { projects: Project[]; tasks: Array<{ task: ProjectChild; projectId: string | null; projectName: string }> }> = {}
    
    filteredOwners.forEach((owner) => {
      const ownerProjects: Project[] = []
      const ownerTasks: Array<{ task: ProjectChild; projectId: string | null; projectName: string }> = []

      projects.forEach((project) => {
        if (project.owner === owner) {
          ownerProjects.push(project)
        }
        project.children?.forEach((child: ProjectChild) => {
          // Dropped 일감은 제외
          if (child.status === 'Dropped') {
            return
          }
          
          // 대표 담당자(PI) 또는 단계별 담당자 중 하나라도 일치하면 포함
          const isOwner = child.owner === owner
          const isPiOwner = (child as any).phases?.pi?.owner === owner
          const isDevOwner = (child as any).phases?.development?.owner === owner
          
          if (isOwner || isPiOwner || isDevOwner) {
            ownerTasks.push({
              task: child,
              projectId: project.id,
              projectName: project.name,
            })
          }
        })
      })

      // Orphan tasks도 확인
      orphanTasks.forEach((task: ProjectChild) => {
        // Dropped 일감은 제외
        if (task.status === 'Dropped') {
          return
        }
        
        const isOwner = task.owner === owner
        const isPiOwner = (task as any).phases?.pi?.owner === owner
        const isDevOwner = (task as any).phases?.development?.owner === owner
        
        if (isOwner || isPiOwner || isDevOwner) {
          ownerTasks.push({
            task,
            projectId: null,
            projectName: 'N/A',
          })
        }
      })

      // GMP Record 중 Deviation인 것들을 추가
      gmpRecords.forEach((record) => {
        if (record.kind === 'Deviation' && record.owner === owner) {
          ownerTasks.push({
            task: record,
            projectId: record.projectId || null,
            projectName: record.projectName || 'N/A',
          })
        }
      })

      if (ownerProjects.length > 0 || ownerTasks.length > 0) {
        data[owner] = { projects: ownerProjects, tasks: ownerTasks }
      }
    })

    return data
  }, [filteredOwners, projects, gmpRecords, orphanTasks])

  // 로그인한 사용자의 일감 데이터
  // 액션 아이템 상태
  const [myActionItems, setMyActionItems] = useState<Array<{
    id: string
    description: string
    assignee: string
    due_date: string | null
    status: 'pending' | 'in_progress' | 'completed'
    meeting_note_id: string
    meeting_title: string
    meeting_date: string
  }>>([])
  const [actionItemsLoading, setActionItemsLoading] = useState(false)

  // 진행 중인 액션 아이템 조회
  useEffect(() => {
    if (!currentUser?.name) {
      setMyActionItems([])
      return
    }

    const fetchActionItems = async () => {
      try {
        setActionItemsLoading(true)
        const response = await fetch(`/api/action-items?assignee=${encodeURIComponent(currentUser.name)}`, {
          cache: 'no-store',
        })
        if (response.ok) {
          const data = await response.json()
          if (process.env.NODE_ENV === 'development') {
            console.log('[PersonalTasksView] 액션 아이템 조회 결과:', {
              currentUser: currentUser.name,
              totalItems: data.length,
              items: data,
            })
          }
          // 진행 중인 액션 아이템만 필터링 (status가 'in_progress'인 것만)
          const inProgressItems = data.filter((item: any) => item.status === 'in_progress')
          if (process.env.NODE_ENV === 'development') {
            console.log('[PersonalTasksView] 진행 중인 액션 아이템:', inProgressItems)
          }
          setMyActionItems(inProgressItems)
        } else {
          console.error('[PersonalTasksView] 액션 아이템 조회 실패:', response.status, response.statusText)
        }
      } catch (err) {
        console.error('[PersonalTasksView] Error fetching action items:', err)
      } finally {
        setActionItemsLoading(false)
      }
    }

    fetchActionItems()
  }, [currentUser?.name])

  const myTasksData = useMemo(() => {
    if (!currentUser?.name) return null
    
    const myProjects: Project[] = []
    const myTasks: Array<{ task: ProjectChild; projectId: string | null; projectName: string }> = []

    projects.forEach((project) => {
      // 프로젝트는 진행 중인 것만 포함 (In Progress 상태)
      const isProjectInProgress = project.status === 'In Progress' || project.status?.toLowerCase() === 'in progress'
      if (project.owner === currentUser.name && isProjectInProgress) {
        myProjects.push(project)
      }
      project.children?.forEach((child: ProjectChild) => {
        // Dropped 일감은 제외
        if (child.status === 'Dropped') {
          return
        }
        
        // 진행 중인 일감만 포함 (In Progress 상태)
        const isInProgress = child.status === 'In Progress' || child.status?.toLowerCase() === 'in progress'
        if (!isInProgress) {
          return
        }
        
        // 대표 담당자(PI) 또는 단계별 담당자 중 하나라도 일치하면 포함
        const isOwner = child.owner === currentUser.name
        const isPiOwner = (child as any).phases?.pi?.owner === currentUser.name
        const isDevOwner = (child as any).phases?.development?.owner === currentUser.name
        
        if (isOwner || isPiOwner || isDevOwner) {
          myTasks.push({
            task: child,
            projectId: project.id,
            projectName: project.name,
          })
        }
      })
    })

    // Orphan tasks도 확인
    orphanTasks.forEach((task: ProjectChild) => {
      // Dropped 일감은 제외
      if (task.status === 'Dropped') {
        return
      }
      
      // 진행 중인 일감만 포함
      const isInProgress = task.status === 'In Progress' || task.status?.toLowerCase() === 'in progress'
      if (!isInProgress) {
        return
      }
      
      const isOwner = task.owner === currentUser.name
      const isPiOwner = (task as any).phases?.pi?.owner === currentUser.name
      const isDevOwner = (task as any).phases?.development?.owner === currentUser.name
      
      if (isOwner || isPiOwner || isDevOwner) {
        myTasks.push({
          task,
          projectId: null,
          projectName: 'N/A',
        })
      }
    })

    // GMP Record 중 Deviation인 것들도 추가 (진행 중인 것만)
    gmpRecords.forEach((record) => {
      const isInProgress = record.status === 'In Progress' || record.status?.toLowerCase() === 'in progress'
      if (record.kind === 'Deviation' && record.owner === currentUser.name && isInProgress) {
        myTasks.push({
          task: record,
          projectId: record.projectId || null,
          projectName: record.projectName || 'N/A',
        })
      }
    })

    // 상태별 갯수 계산 (진행 중인 것만 표시하므로 In Progress만 카운트)
    const statusCounts = {
      Planning: 0,
      'In Progress': myTasks.length + myProjects.length,
      Completed: 0,
      Dropped: 0,
    }

    return {
      projects: myProjects,
      tasks: myTasks,
      statusCounts,
    }
  }, [currentUser, projects, gmpRecords, orphanTasks])

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

  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>개인별 일감</h2>
        <div className="table-actions">
          <input
            type="text"
            placeholder="담당자 이름 검색..."
            value={searchOwner}
            onChange={(e) => onSearchOwnerChange(e.target.value)}
            className="form-input"
            style={{ width: '200px', marginRight: '0.75rem' }}
          />
          <button onClick={onRefresh} className="refresh-button">
            새로고침
          </button>
        </div>
      </div>

      {filteredOwners.length === 0 && allOwners.length === 0 ? (
        <div className="placeholder">
          <p>담당자가 할당된 일감이 없습니다.</p>
        </div>
      ) : filteredOwners.length === 0 ? (
        <div className="placeholder">
          <p>검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* My 진행 중 일감 섹션 */}
          {myTasksData && (myTasksData.projects.length > 0 || myTasksData.tasks.length > 0 || myActionItems.length > 0) && (
            <div style={{ border: '2px solid #3b82f6', borderRadius: '0.75rem', padding: '1.5rem', backgroundColor: '#eff6ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e40af' }}>
                  My 진행 중 일감 ({currentUser?.name})
                </h3>
                {/* 진행 중인 일감만 표시되므로 In Progress만 표시 */}
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem' }}>
                  {myTasksData.statusCounts['In Progress'] > 0 && (
                    <span style={{ color: '#15803d' }}>
                      진행 중: {myTasksData.statusCounts['In Progress']}
                    </span>
                  )}
                </div>
              </div>

              {myTasksData.projects.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: 500, color: '#475569' }}>
                    프로젝트 ({myTasksData.projects.length})
                  </h4>
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>프로젝트</th>
                        <th>인원</th>
                        <th>상태</th>
                        <th>진척도(계획/실적)</th>
                        <th>시작일</th>
                        <th>마감일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myTasksData.projects.map((project) => (
                        <tr
                          key={project.id}
                          className="project-row"
                          onClick={() => onProjectClick(project)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <p className="project-name">{project.name}</p>
                            <span className="project-id">{project.id}</span>
                          </td>
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
                          <td>{(project as any).start || '-'}</td>
                          <td>{project.due}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {myTasksData.tasks.length > 0 && (
                <div>
                  <h4 style={{ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: 500, color: '#475569' }}>
                    일감 ({myTasksData.tasks.length})
                  </h4>
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>일감</th>
                        <th>프로젝트</th>
                        <th>상태</th>
                        <th>시작일</th>
                        <th>마감일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myTasksData.tasks.map(({ task, projectId, projectName }) => {
                        const isGmpRecord = !!(task as any).kind_number || !!(task as any).kind || !!(task as any).isGmpRecord
                        const kindNumber = (task as any).kind_number
                        return (
                          <tr
                            key={`${projectId}-${task.id}`}
                            className="project-row"
                            onClick={() => onTaskClick(task, projectId, projectName)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td>
                              <p className="project-name">{task.title}</p>
                              <span className="project-id">
                                {task.id}
                                {isGmpRecord && kindNumber && ` / ${kindNumber}`}
                              </span>
                            </td>
                            <td>
                              <span className="project-name">{projectName || 'N/A'}</span>
                              <span className="project-id">{projectId || 'N/A'}</span>
                            </td>
                            <td>
                              <StatusBadge status={task.status} />
                            </td>
                            <td>{(task as any).start || '-'}</td>
                            <td>{task.due}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 액션 아이템 섹션 */}
              {actionItemsLoading ? (
                <div style={{ marginTop: '1.5rem', padding: '1rem', textAlign: 'center', color: '#666' }}>
                  액션 아이템 로딩 중...
                </div>
              ) : myActionItems.length > 0 ? (
                <div style={{ marginTop: '1.5rem' }}>
                  <h4 style={{ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: 500, color: '#475569' }}>
                    회의록 액션 아이템 ({myActionItems.length})
                  </h4>
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>설명</th>
                        <th>마감일</th>
                        <th>상태</th>
                        <th>회의록</th>
                        <th>회의 일시</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myActionItems.map((item) => (
                        <tr key={`${item.meeting_note_id}-${item.id}`}>
                          <td style={{ fontWeight: 500 }}>{item.description}</td>
                          <td>{item.due_date || '-'}</td>
                          <td>
                            <StatusBadge
                              status={
                                item.status === 'completed'
                                  ? 'Completed'
                                  : item.status === 'in_progress'
                                  ? 'In Progress'
                                  : 'Planning'
                              }
                            />
                          </td>
                          <td>
                            <span style={{ fontSize: '0.875rem', color: '#666' }}>{item.meeting_title}</span>
                          </td>
                          <td>{item.meeting_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )}

          {/* 다른 사용자들의 일감 */}
          {filteredOwners.map((owner) => {
            const data = ownerData[owner]
            if (!data || (data.projects.length === 0 && data.tasks.length === 0)) {
              return null
            }

            return (
              <div key={owner} style={{ border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>
                  {owner}
                </h3>

                {data.projects.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: 500, color: '#475569' }}>
                      프로젝트 ({data.projects.length})
                    </h4>
                    <table style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>프로젝트</th>
                          <th>인원</th>
                          <th>상태</th>
                          <th>진척도(계획/실적)</th>
                          <th>시작일</th>
                          <th>마감일</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.projects.map((project) => (
                          <tr
                            key={project.id}
                            className="project-row"
                            onClick={() => onProjectClick(project)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td>
                              <p className="project-name">{project.name}</p>
                              <span className="project-id">{project.id}</span>
                            </td>
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
                            <td>{(project as any).start || '-'}</td>
                            <td>{project.due}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {data.tasks.length > 0 && (
                  <div>
                    <h4 style={{ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: 500, color: '#475569' }}>
                      일감 ({data.tasks.length})
                    </h4>
                    <table style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>일감</th>
                          <th>프로젝트</th>
                          <th>상태</th>
                          <th>시작일</th>
                          <th>마감일</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.tasks.map(({ task, projectId, projectName }) => {
                          const isGmpRecord = !!(task as any).kind_number || !!(task as any).kind || !!(task as any).isGmpRecord
                          const kindNumber = (task as any).kind_number
                          return (
                            <tr
                              key={`${projectId}-${task.id}`}
                              className="project-row"
                              onClick={() => onTaskClick(task, projectId, projectName)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td>
                                <p className="project-name">{task.title}</p>
                                <span className="project-id">
                                  {task.id}
                                  {isGmpRecord && kindNumber && ` / ${kindNumber}`}
                                </span>
                              </td>
                              <td>
                                <span className="project-name">{projectName || 'N/A'}</span>
                                <span className="project-id">{projectId || 'N/A'}</span>
                              </td>
                              <td>
                                <StatusBadge status={task.status} />
                              </td>
                              <td>{(task as any).start || '-'}</td>
                              <td>{task.due}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
