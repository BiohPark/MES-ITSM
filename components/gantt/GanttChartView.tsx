'use client'

import { useMemo, useState, useEffect } from 'react'
import type { Project } from '@/types/project'

interface TaskSchedule {
  taskId: string
  taskIndex: number
  taskName: string
  durationDays: number
  startDate: string | null
  es: number
  ef: number
  ls: number
  lf: number
  totalFloat: number
  freeFloat: number
  isCritical: boolean
}

interface Predecessor {
  predecessor_id: number
  taskId: string
  predecessorTaskId: string
  dependencyType: string
  lagDays: number
  predecessorTaskIndex: number
  taskIndex?: number
}

export function GanttChartView({
  projects,
  loading,
  error,
  onRefresh,
}: {
  projects: Project[]
  loading: boolean
  error: string | null
  onRefresh: () => void | Promise<void>
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [schedules, setSchedules] = useState<TaskSchedule[]>([])
  const [predecessors, setPredecessors] = useState<Map<string, Predecessor[]>>(new Map())
  const [predecessorStrings, setPredecessorStrings] = useState<Map<string, string>>(new Map())
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => {
    const today = new Date()
    const start = new Date(today)
    start.setMonth(start.getMonth() - 1)
    const end = new Date(today)
    end.setMonth(end.getMonth() + 3)
    return { start, end }
  })

  // 프로젝트 선택 시 일정 데이터 로드
  const loadSchedule = async (projectId: string) => {
    setScheduleLoading(true)
    try {
      const response = await fetch(`/api/project/schedule/${projectId}`)
      if (!response.ok) {
        throw new Error('Failed to load schedule')
      }

      const data = await response.json()
      setSchedules(data.schedules || [])

      // 종속성 데이터 로드
      const predResponse = await fetch(`/api/project/predecessors?projectId=${projectId}`)
      if (predResponse.ok) {
        const predData = await predResponse.json()
        const predMap = new Map<string, Predecessor[]>()
        const predStringMap = new Map<string, string>()

        const predsByTask = new Map<string, Predecessor[]>()
        predData.predecessors?.forEach((pred: Predecessor) => {
          if (!predsByTask.has(pred.taskId)) {
            predsByTask.set(pred.taskId, [])
          }
          predsByTask.get(pred.taskId)!.push(pred)
        })

        predsByTask.forEach((preds, taskId) => {
          predMap.set(taskId, preds)
          const predString = preds
            .map(p => {
              const lagStr = p.lagDays === 0 ? '' : (p.lagDays > 0 ? `+${p.lagDays}` : `${p.lagDays}`)
              return `${p.predecessorTaskIndex}${p.dependencyType}${lagStr}`
            })
            .join(', ')
          predStringMap.set(taskId, predString)
        })

        setPredecessors(predMap)
        setPredecessorStrings(predStringMap)
      }

      // 날짜 범위 업데이트
      if (data.schedules && data.schedules.length > 0) {
        const allDates = data.schedules
          .map((s: TaskSchedule) => s.startDate ? new Date(s.startDate) : null)
          .filter(Boolean) as Date[]
        
        if (allDates.length > 0) {
          const minDate = new Date(Math.min(...allDates.map(d => d.getTime())))
          const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())))
          minDate.setDate(minDate.getDate() - 7)
          maxDate.setDate(maxDate.getDate() + 30)
          setDateRange({ start: minDate, end: maxDate })
        }
      }
    } catch (err: any) {
      console.error('Error loading schedule:', err)
    } finally {
      setScheduleLoading(false)
    }
  }

  useEffect(() => {
    if (selectedProjectId) {
      loadSchedule(selectedProjectId)
    } else {
      setSchedules([])
      setPredecessors(new Map())
      setPredecessorStrings(new Map())
    }
  }, [selectedProjectId])

  // 선택된 프로젝트
  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || null
  }, [projects, selectedProjectId])

  // 작업 목록 (선택된 프로젝트의 children)
  const tasks = useMemo(() => {
    if (!selectedProject) return []
    return (selectedProject.children || []).filter(child => !(child.id as string).startsWith('GMP-'))
  }, [selectedProject])

  const days = useMemo(() => {
    const daysArray: Date[] = []
    const current = new Date(dateRange.start)
    while (current <= dateRange.end) {
      daysArray.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    return daysArray
  }, [dateRange])

  const getItemPosition = (schedule: TaskSchedule) => {
    if (!schedule.startDate) return null

    const itemStart = new Date(schedule.startDate).getTime()
    const itemEnd = itemStart + (schedule.durationDays * 24 * 60 * 60 * 1000)
    const rangeStart = dateRange.start.getTime()
    const rangeEnd = dateRange.end.getTime()

    if (itemEnd < rangeStart || itemStart > rangeEnd) {
      return null
    }

    const startOffset = Math.max(0, itemStart - rangeStart)
    const endOffset = Math.min(rangeEnd - rangeStart, itemEnd - rangeStart)
    const left = (startOffset / (rangeEnd - rangeStart)) * 100
    const width = ((endOffset - startOffset) / (rangeEnd - rangeStart)) * 100

    return { left, width, start: itemStart, end: itemEnd }
  }

  // 종속성 문자열 업데이트
  const handlePredecessorChange = (taskId: string, value: string) => {
    setPredecessorStrings(prev => {
      const newMap = new Map(prev)
      newMap.set(taskId, value)
      return newMap
    })
  }

  // 종속성 저장
  const handleSavePredecessors = async (taskId: string) => {
    if (!selectedProjectId) return

    const predString = predecessorStrings.get(taskId) || ''

    setScheduleLoading(true)
    try {
      const response = await fetch('/api/project/predecessors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId,
          projectId: selectedProjectId,
          predecessorString: predString,
        }),
      })

      if (!response.ok) {
        let errorMessage = 'Failed to save predecessors'
        let errorDetails = ''
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
          errorDetails = errorData.details || ''
        } catch (e) {
          // JSON 파싱 실패 시 상태 텍스트 사용
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        const fullErrorMessage = errorDetails ? `${errorMessage}\n\n상세: ${errorDetails}` : errorMessage
        throw new Error(fullErrorMessage)
      }

      setEditingTaskId(null)
      await loadSchedule(selectedProjectId)
      if (onRefresh) {
        await onRefresh()
      }
    } catch (err: any) {
      console.error('Error saving predecessors:', err)
      console.error('Error details:', {
        taskId,
        projectId: selectedProjectId,
        predecessorString: predString,
        error: err,
        stack: err.stack,
      })
      const errorMessage = err.message || err.toString() || 'Failed to save predecessors'
      alert(`선행 작업 저장 실패\n\n${errorMessage}\n\n입력값: ${predString || '(없음)'}\n\n종속성 형식: IndexType[±Lag]\n예: 2FS+5, 3SS-1`)
    } finally {
      setScheduleLoading(false)
    }
  }

  // 종속성 화살표 위치 계산
  const getDependencyArrow = (pred: Predecessor, taskSchedule: TaskSchedule) => {
    const predSchedule = schedules.find(s => s.taskId === pred.predecessorTaskId)
    if (!predSchedule || !predSchedule.startDate || !taskSchedule.startDate) return null

    const predPos = getItemPosition(predSchedule)
    const taskPos = getItemPosition(taskSchedule)
    if (!predPos || !taskPos) return null

    let fromX = 0
    let fromY = 0
    let toX = 0
    let toY = 0

    switch (pred.dependencyType) {
      case 'FS': // Finish-to-Start
        fromX = predPos.left + predPos.width
        toX = taskPos.left
        break
      case 'SS': // Start-to-Start
        fromX = predPos.left
        toX = taskPos.left
        break
      case 'FF': // Finish-to-Finish
        fromX = predPos.left + predPos.width
        toX = taskPos.left + taskPos.width
        break
      case 'SF': // Start-to-Finish
        fromX = predPos.left
        toX = taskPos.left + taskPos.width
        break
    }

    // Lag 조정
    const lagMs = pred.lagDays * 24 * 60 * 60 * 1000
    const lagPercent = (lagMs / (dateRange.end.getTime() - dateRange.start.getTime())) * 100
    toX += lagPercent

    return { fromX, toX, fromY, toY }
  }

  if (loading) {
    return (
      <div className="table-wrapper">
        <div className="placeholder">
          <p>데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="table-wrapper">
        <div className="placeholder">
          <p>에러 발생: {error}</p>
          <button onClick={onRefresh} className="refresh-button">
            새로고침
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>Gantt Chart & 일정 관리</h2>
        <div className="table-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            value={selectedProjectId || ''}
            onChange={(e) => setSelectedProjectId(e.target.value || null)}
            style={{
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              background: 'white',
              cursor: 'pointer',
            }}
          >
            <option value="">프로젝트 선택...</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} ({project.id})
              </option>
            ))}
          </select>
          <button onClick={onRefresh} className="refresh-button">
            새로고침
          </button>
        </div>
      </div>

      {!selectedProjectId ? (
        <div className="placeholder">
          <p>일정을 보려면 프로젝트를 선택하세요.</p>
        </div>
      ) : scheduleLoading && schedules.length === 0 ? (
        <div className="placeholder">
          <p>일정을 불러오는 중...</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#F4F6F8', borderRadius: '4px' }}>
            <h3 style={{ marginTop: 0, fontSize: '0.875rem', fontWeight: 600, color: '#333' }}>사용 방법</h3>
            <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', fontSize: '0.875rem', color: '#666' }}>
              <li>종속성 형식: <code>IndexType[±Lag]</code> (예: <code>2FS+5</code>, <code>3SS-1</code>)</li>
              <li>타입: FS (Finish-to-Start), SS (Start-to-Start), FF (Finish-to-Finish), SF (Start-to-Finish)</li>
              <li>여러 종속성은 쉼표로 구분 (예: <code>2FS+5, 3SS-1</code>)</li>
              <li>빨간색 작업은 Critical Path (주요 경로)입니다</li>
            </ul>
          </div>

          <div style={{ overflowX: 'auto', marginTop: '1.5rem' }}>
            <div style={{ minWidth: '100%', position: 'relative' }}>
              {/* 헤더 */}
              <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '1rem' }}>
                <div style={{ width: '600px', padding: '0.75rem', fontWeight: 600, borderRight: '1px solid #e2e8f0', display: 'flex', gap: '1rem', fontSize: '0.8125rem' }}>
                  <div style={{ width: '50px', textAlign: 'center' }}>Index</div>
                  <div style={{ flex: 1 }}>작업명</div>
                  <div style={{ width: '180px' }}>선행 작업</div>
                  <div style={{ width: '60px', textAlign: 'center' }}>기간</div>
                  <div style={{ width: '80px', textAlign: 'center' }}>Float</div>
                  <div style={{ width: '40px', textAlign: 'center' }}>CP</div>
                </div>
                <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
                  {days.map((day, idx) => {
                    if (idx % 7 === 0 || idx === 0) {
                      return (
                        <div
                          key={day.getTime()}
                          style={{
                            minWidth: `${100 / Math.ceil(days.length / 7)}%`,
                            padding: '0.75rem 0.5rem',
                            textAlign: 'center',
                            fontSize: '0.85rem',
                            borderRight: '1px solid #e2e8f0',
                          }}
                        >
                          {day.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        </div>
                      )
                    }
                    return null
                  })}
                </div>
              </div>

              {/* 작업 행 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {tasks.map((task, taskIdx) => {
                  const schedule = schedules.find(s => s.taskId === task.id)
                  const predString = predecessorStrings.get(task.id) || ''
                  const isEditing = editingTaskId === task.id
                  const taskIndex = (task as any).task_index || taskIdx + 1
                  const position = schedule ? getItemPosition(schedule) : null

                  return (
                    <div key={task.id} style={{ display: 'flex', minHeight: '50px', position: 'relative' }}>
                      {/* 왼쪽 정보 영역 */}
                      <div
                        style={{
                          width: '600px',
                          padding: '0.5rem',
                          borderRight: '1px solid #e2e8f0',
                          display: 'flex',
                          gap: '1rem',
                          alignItems: 'center',
                          fontSize: '0.875rem',
                          backgroundColor: schedule?.isCritical ? '#ffebee' : 'transparent',
                        }}
                      >
                        <div style={{ width: '50px', textAlign: 'center', fontWeight: 600, color: schedule?.isCritical ? '#c62828' : '#333' }}>
                          {taskIndex}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {task.title}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {task.id}
                          </div>
                        </div>
                        <div style={{ width: '180px' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                              <input
                                type="text"
                                value={predString}
                                onChange={(e) => handlePredecessorChange(task.id, e.target.value)}
                                placeholder="2FS+5"
                                style={{
                                  flex: 1,
                                  padding: '0.25rem 0.375rem',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSavePredecessors(task.id)
                                  } else if (e.key === 'Escape') {
                                    setEditingTaskId(null)
                                    loadSchedule(selectedProjectId!)
                                  }
                                }}
                                autoFocus
                              />
                              <button
                                onClick={() => handleSavePredecessors(task.id)}
                                className="primary-button"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => {
                                  setEditingTaskId(null)
                                  loadSchedule(selectedProjectId!)
                                }}
                                className="refresh-button"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.75rem', color: predString ? '#333' : '#999', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {predString || '(없음)'}
                              </span>
                              <button
                                onClick={() => setEditingTaskId(task.id)}
                                className="refresh-button"
                                style={{ padding: '0.125rem 0.375rem', fontSize: '0.7rem' }}
                              >
                                편집
                              </button>
                            </div>
                          )}
                        </div>
                        <div style={{ width: '60px', textAlign: 'center', fontSize: '0.75rem' }}>
                          {schedule ? `${schedule.durationDays}일` : '-'}
                        </div>
                        <div style={{ width: '80px', textAlign: 'center', fontSize: '0.75rem', color: schedule?.totalFloat === 0 ? '#c62828' : '#333' }}>
                          {schedule ? `${schedule.totalFloat}일` : '-'}
                        </div>
                        <div style={{ width: '40px', textAlign: 'center' }}>
                          {schedule?.isCritical ? (
                            <span style={{ color: '#c62828', fontWeight: 600 }}>●</span>
                          ) : (
                            '-'
                          )}
                        </div>
                      </div>

                      {/* 오른쪽 차트 영역 */}
                      <div style={{ flex: 1, position: 'relative', borderRight: '1px solid #e2e8f0', minHeight: '50px' }}>
                        {position && schedule && (
                          <>
                            {/* 작업 바 */}
                            <div
                              style={{
                                position: 'absolute',
                                left: `${position.left}%`,
                                width: `${position.width}%`,
                                height: '24px',
                                backgroundColor: schedule.isCritical ? '#c62828' : '#10b981',
                                borderRadius: '4px',
                                marginTop: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0 0.5rem',
                                color: 'white',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                zIndex: 2,
                              }}
                              title={`${schedule.taskName} (${schedule.startDate} ~ ${new Date(new Date(schedule.startDate || '').getTime() + schedule.durationDays * 24 * 60 * 60 * 1000).toLocaleDateString('ko-KR')})`}
                            >
                              {position.width > 5 && schedule.taskName}
                            </div>

                            {/* 종속성 화살표 */}
                            {predecessors.get(task.id)?.map((pred) => {
                              const arrow = getDependencyArrow(pred, schedule)
                              if (!arrow) return null

                              const taskRowIndex = tasks.findIndex(t => t.id === task.id)
                              const predRowIndex = tasks.findIndex(t => t.id === pred.predecessorTaskId)
                              if (predRowIndex === -1) return null

                              const fromY = predRowIndex * 50 + 25
                              const toY = taskRowIndex * 50 + 25

                              // 화살표 그리기
                              const dx = arrow.toX - arrow.fromX
                              const dy = toY - fromY
                              const angle = Math.atan2(dy, dx) * (180 / Math.PI)
                              const length = Math.sqrt(dx * dx + dy * dy)

                              return (
                                <svg
                                  key={pred.predecessor_id}
                                  style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    width: '100%',
                                    height: '100%',
                                    pointerEvents: 'none',
                                    zIndex: 1,
                                  }}
                                >
                                  <defs>
                                    <marker
                                      id={`arrow-${pred.predecessor_id}`}
                                      markerWidth="10"
                                      markerHeight="10"
                                      refX="9"
                                      refY="3"
                                      orient="auto"
                                      markerUnits="strokeWidth"
                                    >
                                      <path d="M0,0 L0,6 L9,3 z" fill={schedule.isCritical ? '#c62828' : '#10b981'} />
                                    </marker>
                                  </defs>
                                  <line
                                    x1={`${arrow.fromX}%`}
                                    y1={fromY}
                                    x2={`${arrow.toX}%`}
                                    y2={toY}
                                    stroke={schedule.isCritical ? '#c62828' : '#10b981'}
                                    strokeWidth="2"
                                    markerEnd={`url(#arrow-${pred.predecessor_id})`}
                                    strokeDasharray={pred.dependencyType === 'SS' || pred.dependencyType === 'FF' ? '5,5' : 'none'}
                                  />
                                </svg>
                              )
                            })}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {tasks.length === 0 && (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                  <p>표시할 작업이 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
