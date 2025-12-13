'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Project, ProjectChild } from '@/types/project'
import { StatusBadge } from '../common/StatusBadge'
import { Progress } from '../common/Progress'
import { SearchIcon } from '../common/Icons'

interface SearchResult {
  projects: Array<Project & { type: 'project' }>
  tasks: Array<ProjectChild & { type: 'task'; projectId: string | null; projectName: string }>
  gmpRecords: Array<ProjectChild & { type: 'gmp-record'; projectId: string | null; projectName: string; kind_number?: string }>
}

interface SearchViewProps {
  onProjectClick: (project: Project) => void
  onTaskClick: (task: ProjectChild, projectId: string | null, projectName: string) => void
}

export function SearchView({ onProjectClick, onTaskClick }: SearchViewProps) {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<SearchResult>({
    projects: [],
    tasks: [],
    gmpRecords: [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = useCallback(async () => {
    if (!keyword.trim()) {
      setResults({ projects: [], tasks: [], gmpRecords: [] })
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/search?keyword=${encodeURIComponent(keyword.trim())}`)
      if (!response.ok) {
        throw new Error('검색에 실패했습니다.')
      }
      const data = await response.json()
      setResults(data)
    } catch (err) {
      console.error('Search error:', err)
      setError(err instanceof Error ? err.message : '검색 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [keyword])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (keyword.trim()) {
        handleSearch()
      } else {
        setResults({ projects: [], tasks: [], gmpRecords: [] })
      }
    }, 300) // 디바운스: 300ms 후 검색

    return () => clearTimeout(timer)
  }, [keyword, handleSearch])

  const totalResults = results.projects.length + results.tasks.length + results.gmpRecords.length

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
              placeholder="키워드를 입력하세요 (프로젝트, 일감, GMP Record 검색)"
              className="form-input"
              style={{ flex: 1, padding: '0.75rem', fontSize: '1rem' }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch()
                }
              }}
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="primary-button"
              style={{ padding: '0.75rem 1.5rem' }}
            >
              {loading ? '검색 중...' : '검색'}
            </button>
          </div>
          {keyword.trim() && (
            <div style={{ marginTop: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
              검색 결과: 총 {totalResults}건
              {results.projects.length > 0 && ` (프로젝트: ${results.projects.length}건`}
              {results.tasks.length > 0 && `, 일감: ${results.tasks.length}건`}
              {results.gmpRecords.length > 0 && `, GMP Record: ${results.gmpRecords.length}건`}
              {totalResults > 0 && ')'}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="placeholder">
          <p style={{ color: '#e74c3c' }}>오류: {error}</p>
        </div>
      )}

      {!keyword.trim() && (
        <div className="placeholder">
          <p>검색할 키워드를 입력하세요.</p>
        </div>
      )}

      {keyword.trim() && !loading && totalResults === 0 && (
        <div className="placeholder">
          <p>&quot;{keyword}&quot;에 대한 검색 결과가 없습니다.</p>
        </div>
      )}

      {(results.projects.length > 0 || results.tasks.length > 0 || results.gmpRecords.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* 프로젝트 결과 */}
          {results.projects.length > 0 && (
            <div>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 600 }}>
                프로젝트 ({results.projects.length}건)
              </h3>
              <table>
                <thead>
                  <tr>
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
                      <td>{project.members}명</td>
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
                일감 ({results.tasks.length}건)
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>일감</th>
                    <th>프로젝트</th>
                    <th>담당자</th>
                    <th>상태</th>
                    <th>진척도(계획/실적)</th>
                    <th>시작일</th>
                    <th>마감일</th>
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
                GMP Record ({results.gmpRecords.length}건)
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>일감</th>
                    <th>종류-번호</th>
                    <th>프로젝트</th>
                    <th>담당자</th>
                    <th>상태</th>
                    <th>진척도(계획/실적)</th>
                    <th>시작일</th>
                    <th>마감일</th>
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
        </div>
      )}
    </div>
  )
}

