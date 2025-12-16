'use client'

import { useEffect, useMemo, useState } from 'react'
import { GanttTasksChart } from './GanttTasksChart'

interface GanttProject {
  id: number
  name: string
  description?: string | null
}

interface GanttTask {
  id?: number
  projectId: number
  wbsCode?: string | null
  outlineLevel: number
  sortOrder: number
  name: string
  startDate?: string | null
  finishDate?: string | null
  durationDays?: number | null
  predecessors?: string | null
  assignee?: string | null
  isMilestone?: boolean
}

type SubTabKey = 'wbs' | 'chart'

export function GanttWorkspace() {
  const [projects, setProjects] = useState<GanttProject[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null
  )

  const [tasks, setTasks] = useState<GanttTask[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [tasksError, setTasksError] = useState<string | null>(null)
  const [projectNameInput, setProjectNameInput] = useState('')
  const [importing, setImporting] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [activeSubTab, setActiveSubTab] = useState<SubTabKey>('wbs')

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  )

  const loadProjects = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/gantt/projects')
      if (!res.ok) {
        throw new Error('Gantt 프로젝트 목록을 불러오지 못했습니다.')
      }
      const data = await res.json()
      setProjects(data.projects || [])
      if (!selectedProjectId && data.projects?.length > 0) {
        setSelectedProjectId(data.projects[0].id)
      }
    } catch (err: any) {
      console.error('Failed to load Gantt projects', err)
      setError(err.message || 'Gantt 프로젝트 로딩 실패')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadTasks = async (projectId: number) => {
    setTasksLoading(true)
    setTasksError(null)
    try {
      const res = await fetch(`/api/gantt/tasks/${projectId}`)
      if (!res.ok) {
        throw new Error('태스크를 불러오지 못했습니다.')
      }
      const data = await res.json()
      setTasks(
        (data.tasks || []).map((t: any) => ({
          ...t,
          projectId,
        }))
      )
    } catch (err: any) {
      console.error('Failed to load gantt tasks', err)
      setTasksError(err.message || '태스크 로딩 실패')
    } finally {
      setTasksLoading(false)
    }
  }

  useEffect(() => {
    if (selectedProjectId) {
      loadTasks(selectedProjectId)
    } else {
      setTasks([])
    }
  }, [selectedProjectId])

  const handleAddRow = () => {
    if (!selectedProjectId) {
      alert('먼저 Gantt 프로젝트를 선택하거나 생성하세요.')
      return
    }
    const nextSort =
      tasks.length === 0
        ? 1
        : Math.max(...tasks.map((t) => t.sortOrder ?? 1)) + 1
    setTasks((prev) => [
      ...prev,
      {
        projectId: selectedProjectId,
        outlineLevel: 1,
        sortOrder: nextSort,
        name: '',
        durationDays: 1,
        predecessors: '',
        assignee: '',
        isMilestone: false,
      },
    ])
  }

  const handleChangeTask = (
    index: number,
    field: keyof GanttTask,
    value: any
  ) => {
    setTasks((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const handleDeleteRow = (index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index))
  }

  const handleIndent = (index: number, direction: 1 | -1) => {
    setTasks((prev) => {
      const copy = [...prev]
      const t = { ...copy[index] }
      t.outlineLevel = Math.max(1, (t.outlineLevel || 1) + direction)
      copy[index] = t
      return copy
    })
  }

  const recomputeWbsCodes = (items: GanttTask[]): GanttTask[] => {
    const counters: number[] = []
    const result: GanttTask[] = []
    for (const t of items
      .slice()
      .sort((a, b) => (a.sortOrder ?? 1) - (b.sortOrder ?? 1))) {
      const level = Math.max(1, t.outlineLevel || 1)
      counters.length = level
      counters[level - 1] = (counters[level - 1] || 0) + 1
      const wbs = counters.slice(0, level).join('.')
      result.push({ ...t, outlineLevel: level, wbsCode: wbs })
    }
    return result
  }

  const handleSaveTasks = async () => {
    if (!selectedProjectId) {
      alert('먼저 Gantt 프로젝트를 선택하세요.')
      return
    }
    const normalized = recomputeWbsCodes(tasks)
    setTasks(normalized)
    setTasksLoading(true)
    try {
      const res = await fetch(`/api/gantt/tasks/${selectedProjectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tasks: normalized }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '태스크 저장 실패')
      }
      alert('Gantt 태스크를 저장했습니다.')
      await loadTasks(selectedProjectId)
    } catch (err: any) {
      console.error('Failed to save gantt tasks', err)
      alert(err.message || '태스크 저장 실패')
    } finally {
      setTasksLoading(false)
    }
  }

  const handleCreateProject = async () => {
    const name = projectNameInput.trim()
    if (!name) {
      alert('프로젝트 이름을 입력하세요.')
      return
    }
    try {
      const res = await fetch('/api/gantt/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '프로젝트 생성 실패')
      }
      const data = await res.json()
      setProjectNameInput('')
      await loadProjects()
      setSelectedProjectId(data.id)
      setTasks([])
    } catch (err: any) {
      console.error('Failed to create gantt project', err)
      alert(err.message || '프로젝트 생성 실패')
    }
  }

  const handleImportCsv = async () => {
    if (!csvFile) {
      alert('CSV 파일을 선택하세요.')
      return
    }
    setImporting(true)
    try {
      const form = new FormData()
      form.append('file', csvFile)
      if (projectNameInput.trim()) {
        form.append('projectName', projectNameInput.trim())
      }

      const res = await fetch('/api/gantt/import', {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'CSV Import 실패')
      }
      const data = await res.json()
      alert('CSV Import가 완료되었습니다.')
      setCsvFile(null)
      setProjectNameInput('')
      await loadProjects()
      if (data.projectId) {
        setSelectedProjectId(data.projectId)
      }
    } catch (err: any) {
      console.error('Failed to import csv', err)
      alert(err.message || 'CSV Import 실패')
    } finally {
      setImporting(false)
    }
  }

  const handleExportCsv = async () => {
    if (!selectedProjectId) {
      alert('먼저 Gantt 프로젝트를 선택하세요.')
      return
    }
    try {
      const res = await fetch(`/api/gantt/export/${selectedProjectId}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'CSV Export 실패')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gantt_project_${selectedProjectId}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('Failed to export csv', err)
      alert(err.message || 'CSV Export 실패')
    }
  }

  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>Gantt 프로젝트 및 WBS 편집</h2>
      </div>

      {/* 상단 툴바 영역 - 2개의 Row로 수평 배치 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
        {/* Row 1: Gantt 프로젝트 선택/생성 */}
        <div className="servicenow-toolbar__section">
          <h3 className="servicenow-toolbar__title">Gantt 프로젝트</h3>
          <div className="servicenow-toolbar__row">
            <select
              value={selectedProjectId ?? ''}
              onChange={(e) =>
                setSelectedProjectId(
                  e.target.value ? Number(e.target.value) : null
                )
              }
              className="servicenow-form-select"
              style={{ flex: 1 }}
            >
              <option value="">프로젝트 선택...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (#{p.id})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="servicenow-button servicenow-button--secondary"
              onClick={loadProjects}
            >
              새로고침
            </button>
          </div>
          <div className="servicenow-toolbar__row" style={{ marginTop: '0.5rem' }}>
            <input
              type="text"
              placeholder="새 프로젝트 이름"
              value={projectNameInput}
              onChange={(e) => setProjectNameInput(e.target.value)}
              className="servicenow-form-input"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="servicenow-button servicenow-button--primary"
              onClick={handleCreateProject}
            >
              새로 만들기
            </button>
          </div>
        </div>

        {/* Row 2: CSV Import / Export */}
        <div className="servicenow-toolbar__section">
          <h3 className="servicenow-toolbar__title">
            MS Project CSV Import / Export
          </h3>
          <div className="servicenow-toolbar__row">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="servicenow-button servicenow-button--primary"
              onClick={handleImportCsv}
              disabled={importing}
            >
              CSV Import
            </button>
            <button
              type="button"
              className="servicenow-button servicenow-button--secondary"
              onClick={handleExportCsv}
            >
              CSV Export
            </button>
          </div>
          <p
            style={{
              fontSize: '0.75rem',
              color: '#666',
              marginTop: '0.5rem',
              marginBottom: 0,
            }}
          >
            MS Project에서 CSV로 내보낸 파일(열: Task Name, Start, Finish,
            Duration, Predecessors, Resource Names 등)을 업로드하면 새 Gantt
            프로젝트로 Import 됩니다.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="placeholder">
          <p>Gantt 프로젝트를 불러오는 중...</p>
        </div>
      ) : error ? (
        <div className="placeholder">
          <p>에러: {error}</p>
        </div>
      ) : !selectedProject ? (
        <div className="placeholder">
          <p>왼쪽에서 Gantt 프로젝트를 선택하거나 새로 생성해주세요.</p>
        </div>
      ) : (
        <>
          {/* 서브 탭 (WBS / 간트 차트) */}
          <div
            style={{
              borderBottom: '1px solid #EBECEE',
              marginBottom: '1rem',
              display: 'flex',
              gap: '1rem',
            }}
          >
            <button
              type="button"
              className="servicenow-button"
              style={{
                border: 'none',
                borderBottom:
                  activeSubTab === 'wbs'
                    ? '2px solid #2A84D5'
                    : '2px solid transparent',
                borderRadius: 0,
                background: 'transparent',
                color: activeSubTab === 'wbs' ? '#2A84D5' : '#666666',
                padding: '0.5rem 0.75rem',
                marginBottom: '-1px',
              }}
              onClick={() => setActiveSubTab('wbs')}
            >
              WBS
            </button>
            <button
              type="button"
              className="servicenow-button"
              style={{
                border: 'none',
                borderBottom:
                  activeSubTab === 'chart'
                    ? '2px solid #2A84D5'
                    : '2px solid transparent',
                borderRadius: 0,
                background: 'transparent',
                color: activeSubTab === 'chart' ? '#2A84D5' : '#666666',
                padding: '0.5rem 0.75rem',
                marginBottom: '-1px',
              }}
              onClick={() => setActiveSubTab('chart')}
            >
              간트 차트
            </button>
          </div>

          {activeSubTab === 'wbs' ? (
            <>
              {/* WBS 편집 영역 */}
              <div
                style={{
                  marginBottom: '1rem',
                  padding: '0.75rem 1rem',
                  backgroundColor: '#F4F6F8',
                  borderRadius: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid #EBECEE',
                }}
              >
                <div style={{ fontSize: '0.85rem', color: '#333' }}>
                  <strong>{selectedProject.name}</strong> (#{selectedProject.id})
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="servicenow-button servicenow-button--secondary"
                    onClick={handleAddRow}
                  >
                    행 추가
                  </button>
                  <button
                    type="button"
                    className="servicenow-button servicenow-button--primary"
                    onClick={handleSaveTasks}
                    disabled={tasksLoading}
                  >
                    WBS 저장
                  </button>
                </div>
              </div>

              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
              <div
                style={{
                  display: 'flex',
                  backgroundColor: '#f1f5f9',
                  borderBottom: '1px solid #e2e8f0',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                <div style={{ width: 40, padding: '0.3rem', textAlign: 'center' }}>
                  #
                </div>
                <div style={{ width: 80, padding: '0.3rem', textAlign: 'center' }}>
                  WBS
                </div>
                <div style={{ width: 60, padding: '0.3rem', textAlign: 'center' }}>
                  레벨
                </div>
                <div style={{ flex: 1, padding: '0.3rem' }}>작업명</div>
                <div style={{ width: 90, padding: '0.3rem' }}>시작</div>
                <div style={{ width: 90, padding: '0.3rem' }}>종료</div>
                <div style={{ width: 70, padding: '0.3rem', textAlign: 'center' }}>
                  기간(일)
                </div>
                <div style={{ width: 120, padding: '0.3rem' }}>선행 작업</div>
                <div style={{ width: 120, padding: '0.3rem' }}>담당자</div>
                <div style={{ width: 90, padding: '0.3rem', textAlign: 'center' }}>
                  조정
                </div>
                <div style={{ width: 60, padding: '0.3rem', textAlign: 'center' }}>
                  삭제
                </div>
              </div>
              <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                {tasks.map((t, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      borderBottom: '1px solid #e5e7eb',
                      fontSize: '0.8rem',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        padding: '0.25rem',
                        textAlign: 'center',
                        color: '#64748b',
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div
                      style={{
                        width: 80,
                        padding: '0.25rem',
                        fontFamily: 'monospace',
                      }}
                    >
                      {t.wbsCode || '-'}
                    </div>
                    <div style={{ width: 60, padding: '0.25rem' }}>
                      <input
                        type="number"
                        min={1}
                        value={t.outlineLevel || 1}
                        onChange={(e) =>
                          handleChangeTask(
                            idx,
                            'outlineLevel',
                            Math.max(1, Number(e.target.value) || 1)
                          )
                        }
                        style={{
                          width: '100%',
                          padding: '0.15rem',
                          border: '1px solid #d1d5db',
                          borderRadius: 3,
                          fontSize: '0.8rem',
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, padding: '0.25rem' }}>
                      <input
                        type="text"
                        value={t.name}
                        onChange={(e) =>
                          handleChangeTask(idx, 'name', e.target.value)
                        }
                        placeholder="작업명"
                        style={{
                          width: '100%',
                          padding: '0.15rem 0.3rem',
                          border: '1px solid #d1d5db',
                          borderRadius: 3,
                          fontSize: '0.8rem',
                        }}
                      />
                    </div>
                    <div style={{ width: 90, padding: '0.25rem' }}>
                      <input
                        type="date"
                        value={t.startDate || ''}
                        onChange={(e) =>
                          handleChangeTask(idx, 'startDate', e.target.value || null)
                        }
                        style={{
                          width: '100%',
                          padding: '0.15rem',
                          border: '1px solid #d1d5db',
                          borderRadius: 3,
                          fontSize: '0.78rem',
                        }}
                      />
                    </div>
                    <div style={{ width: 90, padding: '0.25rem' }}>
                      <input
                        type="date"
                        value={t.finishDate || ''}
                        onChange={(e) =>
                          handleChangeTask(idx, 'finishDate', e.target.value || null)
                        }
                        style={{
                          width: '100%',
                          padding: '0.15rem',
                          border: '1px solid #d1d5db',
                          borderRadius: 3,
                          fontSize: '0.78rem',
                        }}
                      />
                    </div>
                    <div style={{ width: 70, padding: '0.25rem' }}>
                      <input
                        type="number"
                        min={0}
                        value={t.durationDays ?? ''}
                        onChange={(e) =>
                          handleChangeTask(
                            idx,
                            'durationDays',
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                        style={{
                          width: '100%',
                          padding: '0.15rem',
                          border: '1px solid #d1d5db',
                          borderRadius: 3,
                          fontSize: '0.78rem',
                          textAlign: 'right',
                        }}
                      />
                    </div>
                    <div style={{ width: 120, padding: '0.25rem' }}>
                      <input
                        type="text"
                        value={t.predecessors || ''}
                        onChange={(e) =>
                          handleChangeTask(idx, 'predecessors', e.target.value)
                        }
                        placeholder="예: 2FS+5"
                        style={{
                          width: '100%',
                          padding: '0.15rem 0.3rem',
                          border: '1px solid #d1d5db',
                          borderRadius: 3,
                          fontSize: '0.78rem',
                        }}
                      />
                    </div>
                    <div style={{ width: 120, padding: '0.25rem' }}>
                      <input
                        type="text"
                        value={t.assignee || ''}
                        onChange={(e) =>
                          handleChangeTask(idx, 'assignee', e.target.value)
                        }
                        placeholder="담당자"
                        style={{
                          width: '100%',
                          padding: '0.15rem 0.3rem',
                          border: '1px solid #d1d5db',
                          borderRadius: 3,
                          fontSize: '0.78rem',
                        }}
                      />
                    </div>
                    <div
                      style={{
                        width: 90,
                        padding: '0.25rem',
                        textAlign: 'center',
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                    >
                      <button
                        type="button"
                        className="servicenow-button servicenow-button--secondary servicenow-button--sm"
                        onClick={() => handleIndent(idx, -1)}
                      >
                        ◁
                      </button>
                      <button
                        type="button"
                        className="servicenow-button servicenow-button--secondary servicenow-button--sm"
                        onClick={() => handleIndent(idx, 1)}
                      >
                        ▷
                      </button>
                    </div>
                    <div
                      style={{
                        width: 60,
                        padding: '0.25rem',
                        textAlign: 'center',
                      }}
                    >
                      <button
                        type="button"
                        className="servicenow-button servicenow-button--danger servicenow-button--sm"
                        onClick={() => handleDeleteRow(idx)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <div
                    style={{
                      padding: '2rem',
                      textAlign: 'center',
                      color: '#94a3b8',
                    }}
                  >
                    아직 WBS 행이 없습니다. 상단의 &quot;행 추가&quot; 버튼을 눌러
                    작업을 추가하세요.
                  </div>
                )}
              </div>
              </div>
            </>
          ) : (
            // 간트 차트 전용 뷰
            <div>
              {tasksLoading ? (
                <div className="placeholder">
                  <p>일정을 계산하는 중...</p>
                </div>
              ) : tasksError ? (
                <div className="placeholder">
                  <p>에러: {tasksError}</p>
                </div>
              ) : (
                <GanttTasksChart tasks={tasks} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}


