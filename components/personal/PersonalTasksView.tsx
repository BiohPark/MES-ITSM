'use client'

import { useMemo } from 'react'
import type { Project, ProjectChild } from '@/types/project'
import { StatusBadge } from '../common/StatusBadge'
import { Progress } from '../common/Progress'

export function PersonalTasksView({
  projects,
  gmpRecords = [],
  loading,
  error,
  searchOwner,
  onSearchOwnerChange,
  onRefresh,
  onTaskClick,
  onProjectClick,
}: {
  projects: Project[]
  gmpRecords?: Array<ProjectChild & { projectId?: string | null; projectName?: string; kind?: string }>
  loading: boolean
  error: string | null
  searchOwner: string
  onSearchOwnerChange: (value: string) => void
  onRefresh: () => void
  onTaskClick: (task: ProjectChild, projectId: string | null, projectName: string) => void
  onProjectClick: (project: Project) => void
}) {
  const allOwners = useMemo(() => {
    const owners = new Set<string>()
    projects.forEach((project) => {
      if (project.owner) owners.add(project.owner)
      project.children?.forEach((child) => {
        if (child.owner) owners.add(child.owner)
      })
    })
    // GMP Record 중 Deviation인 것들의 owner도 추가
    gmpRecords.forEach((record) => {
      if (record.kind === 'Deviation' && record.owner) {
        owners.add(record.owner)
      }
    })
    return Array.from(owners).sort()
  }, [projects, gmpRecords])

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
          if (child.owner === owner) {
            ownerTasks.push({
              task: child,
              projectId: project.id,
              projectName: project.name,
            })
          }
        })
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
  }, [filteredOwners, projects, gmpRecords])

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

      {filteredOwners.length === 0 ? (
        <div className="placeholder">
          <p>검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
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
                        {data.tasks.map(({ task, projectId, projectName }) => (
                          <tr
                            key={`${projectId}-${task.id}`}
                            className="project-row"
                            onClick={() => onTaskClick(task, projectId, projectName)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td>
                              <p className="project-name">{task.title}</p>
                              <span className="project-id">{task.id}</span>
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
                        ))}
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

