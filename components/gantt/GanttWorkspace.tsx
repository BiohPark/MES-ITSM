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
  const [xmlFile, setXmlFile] = useState<File | null>(null)
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
      
      // 날짜가 변경된 경우, 모든 상위 레벨의 날짜 자동 업데이트
      if (field === 'startDate' || field === 'finishDate') {
        const current = copy[index]
        const currentLevel = current.outlineLevel || 1
        
        // 모든 상위 레벨 항목 찾기 및 업데이트 (레벨이 낮을수록 상위)
        for (let targetLevel = currentLevel - 1; targetLevel >= 1; targetLevel--) {
          // 해당 레벨의 상위 항목 찾기 (현재 항목 이전에 있는 항목)
          let parentIndex = -1
          for (let i = index - 1; i >= 0; i--) {
            if ((copy[i].outlineLevel || 1) === targetLevel) {
              parentIndex = i
              break
            }
          }
          
          if (parentIndex === -1) continue
          
          const parent = copy[parentIndex]
          
          // 상위 레벨의 모든 직접 하위 항목들 찾기
          const childItems: GanttTask[] = []
          for (let j = parentIndex + 1; j < copy.length; j++) {
            const next = copy[j]
            const nextLevel = next.outlineLevel || 1
            
            // 같은 레벨이나 더 낮은 레벨이 나오면 종료
            if (nextLevel <= targetLevel) {
              break
            }
            
            // 바로 다음 레벨인 경우만 직접 하위 항목으로 간주
            if (nextLevel === targetLevel + 1) {
              childItems.push(next)
            }
          }
          
          if (childItems.length === 0) continue
          
          // 상위 레벨의 시작일과 종료일 자동 계산
          const childStartDates = childItems
            .map(item => item.startDate)
            .filter((date): date is string => date !== null && date !== undefined)
            .map(date => new Date(date).getTime())
          
          const childFinishDates = childItems
            .map(item => item.finishDate)
            .filter((date): date is string => date !== null && date !== undefined)
            .map(date => new Date(date).getTime())

          if (childStartDates.length > 0) {
            const minStartDate = new Date(Math.min(...childStartDates))
            parent.startDate = minStartDate.toISOString().split('T')[0]
          }

          if (childFinishDates.length > 0) {
            const maxFinishDate = new Date(Math.max(...childFinishDates))
            parent.finishDate = maxFinishDate.toISOString().split('T')[0]
          }

          // duration_days도 자동 계산
          if (parent.startDate && parent.finishDate) {
            const start = new Date(parent.startDate)
            const finish = new Date(parent.finishDate)
            const diffTime = finish.getTime() - start.getTime()
            parent.durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          }
        }
      }
      
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
    const sorted = items
      .slice()
      .sort((a, b) => (a.sortOrder ?? 1) - (b.sortOrder ?? 1))
    
    // 1단계: WBS 코드 계산
    for (const t of sorted) {
      const level = Math.max(1, t.outlineLevel || 1)
      counters.length = level
      counters[level - 1] = (counters[level - 1] || 0) + 1
      const wbs = counters.slice(0, level).join('.')
      result.push({ ...t, outlineLevel: level, wbsCode: wbs })
    }

    // 2단계: 상위 레벨의 시작/종료 날짜를 하위 레벨에 따라 자동 계산
    // 하위 레벨부터 상위 레벨 순으로 계산 (역순으로 처리)
    const maxLevel = Math.max(...result.map(t => t.outlineLevel || 1))
    
    // 레벨이 높은 것부터 낮은 것 순으로 처리 (하위 레벨부터 상위 레벨로)
    for (let targetLevel = maxLevel - 1; targetLevel >= 1; targetLevel--) {
      for (let i = 0; i < result.length; i++) {
        const current = result[i]
        const currentLevel = current.outlineLevel || 1
        
        // 현재 처리할 레벨이 아니면 스킵
        if (currentLevel !== targetLevel) continue
        
        // 하위 레벨 항목들 찾기 (현재 항목 다음에 오는 더 높은 레벨의 항목들)
        const childItems: GanttTask[] = []
        for (let j = i + 1; j < result.length; j++) {
          const next = result[j]
          const nextLevel = next.outlineLevel || 1
          
          // 같은 레벨이나 더 낮은 레벨이 나오면 하위 항목 종료
          if (nextLevel <= currentLevel) {
            break
          }
          
          // 바로 다음 레벨인 경우만 직접 하위 항목으로 간주
          if (nextLevel === currentLevel + 1) {
            childItems.push(next)
          }
        }

        // 하위 항목이 있는 경우, 시작일과 종료일 자동 계산
        if (childItems.length > 0) {
          const childStartDates = childItems
            .map(item => item.startDate)
            .filter((date): date is string => date !== null && date !== undefined)
            .map(date => new Date(date).getTime())
          
          const childFinishDates = childItems
            .map(item => item.finishDate)
            .filter((date): date is string => date !== null && date !== undefined)
            .map(date => new Date(date).getTime())

          if (childStartDates.length > 0) {
            const minStartDate = new Date(Math.min(...childStartDates))
            current.startDate = minStartDate.toISOString().split('T')[0]
          }

          if (childFinishDates.length > 0) {
            const maxFinishDate = new Date(Math.max(...childFinishDates))
            current.finishDate = maxFinishDate.toISOString().split('T')[0]
          }

          // duration_days도 자동 계산
          if (current.startDate && current.finishDate) {
            const start = new Date(current.startDate)
            const finish = new Date(current.finishDate)
            const diffTime = finish.getTime() - start.getTime()
            current.durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          }
        }
      }
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

  const handleDeleteProject = async () => {
    if (!selectedProjectId) {
      alert('삭제할 프로젝트를 선택하세요.')
      return
    }

    const projectName = selectedProject?.name || `프로젝트 #${selectedProjectId}`
    if (!confirm(`"${projectName}" 프로젝트를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 프로젝트의 모든 작업도 함께 삭제됩니다.`)) {
      return
    }

    try {
      const res = await fetch(`/api/gantt/projects?id=${selectedProjectId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '프로젝트 삭제 실패')
      }
      alert('프로젝트가 삭제되었습니다.')
      setSelectedProjectId(null)
      setTasks([])
      await loadProjects()
    } catch (err: any) {
      console.error('Failed to delete gantt project', err)
      alert(err.message || '프로젝트 삭제 실패')
    }
  }

  const handleImportXml = async () => {
    if (!xmlFile) {
      alert('XML 파일을 선택하세요.')
      return
    }
    setImporting(true)
    try {
      const form = new FormData()
      form.append('file', xmlFile)
      if (projectNameInput.trim()) {
        form.append('projectName', projectNameInput.trim())
      }

      const res = await fetch('/api/gantt/import', {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'XML Import 실패')
      }
      const data = await res.json()
      alert('MS Project XML Import가 완료되었습니다.')
      setXmlFile(null)
      setProjectNameInput('')
      await loadProjects()
      if (data.projectId) {
        setSelectedProjectId(data.projectId)
      }
    } catch (err: any) {
      console.error('Failed to import xml', err)
      alert(err.message || 'XML Import 실패')
    } finally {
      setImporting(false)
    }
  }

  const handleExportXml = async () => {
    if (!selectedProjectId) {
      alert('먼저 Gantt 프로젝트를 선택하세요.')
      return
    }
    try {
      const res = await fetch(`/api/gantt/export/${selectedProjectId}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'XML Export 실패')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gantt_project_${selectedProjectId}.xml`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('Failed to export xml', err)
      alert(err.message || 'XML Export 실패')
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
            {selectedProjectId && (
              <button
                type="button"
                className="servicenow-button servicenow-button--danger"
                onClick={handleDeleteProject}
                style={{ marginLeft: '0.5rem' }}
              >
                삭제
              </button>
            )}
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

        {/* Row 2: XML Import / Export */}
        <div className="servicenow-toolbar__section">
          <h3 className="servicenow-toolbar__title">
            MS Project XML Import / Export
          </h3>
          <div className="servicenow-toolbar__row">
            <input
              type="file"
              accept=".xml,application/xml,text/xml"
              onChange={(e) => setXmlFile(e.target.files?.[0] ?? null)}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="servicenow-button servicenow-button--primary"
              onClick={handleImportXml}
              disabled={importing}
            >
              XML Import
            </button>
            <button
              type="button"
              className="servicenow-button servicenow-button--secondary"
              onClick={handleExportXml}
            >
              XML Export
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
            Microsoft Project XML 형식 파일을 업로드하면 새 Gantt 프로젝트로 Import 됩니다.
            Export된 XML 파일은 Microsoft Project에서 열 수 있습니다.
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


