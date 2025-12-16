'use client'

import { useMemo, useState } from 'react'
import { calculateSchedule, Task as CalcTask, Predecessor as CalcPredecessor } from '@/lib/schedule-calculator'
import { parsePredecessorString } from '@/lib/predecessor-parser'

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

interface Props {
  tasks: GanttTask[]
}

export function GanttTasksChart({ tasks }: Props) {
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date}>(() => {
    const today = new Date()
    const start = new Date(today)
    start.setMonth(start.getMonth() - 1)
    const end = new Date(today)
    end.setMonth(end.getMonth() + 3)
    return { start, end }
  })

  const sortedTasks = useMemo(
    () =>
      tasks
        .slice()
        .sort((a, b) => (a.sortOrder ?? 1) - (b.sortOrder ?? 1))
        .map((t, idx) => ({ ...t, _rowIndex: idx + 1 })),
    [tasks]
  )

  const { schedules, predecessors } = useMemo(() => {
    if (sortedTasks.length === 0) {
      return { schedules: [], predecessors: [] as CalcPredecessor[] }
    }

    const projectStart =
      sortedTasks.find((t) => t.startDate)?.startDate ??
      new Date().toISOString().split('T')[0]

    const calcTasks: CalcTask[] = sortedTasks.map((t) => {
      const id = t.id != null ? String(t.id) : `local-${t._rowIndex}`

      // duration 추론: 우선 durationDays, 없으면 start~finish 일수, 그래도 없으면 1일
      let duration = t.durationDays ?? null
      if (duration == null && t.startDate && t.finishDate) {
        const s = new Date(t.startDate)
        const f = new Date(t.finishDate)
        const diffDays = Math.max(
          1,
          Math.round((f.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
        )
        duration = diffDays
      }
      if (duration == null || duration <= 0) {
        duration = 1
      }

      return {
        taskId: id,
        taskIndex: t._rowIndex,
        taskName: t.name || `작업 ${t._rowIndex}`,
        durationDays: duration,
        startDate: t.startDate ?? null,
        projectStartDate: projectStart,
      }
    })

    // predecessor 문자열을 행 인덱스를 기준으로 파싱
    const preds: CalcPredecessor[] = []
    const rowIndexToId = new Map<number, string>()
    calcTasks.forEach((t) => {
      rowIndexToId.set(t.taskIndex, t.taskId)
    })

    sortedTasks.forEach((t) => {
      const sourceId =
        t.id != null ? String(t.id) : `local-${(t as any)._rowIndex}`
      const parsed = parsePredecessorString(t.predecessors || '')
      for (const p of parsed) {
        const predTaskId = rowIndexToId.get(p.index)
        if (!predTaskId) continue
        // 자기 자신 방지
        if (predTaskId === sourceId) continue
        preds.push({
          taskId: sourceId,
          predecessorTaskId: predTaskId,
          dependencyType: p.type,
          lagDays: p.lag,
        })
      }
    })

    const result = calculateSchedule(calcTasks, preds, projectStart, null)

    // dateRange 자동 확장
    if (result.length > 0) {
      const allDates = result
        .map((s) => (s.startDate ? new Date(s.startDate) : null))
        .filter(Boolean) as Date[]
      if (allDates.length > 0) {
        const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())))
        const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())))
        minDate.setDate(minDate.getDate() - 7)
        maxDate.setDate(maxDate.getDate() + 30)
        setDateRange({ start: minDate, end: maxDate })
      }
    }

    return { schedules: result, predecessors: preds }
  }, [sortedTasks])

  const days = useMemo(() => {
    const list: Date[] = []
    const current = new Date(dateRange.start)
    while (current <= dateRange.end) {
      list.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    return list
  }, [dateRange])

  const getItemPosition = (taskId: string) => {
    const schedule = schedules.find((s) => s.taskId === taskId)
    if (!schedule || !schedule.startDate) return null

    const itemStart = new Date(schedule.startDate).getTime()
    const itemEnd =
      itemStart + schedule.durationDays * 24 * 60 * 60 * 1000
    const rangeStart = dateRange.start.getTime()
    const rangeEnd = dateRange.end.getTime()

    if (itemEnd < rangeStart || itemStart > rangeEnd) return null

    const startOffset = Math.max(0, itemStart - rangeStart)
    const endOffset = Math.min(rangeEnd - rangeStart, itemEnd - rangeStart)
    const left = (startOffset / (rangeEnd - rangeStart)) * 100
    const width = ((endOffset - startOffset) / (rangeEnd - rangeStart)) * 100
    return { left, width, start: itemStart, end: itemEnd, schedule }
  }

  const predsByTask = useMemo(() => {
    const map = new Map<string, CalcPredecessor[]>()
    predecessors.forEach((p) => {
      if (!map.has(p.taskId)) map.set(p.taskId, [])
      map.get(p.taskId)!.push(p)
    })
    return map
  }, [predecessors])

  if (sortedTasks.length === 0) {
    return (
      <div className="placeholder">
        <p>표시할 작업이 없습니다. 왼쪽 WBS에서 행을 추가해 주세요.</p>
      </div>
    )
  }

  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          borderBottom: '2px solid #e2e8f0',
          backgroundColor: '#f8fafc',
        }}
      >
        <div
          style={{
            width: '420px',
            padding: '0.5rem 0.75rem',
            fontWeight: 600,
            borderRight: '1px solid #e2e8f0',
            display: 'flex',
            gap: '0.75rem',
            fontSize: '0.8rem',
          }}
        >
          <div style={{ width: 50, textAlign: 'center' }}>Index</div>
          <div style={{ width: 80 }}>WBS</div>
          <div style={{ flex: 1 }}>작업명</div>
          <div style={{ width: 70, textAlign: 'center' }}>기간</div>
          <div style={{ width: 80, textAlign: 'center' }}>Float</div>
          <div style={{ width: 40, textAlign: 'center' }}>CP</div>
        </div>
        <div style={{ flex: 1, display: 'flex' }}>
          {days.map((day, idx) => {
            if (idx % 7 !== 0 && idx !== 0) return null
            return (
              <div
                key={day.getTime()}
                style={{
                  minWidth: `${100 / Math.ceil(days.length / 7)}%`,
                  padding: '0.5rem 0.5rem',
                  textAlign: 'center',
                  fontSize: '0.8rem',
                  borderRight: '1px solid #e2e8f0',
                }}
              >
                {day.toLocaleDateString('ko-KR', {
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* 바디 */}
      <div
        style={{
          maxHeight: 420,
          overflowY: 'auto',
        }}
      >
        {sortedTasks.map((task) => {
          const taskId =
            task.id != null ? String(task.id) : `local-${(task as any)._rowIndex}`
          const pos = getItemPosition(taskId)
          const schedule = pos?.schedule
          const taskPreds = predsByTask.get(taskId) || []

          return (
            <div
              key={taskId}
              style={{
                display: 'flex',
                minHeight: 46,
                borderBottom: '1px solid #e5e7eb',
                fontSize: '0.8rem',
                position: 'relative',
              }}
            >
              {/* 왼쪽 정보 */}
              <div
                style={{
                  width: '420px',
                  padding: '0.4rem 0.5rem',
                  borderRight: '1px solid #e2e8f0',
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'center',
                  backgroundColor: schedule?.isCritical ? '#ffebee' : 'transparent',
                }}
              >
                <div
                  style={{
                    width: 50,
                    textAlign: 'center',
                    fontWeight: 600,
                    color: schedule?.isCritical ? '#c62828' : '#334155',
                  }}
                >
                  {(task as any)._rowIndex}
                </div>
                <div
                  style={{
                    width: 80,
                    fontFamily: 'monospace',
                    color: '#64748b',
                  }}
                >
                  {task.wbsCode || '-'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {task.name || '(이름 없음)'}
                  </div>
                  {task.assignee && (
                    <div
                      style={{
                        fontSize: '0.7rem',
                        color: '#64748b',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {task.assignee}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    width: 70,
                    textAlign: 'center',
                    color: '#475569',
                  }}
                >
                  {schedule ? `${schedule.durationDays}일` : '-'}
                </div>
                <div
                  style={{
                    width: 80,
                    textAlign: 'center',
                    color: schedule?.totalFloat === 0 ? '#c62828' : '#334155',
                  }}
                >
                  {schedule ? `${schedule.totalFloat}일` : '-'}
                </div>
                <div style={{ width: 40, textAlign: 'center' }}>
                  {schedule?.isCritical ? (
                    <span style={{ color: '#c62828', fontWeight: 700 }}>●</span>
                  ) : (
                    '-'
                  )}
                </div>
              </div>

              {/* 오른쪽 Gantt 차트 영역 */}
              <div
                style={{
                  flex: 1,
                  position: 'relative',
                  minHeight: 46,
                  borderRight: '1px solid #e2e8f0',
                }}
              >
                {/* 가로 그리드 라인 */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: '50%',
                    borderTop: '1px dashed #e5e7eb',
                  }}
                />

                {pos && schedule && (
                  <>
                    {/* 작업 바 */}
                    <div
                      style={{
                        position: 'absolute',
                        left: `${pos.left}%`,
                        width: `${pos.width}%`,
                        top: 10,
                        height: 20,
                        backgroundColor: schedule.isCritical
                          ? '#c62828'
                          : '#0ea5e9',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 0.4rem',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        cursor: 'default',
                        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.25)',
                      }}
                      title={`${schedule.taskName} (${schedule.startDate} ~ ${new Date(
                        new Date(schedule.startDate || '').getTime() +
                          schedule.durationDays * 24 * 60 * 60 * 1000
                      ).toLocaleDateString('ko-KR')})`}
                    >
                      {pos.width > 6 && schedule.taskName}
                    </div>

                    {/* 선행 관계 화살표 */}
                    {taskPreds.map((pred, idx) => {
                      const fromPos = getItemPosition(pred.predecessorTaskId)
                      if (!fromPos) return null

                      let fromX = 0
                      let toX = 0

                      switch (pred.dependencyType) {
                        case 'FS':
                          fromX = fromPos.left + fromPos.width
                          toX = pos.left
                          break
                        case 'SS':
                          fromX = fromPos.left
                          toX = pos.left
                          break
                        case 'FF':
                          fromX = fromPos.left + fromPos.width
                          toX = pos.left + pos.width
                          break
                        case 'SF':
                          fromX = fromPos.left
                          toX = pos.left + pos.width
                          break
                      }

                      const lagMs =
                        pred.lagDays * 24 * 60 * 60 * 1000
                      const lagPercent =
                        (lagMs /
                          (dateRange.end.getTime() -
                            dateRange.start.getTime())) *
                        100
                      toX += lagPercent

                      const rowHeight = 46
                      const fromRow =
                        sortedTasks.findIndex((t) => {
                          const id =
                            t.id != null
                              ? String(t.id)
                              : `local-${(t as any)._rowIndex}`
                          return id === pred.predecessorTaskId
                        }) ?? 0
                      const toRow =
                        sortedTasks.findIndex((t) => {
                          const id =
                            t.id != null
                              ? String(t.id)
                              : `local-${(t as any)._rowIndex}`
                          return id === taskId
                        }) ?? 0

                      const fromY = fromRow * rowHeight + rowHeight / 2
                      const toY = toRow * rowHeight + rowHeight / 2

                      return (
                        <svg
                          key={`${taskId}-${idx}`}
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            width: '100%',
                            height: '100%',
                            pointerEvents: 'none',
                          }}
                        >
                          <defs>
                            <marker
                              id={`gantt-arrow-${taskId}-${idx}`}
                              markerWidth="10"
                              markerHeight="10"
                              refX="9"
                              refY="3"
                              orient="auto"
                              markerUnits="strokeWidth"
                            >
                              <path
                                d="M0,0 L0,6 L9,3 z"
                                fill={
                                  schedule.isCritical ? '#c62828' : '#0ea5e9'
                                }
                              />
                            </marker>
                          </defs>
                          <line
                            x1={`${fromX}%`}
                            y1={fromY}
                            x2={`${toX}%`}
                            y2={toY}
                            stroke={
                              schedule.isCritical ? '#c62828' : '#0ea5e9'
                            }
                            strokeWidth={1.5}
                            markerEnd={`url(#gantt-arrow-${taskId}-${idx})`}
                            strokeDasharray={
                              pred.dependencyType === 'SS' ||
                              pred.dependencyType === 'FF'
                                ? '4,4'
                                : 'none'
                            }
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
    </div>
  )
}


