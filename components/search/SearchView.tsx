'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Project, ProjectChild } from '@/types/project'
import type { GanttTaskSearchHit } from '@/lib/db'
import { StatusBadge } from '../common/StatusBadge'
import { Progress } from '../common/Progress'
import { SearchIcon } from '../common/Icons'
import { useI18n } from '@/lib/i18n'

interface SearchResult {
  projects: Array<Project & { type: 'project' }>
  tasks: Array<ProjectChild & { type: 'task'; projectId: string | null; projectName: string }>
  gmpRecords: Array<ProjectChild & { type: 'gmp-record'; projectId: string | null; projectName: string; kind_number?: string }>
  ganttTasks?: GanttTaskSearchHit[]
}

interface SearchViewProps {
  onProjectClick: (project: Project) => void
  onTaskClick: (task: ProjectChild, projectId: string | null, projectName: string) => void
  onGanttTaskClick?: (projectId: number) => void
}

export function SearchView({ onProjectClick, onTaskClick, onGanttTaskClick }: SearchViewProps) {
  const { t } = useI18n()
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<SearchResult>({
    projects: [],
    tasks: [],
    gmpRecords: [],
    ganttTasks: [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = useCallback(async (searchKeyword: string, signal?: AbortSignal) => {
    if (!searchKeyword.trim()) {
      setResults({ projects: [], tasks: [], gmpRecords: [], ganttTasks: [] })
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/search?keyword=${encodeURIComponent(searchKeyword.trim())}`, {
        signal,
      })
      if (signal?.aborted) return
      if (!response.ok) {
        throw new Error(t('comp.search.fail'))
      }
      const data = await response.json()
      if (signal?.aborted) return
      setResults(data)
    } catch (err) {
      if (signal?.aborted) return
      console.error('Search error:', err)
      setError(err instanceof Error ? err.message : t('comp.search.error'))
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }, [t])

  useEffect(() => {
    const abortController = new AbortController()
    const timer = setTimeout(() => {
      if (keyword.trim()) {
        handleSearch(keyword, abortController.signal)
      } else {
        setResults({ projects: [], tasks: [], gmpRecords: [], ganttTasks: [] })
      }
    }, 300) // 디바운스: 300ms 후 검색

    return () => {
      clearTimeout(timer)
      abortController.abort()
    }
  }, [keyword, handleSearch])

  const ganttTasks = results.ganttTasks ?? []
  const totalResults = results.projects.length + results.tasks.length + results.gmpRecords.length + ganttTasks.length

  const metaSuffix = useMemo(() => {
    const parts: string[] = []
    if (results.projects.length > 0) parts.push(t('comp.search.metaProjects', { n: results.projects.length }))
    if (results.tasks.length > 0) parts.push(t('comp.search.metaTasks', { n: results.tasks.length }))
    if (results.gmpRecords.length > 0) parts.push(t('comp.search.metaGmp', { n: results.gmpRecords.length }))
    if (ganttTasks.length > 0) parts.push(t('comp.search.metaGantt', { n: ganttTasks.length }))
    return parts.length > 0 ? ` (${parts.join(', ')})` : ''
  }, [results.projects.length, results.tasks.length, results.gmpRecords.length, ganttTasks.length, t])

  return (
    <div className="table-wrapper">
      <div className="table-header" style={{ alignItems: 'center' }}>
        <h2 style={{ 
          margin: 0, 
          lineHeight: '1',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: 'calc(0.75rem * 2 + 1rem + 2px)',
          padding: 0,
          overflow: 'hidden'
        }}>
          <SearchIcon 
            size="calc(0.75rem * 2 + 1rem + 2px)" 
            color="#6b7280"
          />
        </h2>
        <div style={{ marginBottom: '1rem', width: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t('comp.search.ph')}
              className="form-input"
              style={{ flex: 1, padding: '0.75rem', fontSize: '1rem' }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch(keyword)
                }
              }}
            />
            <button
              onClick={() => handleSearch(keyword)}
              disabled={loading}
              className="primary-button"
              style={{ padding: '0.75rem 1.5rem' }}
            >
              {loading ? t('comp.search.searching') : t('comp.search.submit')}
            </button>
          </div>
          {keyword.trim() && (
            <div style={{ marginTop: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
              {t('comp.search.metaTotal', { total: totalResults, suffix: metaSuffix })}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="placeholder">
          <p style={{ color: '#e74c3c' }}>{t('comp.ui.errorPrefix')} {error}</p>
        </div>
      )}

      {!keyword.trim() && (
        <div className="placeholder">
          <p>{t('comp.search.needKeyword')}</p>
        </div>
      )}

      {keyword.trim() && !loading && totalResults === 0 && (
        <div className="placeholder">
          <p>{t('comp.search.noResults', { q: keyword })}</p>
        </div>
      )}

      {(results.projects.length > 0 || results.tasks.length > 0 || results.gmpRecords.length > 0 || ganttTasks.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* 프로젝트 결과 */}
          {results.projects.length > 0 && (
            <div>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 600 }}>
                {t('comp.search.headingProjects', { n: results.projects.length })}
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>{t('comp.projects.colProject')}</th>
                    <th>{t('comp.search.colLeader')}</th>
                    <th>{t('comp.search.colHeadcount')}</th>
                    <th>{t('comp.projects.colStatus')}</th>
                    <th>{t('comp.projects.colProgress')}</th>
                    <th>{t('comp.projects.colSrb')}</th>
                    <th>{t('comp.projects.colStart')}</th>
                    <th>{t('comp.projects.colDue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.projects.map((project) => (
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
                          start={project.start}
                          due={project.due}
                        />
                      </td>
                      <td>{(project as any).srb_ver || '-'}</td>
                      <td>{project.start || '-'}</td>
                      <td>{project.due}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 일감 결과 */}
          {results.tasks.length > 0 && (
            <div>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 600 }}>
                {t('comp.search.headingTasks', { n: results.tasks.length })}
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>{t('comp.tasks.colTask')}</th>
                    <th>{t('comp.tasks.colProject')}</th>
                    <th>{t('comp.tasks.colOwner')}</th>
                    <th>{t('comp.tasks.colStatus')}</th>
                    <th>{t('comp.tasks.colProgress')}</th>
                    <th>{t('comp.tasks.colStart')}</th>
                    <th>{t('comp.tasks.colDue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.tasks.map((task) => (
                    <tr
                      key={`${task.projectId || 'null'}-${task.id}`}
                      className="project-row"
                      onClick={() => onTaskClick(task, task.projectId, task.projectName)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <p className="project-name">{task.title}</p>
                        <span className="project-id">{task.id}</span>
                      </td>
                      <td>
                        <span className="project-name">{task.projectName || 'N/A'}</span>
                        {task.projectId && (
                          <span className="project-id">{task.projectId}</span>
                        )}
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
            </div>
          )}

          {/* GMP Record 결과 */}
          {results.gmpRecords.length > 0 && (
            <div>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 600 }}>
                {t('comp.search.headingGmp', { n: results.gmpRecords.length })}
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>{t('comp.tasks.colTask')}</th>
                    <th>{t('comp.tasks.colKindNo')}</th>
                    <th>{t('comp.tasks.colProject')}</th>
                    <th>{t('comp.tasks.colOwner')}</th>
                    <th>{t('comp.tasks.colStatus')}</th>
                    <th>{t('comp.tasks.colProgress')}</th>
                    <th>{t('comp.tasks.colStart')}</th>
                    <th>{t('comp.tasks.colDue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.gmpRecords.map((record) => (
                    <tr
                      key={`${record.projectId || 'null'}-${record.id}`}
                      className="project-row"
                      onClick={() => onTaskClick(record, record.projectId, record.projectName)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <p className="project-name">{record.title}</p>
                        <span className="project-id">{record.id}</span>
                      </td>
                      <td>
                        <span className="project-id">{record.kind_number || 'CC-00000'}</span>
                      </td>
                      <td>
                        <span className="project-name">{record.projectName || 'N/A'}</span>
                        {record.projectId && (
                          <span className="project-id">{record.projectId}</span>
                        )}
                      </td>
                      <td>{record.owner}</td>
                      <td>
                        <StatusBadge status={record.status} />
                      </td>
                      <td>
                        <Progress 
                          value={(record as any).progress || 0} 
                          start={(record as any).start}
                          due={record.due}
                        />
                      </td>
                      <td>{(record as any).start || '-'}</td>
                      <td>{record.due}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 간트 차트 작업 결과 */}
          {ganttTasks.length > 0 && onGanttTaskClick && (
            <div>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 600 }}>
                {t('comp.search.headingGantt', { n: ganttTasks.length })}
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>{t('comp.ganttChart.colName')}</th>
                    <th>{t('comp.search.colWbs')}</th>
                    <th>{t('comp.tasks.colProject')}</th>
                    <th>{t('comp.tasks.colOwner')}</th>
                    <th>{t('comp.tasks.colStart')}</th>
                    <th>{t('comp.search.colGanttEnd')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ganttTasks.map((row) => (
                    <tr
                      key={`gantt-${row.projectId}-${row.id}`}
                      className="project-row"
                      onClick={() => onGanttTaskClick(row.projectId)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <p className="project-name">{row.name}</p>
                      </td>
                      <td><span className="project-id">{row.wbsCode || '-'}</span></td>
                      <td><span className="project-name">{row.projectName}</span></td>
                      <td>{row.assignee || '-'}</td>
                      <td>{row.startDate || '-'}</td>
                      <td>{row.finishDate || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

