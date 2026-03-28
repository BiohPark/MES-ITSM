'use client'

import { useI18n } from '@/lib/i18n'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/** 반응형 스타일 - 좁은 컬럼으로 더 많은 차트 표시 */
const GANTT_CHART_SIZES = {
  // 좌측 정보 패널: 작업명이 너무 짤리지 않도록 더 넓게 확보
  leftPanel: 'clamp(16rem, 24vw, 24rem)',
  index: 'clamp(2rem, 2.2vw, 2.5rem)',
  wbs: 'clamp(2.8rem, 3.5vw, 4rem)',
  duration: 'clamp(2.5rem, 3vw, 3.5rem)',
  float: 'clamp(2.5rem, 3vw, 3.5rem)',
  cp: 'clamp(1.5rem, 2vw, 2rem)',
  // 헤더 높이(좌측/우측 동일 적용으로 행 정렬 오차 제거)
  headerHeight: 40,
  // 바디 행 높이
  rowHeight: 32,
  barHeight: 12,
  /** 일 단위 셀 폭 (한 화면에 더 많은 날짜 표시, 가로 스크롤 가능) */
  dayCellWidth: 18,
} as const
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
  progressPercent?: number | null
  predecessors?: string | null
  assignee?: string | null
  isMilestone?: boolean
}

export interface GanttChartEvent {
  id?: string
  date: string
  name: string
}

interface Props {
  tasks: GanttTask[]
  /** 접기 시 표시할 행만 (tasks 배열 인덱스). 없으면 전체 표시 */
  visibleRowIndices?: Set<number>
  events?: GanttChartEvent[]
  /** 이슈 작업의 task.id 집합 (작업명 강조용) */
  issueTaskIds?: Set<number>
  onDoubleClickDate?: (date: string) => void
  onDeleteEvent?: (event: GanttChartEvent) => void
}

export function GanttTasksChart({ tasks, visibleRowIndices, events = [], issueTaskIds, onDoubleClickDate, onDeleteEvent }: Props) {
  const { t: tr, locale } = useI18n()
  const dateLocale = locale.startsWith('en') ? 'en-US' : 'ko-KR'
  const [timeScale, setTimeScale] = useState<'day' | 'week' | 'month'>('day')
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date}>(() => {
    const today = new Date()
    const start = new Date(today)
    start.setMonth(start.getMonth() - 1)
    const end = new Date(today)
    end.setMonth(end.getMonth() + 3)
    return { start, end }
  })

  /** 전체 목록 순서 (스케줄/선행 계산용). visibleRowIndices 있으면 표시 순서 유지(정렬 없음) */
  const sortedTasks = useMemo(
    () =>
      visibleRowIndices != null
        ? tasks.map((t, idx) => ({ ...t, _rowIndex: idx + 1 }))
        : tasks
            .slice()
            .sort((a, b) => (a.sortOrder ?? 1) - (b.sortOrder ?? 1))
            .map((t, idx) => ({ ...t, _rowIndex: idx + 1 })),
    [tasks, visibleRowIndices]
  )

  /** 실제 렌더링할 행만 (접기 반영) */
  const rowsToRender = useMemo(
    () =>
      visibleRowIndices != null
        ? sortedTasks.filter((_, i) => visibleRowIndices.has(i))
        : sortedTasks,
    [sortedTasks, visibleRowIndices]
  )

  const { schedules, predecessors, projectedRange } = useMemo(() => {
    if (sortedTasks.length === 0) {
      return { schedules: [], predecessors: [] as CalcPredecessor[], projectedRange: null as { start: Date; end: Date } | null }
    }

    const projectStart =
      sortedTasks.find((t) => t.startDate)?.startDate ??
      new Date().toISOString().split('T')[0]

    const calcTasks: CalcTask[] = sortedTasks.map((row) => {
      const id = row.id != null ? String(row.id) : `local-${row._rowIndex}`

      // duration 추론: 우선 durationDays, 없으면 start~finish 일수, 그래도 없으면 1일
      let duration = row.durationDays ?? null
      if (duration == null && row.startDate && row.finishDate) {
        const s = new Date(row.startDate)
        const f = new Date(row.finishDate)
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
        taskIndex: row._rowIndex,
        taskName: row.name || tr('comp.ganttTasksChart.taskN', { n: String(row._rowIndex) }),
        durationDays: duration,
        startDate: row.startDate ?? null,
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

    // 프로젝트 전체 기간 산출 (시작일~종료일 모두 반영)
    let range: { start: Date; end: Date } | null = null
    if (result.length > 0) {
      const starts = result
        .map((s) => (s.startDate ? new Date(s.startDate).getTime() : null))
        .filter((t): t is number => t != null)
      const ends = result
        .map((s) => {
          if (!s.startDate) return null
          const d = new Date(s.startDate)
          d.setDate(d.getDate() + s.durationDays)
          return d.getTime()
        })
        .filter((t): t is number => t != null)
      const all = [...starts, ...ends]
      if (all.length > 0) {
        const minDate = new Date(Math.min(...all))
        const maxDate = new Date(Math.max(...all))
        minDate.setDate(minDate.getDate() - 7)
        maxDate.setDate(maxDate.getDate() + 14)
        range = { start: minDate, end: maxDate }
      }
    }

    return { schedules: result, predecessors: preds, projectedRange: range }
  }, [sortedTasks, tr])

  useEffect(() => {
    if (projectedRange) {
      setDateRange(projectedRange)
    }
  }, [projectedRange])

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

  /** 접기 시 표시 행 내에서의 행 인덱스 (화살표 Y 좌표용) */
  const visibleRowIndexByTaskId = useMemo(() => {
    const map = new Map<string, number>()
    rowsToRender.forEach((task, i) => {
      const taskId = task.id != null ? String(task.id) : `local-${(task as any)._rowIndex}`
      map.set(taskId, i)
    })
    return map
  }, [rowsToRender])

  /** 선행 화살표 오버레이용 데이터 */
  const arrowPaths = useMemo(() => {
    const rows: Array<{ fromX: number; toX: number; fromY: number; toY: number; isCritical: boolean; depType: string; predName: string }> = []
    const rowHeight = GANTT_CHART_SIZES.rowHeight
    const rangeMs = dateRange.end.getTime() - dateRange.start.getTime()
    const getRowIndex = (taskId: string) =>
      visibleRowIndices != null ? visibleRowIndexByTaskId.get(taskId) : sortedTasks.findIndex((t) => (t.id != null ? String(t.id) : `local-${(t as any)._rowIndex}`) === taskId) ?? 0

    sortedTasks.forEach((task) => {
      const taskId = task.id != null ? String(task.id) : `local-${(task as any)._rowIndex}`
      const pos = getItemPosition(taskId)
      if (!pos) return
      const taskPreds = predsByTask.get(taskId) || []
      const toRow = getRowIndex(taskId)
      if (visibleRowIndices != null && toRow === undefined) return

      taskPreds.forEach((pred) => {
        const fromPos = getItemPosition(pred.predecessorTaskId)
        if (!fromPos) return
        const fromRow = getRowIndex(pred.predecessorTaskId)
        if (visibleRowIndices != null && (fromRow === undefined || toRow === undefined)) return

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
          default:
            fromX = fromPos.left + fromPos.width
            toX = pos.left
        }
        const lagPercent = (pred.lagDays * 24 * 60 * 60 * 1000 / rangeMs) * 100
        toX = Math.min(100, toX + lagPercent)

        const predTask = sortedTasks.find((t) => (t.id != null ? String(t.id) : `local-${(t as any)._rowIndex}`) === pred.predecessorTaskId)
        const predName = predTask?.name || `#${(predTask as any)?._rowIndex}` || ''

        rows.push({
          fromX, toX,
          fromY: fromRow! * rowHeight + rowHeight / 2,
          toY: toRow! * rowHeight + rowHeight / 2,
          isCritical: pos.schedule?.isCritical ?? false,
          depType: pred.dependencyType,
          predName,
        })
      })
    })
    return rows
  }, [sortedTasks, rowsToRender, visibleRowIndices, visibleRowIndexByTaskId, predsByTask, dateRange, schedules])

  const dayCellWidth = useMemo(() => {
    switch (timeScale) {
      case 'week':
        // 주 단위: 한 화면에 더 많은 기간을 보기 위해 일 단위 폭 축소
        return Math.max(8, GANTT_CHART_SIZES.dayCellWidth * 0.7)
      case 'month':
        // 월 단위: 한 화면에 아주 긴 기간을 보기 위해 더 축소
        return Math.max(4, GANTT_CHART_SIZES.dayCellWidth * 0.4)
      case 'day':
      default:
        return GANTT_CHART_SIZES.dayCellWidth
    }
  }, [timeScale])

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const dateHeaderRef = useRef<HTMLDivElement>(null)
  const handleDateHeaderDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const header = dateHeaderRef.current
      if (!header || !onDoubleClickDate) return
      const rect = header.getBoundingClientRect()
      // 뷰포트 기준이므로 스크롤은 rect에 이미 반영됨. scrollLeft 추가 시 dayIndex 과대 계산(예: 3/31 → 5/24)
      const x = e.clientX - rect.left
      const dayIndex = Math.floor(x / dayCellWidth)
      if (dayIndex >= 0 && dayIndex < days.length) {
        const d = days[dayIndex]
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        onDoubleClickDate(dateStr)
      }
    },
    [days, onDoubleClickDate, dayCellWidth]
  )

  if (rowsToRender.length === 0) {
    return (
      <div className="placeholder">
        <p>{tr('comp.ganttTasksChart.empty')}</p>
      </div>
    )
  }

  const chartWidth = days.length * dayCellWidth

  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      {/* 확대/축소 (일/주/월 단위) 컨트롤 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.25rem',
          padding: '0.25rem 0.5rem 0.25rem 0.5rem',
          borderBottom: '1px solid #e2e8f0',
          fontSize: '0.75rem',
          color: '#64748b',
          backgroundColor: '#f9fafb',
        }}
      >
        <span style={{ alignSelf: 'center', marginRight: '0.25rem' }}>{tr('comp.ganttTasksChart.timeAxis')}</span>
        {(['day', 'week', 'month'] as const).map((scale) => {
          const label =
            scale === 'day' ? tr('comp.ganttTasksChart.day') : scale === 'week' ? tr('comp.ganttTasksChart.week') : tr('comp.ganttTasksChart.month')
          const active = timeScale === scale
          return (
            <button
              key={scale}
              type="button"
              className="servicenow-button servicenow-button--sm"
              onClick={() => setTimeScale(scale)}
              style={{
                padding: '0.15rem 0.5rem',
                fontSize: '0.7rem',
                lineHeight: 1.2,
                borderRadius: 999,
                borderColor: active ? '#1d4ed8' : '#cbd5e1',
                backgroundColor: active ? '#1d4ed8' : '#f9fafb',
                color: active ? '#ffffff' : '#0f172a',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* 헤더 + 바디를 하나의 가로 스크롤 컨테이너로 */}
      <div
        ref={scrollContainerRef}
        style={{
          maxHeight: 'min(76vh, 680px)',
          overflowY: 'auto',
          overflowX: 'auto',
        }}
      >
        <div style={{ display: 'flex', minWidth: 'max-content' }}>
          {/* 왼쪽 패널 (sticky) */}
          <div
            style={{
              width: GANTT_CHART_SIZES.leftPanel,
              minWidth: GANTT_CHART_SIZES.leftPanel,
              flexShrink: 0,
              position: 'sticky',
              left: 0,
              zIndex: 10,
              backgroundColor: '#fff',
            }}
          >
            {/* 헤더 */}
            <div
              style={{
                display: 'flex',
                borderBottom: '2px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                padding: '0 0.75rem',
                height: GANTT_CHART_SIZES.headerHeight,
                minHeight: GANTT_CHART_SIZES.headerHeight,
                maxHeight: GANTT_CHART_SIZES.headerHeight,
                fontWeight: 600,
                fontSize: '0.8rem',
                gap: '0.75rem',
                alignItems: 'center',
              }}
            >
              <div style={{ width: GANTT_CHART_SIZES.index, minWidth: GANTT_CHART_SIZES.index, textAlign: 'center' }}>{tr('comp.ganttTasksChart.colIndex')}</div>
              <div style={{ width: GANTT_CHART_SIZES.wbs, minWidth: GANTT_CHART_SIZES.wbs }}>{tr('comp.ganttTasksChart.colWbs')}</div>
              <div style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap' }}>{tr('comp.ganttTasksChart.colName')}</div>
              <div style={{ width: GANTT_CHART_SIZES.duration, minWidth: GANTT_CHART_SIZES.duration, textAlign: 'center' }}>{tr('comp.ganttTasksChart.colDuration')}</div>
              <div style={{ width: GANTT_CHART_SIZES.cp, minWidth: GANTT_CHART_SIZES.cp, textAlign: 'center' }}>{tr('comp.ganttTasksChart.colCp')}</div>
            </div>
            {/* 행들 */}
            {rowsToRender.map((task) => {
              const taskId =
                task.id != null ? String(task.id) : `local-${(task as any)._rowIndex}`
              const schedule = schedules.find((s) => s.taskId === taskId)
              const isLevel1 = (task.outlineLevel ?? 1) === 1
              return (
                <div
                  key={taskId}
                  style={{
                    display: 'flex',
                    height: GANTT_CHART_SIZES.rowHeight + 'px',
                    minHeight: GANTT_CHART_SIZES.rowHeight + 'px',
                    maxHeight: GANTT_CHART_SIZES.rowHeight + 'px',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: isLevel1 ? '0.85rem' : '0.8rem',
                    overflow: 'hidden',
                    alignItems: 'center',
                    padding: '0 0.5rem',
                    backgroundColor: schedule?.isCritical ? '#ffebee' : isLevel1 ? 'rgba(30, 58, 138, 0.06)' : 'transparent',
                  }}
                >
                  <div style={{
                    width: GANTT_CHART_SIZES.index,
                    minWidth: GANTT_CHART_SIZES.index,
                    textAlign: 'center',
                    fontWeight: isLevel1 ? 700 : 600,
                    color: schedule?.isCritical ? '#c62828' : isLevel1 ? '#1e3a8a' : '#334155',
                  }}>
                    {(task as any)._rowIndex}
                  </div>
                  <div style={{
                    width: GANTT_CHART_SIZES.wbs,
                    minWidth: GANTT_CHART_SIZES.wbs,
                    fontFamily: 'monospace',
                    fontWeight: isLevel1 ? 600 : 400,
                    color: isLevel1 ? '#1e40af' : '#64748b',
                  }}>
                    {task.wbsCode || '-'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span
                      style={{
                        fontWeight: isLevel1 || (issueTaskIds && task.id != null && issueTaskIds.has(task.id)) ? 700 : 500,
                        fontFamily: isLevel1 ? '"Segoe UI", "Malgun Gothic", system-ui, sans-serif' : 'inherit',
                        color: issueTaskIds && task.id != null && issueTaskIds.has(task.id) ? '#dc2626' : isLevel1 ? '#1e3a8a' : undefined,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={task.name || tr('comp.ganttTasksChart.noName')}
                    >
                      {issueTaskIds && task.id != null && issueTaskIds.has(task.id) && '❗ '}
                      {task.name || tr('comp.ganttTasksChart.noName')}
                    </span>
                    {task.assignee && (
                      <span style={{ fontSize: '0.6rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '4rem' }}>
                        {task.assignee}
                      </span>
                    )}
                  </div>
                  <div style={{
                    width: GANTT_CHART_SIZES.duration,
                    minWidth: GANTT_CHART_SIZES.duration,
                    textAlign: 'center',
                    fontWeight: isLevel1 ? 600 : 400,
                    color: isLevel1 ? '#1e40af' : '#475569',
                  }}>
                    {schedule ? tr('comp.gantt.dayCount', { n: String(schedule.durationDays) }) : '-'}
                  </div>
                  <div style={{ width: GANTT_CHART_SIZES.cp, minWidth: GANTT_CHART_SIZES.cp, textAlign: 'center' }}>
                    {schedule?.isCritical ? <span style={{ color: '#c62828', fontWeight: 700 }}>●</span> : '-'}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 오른쪽 차트 영역 (가로 스크롤) */}
          <div
            style={{
              width: chartWidth,
              minWidth: chartWidth,
              flexShrink: 0,
              position: 'relative',
            }}
          >
            {/* 헤더 날짜: 위 행 = 월(병합), 아래 행 = 일 */}
            <div
              style={{
                borderBottom: '2px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                height: GANTT_CHART_SIZES.headerHeight,
                minHeight: GANTT_CHART_SIZES.headerHeight,
                maxHeight: GANTT_CHART_SIZES.headerHeight,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* 월 헤더: 같은 월은 가로로 병합 */}
              <div
                style={{
                  display: 'flex',
                  flex: 1,
                  borderBottom: '1px solid #e2e8f0',
                }}
              >
                {(() => {
                  const segments: { key: string; month: number; year: number; length: number }[] = []
                  if (days.length === 0) return null

                  let currentMonth = days[0].getMonth()
                  let currentYear = days[0].getFullYear()
                  let startIdx = 0

                  for (let i = 1; i <= days.length; i++) {
                    const d = days[i]
                    if (!d || d.getMonth() !== currentMonth || d.getFullYear() !== currentYear) {
                      const length = i - startIdx
                      segments.push({
                        key: `${currentYear}-${currentMonth}-${startIdx}`,
                        month: currentMonth + 1,
                        year: currentYear,
                        length,
                      })
                      if (d) {
                        currentMonth = d.getMonth()
                        currentYear = d.getFullYear()
                        startIdx = i
                      }
                    }
                  }

                  return segments.map((seg, segIdx) => {
                    const monthDate = new Date(seg.year, seg.month - 1, 1)
                    return (
                    <div
                      key={seg.key}
                      style={{
                        width: seg.length * dayCellWidth,
                        minWidth: seg.length * dayCellWidth,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        borderRight: '1px solid #e2e8f0',
                        backgroundColor: segIdx % 2 === 0 ? '#f8fafc' : '#eef2ff',
                      }}
                      title={monthDate.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })}
                    >
                      {monthDate.toLocaleDateString(dateLocale, { month: 'short' })}
                    </div>
                    )
                  })
                })()}
              </div>

              {/* 일 헤더: 각 날짜별로 숫자만 표시 - 더블클릭 시 해당 날짜에 이벤트 추가 */}
              <div
                ref={dateHeaderRef}
                style={{
                  display: 'flex',
                  flex: 1,
                  cursor: onDoubleClickDate ? 'pointer' : undefined,
                }}
                onDoubleClick={handleDateHeaderDoubleClick}
                title={onDoubleClickDate ? tr('comp.ganttTasksChart.dblClickHint') : undefined}
              >
                {days.map((day, idx) => {
                  const dd = String(day.getDate()).padStart(2, '0')
                  return (
                    <div
                      key={day.getTime()}
                      style={{
                        width: dayCellWidth,
                        minWidth: dayCellWidth,
                        padding: '0.1rem 0.1rem',
                        textAlign: 'center',
                        fontSize: '0.75rem',
                        borderRight: idx % 7 === 6 ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                      }}
                      title={day.toLocaleDateString(dateLocale, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    >
                      {dd}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 차트 바디 (화살표 + 행) */}
            <div style={{ position: 'relative' }}>
              {/* 이벤트 초록색 세로선 + 이벤트명 (오늘 라인과 구분) */}
              {events.map((ev, evIdx) => {
                const evDate = ev.date.includes('T') ? ev.date.split('T')[0] : ev.date
                const [y, m, d] = evDate.split('-').map(Number)
                const evMs = new Date(y, m - 1, d).getTime()
                const rangeStartMs = dateRange.start.getTime()
                const rangeEndMs = dateRange.end.getTime()
                if (evMs < rangeStartMs || evMs > rangeEndMs) return null
                const leftPercent = ((evMs - rangeStartMs) / (rangeEndMs - rangeStartMs)) * 100
                const chartBodyHeight = rowsToRender.length * GANTT_CHART_SIZES.rowHeight
                return (
                  <div
                    key={ev.id ?? `ev-${evIdx}-${ev.date}`}
                    role="button"
                    tabIndex={0}
                    style={{
                      position: 'absolute',
                      left: `calc(${leftPercent}% - ${onDeleteEvent ? 7 : 1}px)`,
                      top: 0,
                      width: onDeleteEvent ? 14 : 2,
                      height: chartBodyHeight,
                      backgroundColor: 'transparent',
                      pointerEvents: onDeleteEvent ? 'auto' : 'none',
                      zIndex: 4,
                      boxSizing: 'border-box',
                      cursor: onDeleteEvent ? 'pointer' : undefined,
                    }}
                    title={
                      onDeleteEvent
                        ? tr('comp.ganttTasksChart.eventClickDelete', {
                            name: ev.name || tr('comp.ganttTasksChart.eventDefault'),
                          })
                        : ev.name
                    }
                    onClick={onDeleteEvent ? () => onDeleteEvent(ev) : undefined}
                  >
                    <div style={{ position: 'absolute', left: onDeleteEvent ? 6 : 0, top: 0, width: 2, height: chartBodyHeight, backgroundColor: '#16a34a' }} />
                    <div style={{ position: 'absolute', left: onDeleteEvent ? 6 : 0, top: 0, width: 2, height: 2, backgroundColor: '#16a34a' }} />
                    <div style={{ position: 'absolute', left: onDeleteEvent ? 6 : 0, bottom: 0, width: 2, height: 2, backgroundColor: '#16a34a' }} />
                    <span
                      style={{
                        position: 'absolute',
                        left: onDeleteEvent ? 8 : 2,
                        top: 2,
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        color: '#15803d',
                        whiteSpace: 'nowrap',
                        maxWidth: 120,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        padding: '0.1rem 0.25rem',
                        borderRadius: 2,
                        pointerEvents: 'none',
                      }}
                    >
                      {ev.name || tr('comp.ganttTasksChart.eventDefault')}
                    </span>
                  </div>
                )
              })}
              {/* 오늘 날짜 빨간색 세로선 (상하 라인) */}
              {(() => {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const todayMs = today.getTime()
                const rangeStartMs = dateRange.start.getTime()
                const rangeEndMs = dateRange.end.getTime()
                if (todayMs < rangeStartMs || todayMs > rangeEndMs) return null
                const leftPercent = ((todayMs - rangeStartMs) / (rangeEndMs - rangeStartMs)) * 100
                const chartBodyHeight = rowsToRender.length * GANTT_CHART_SIZES.rowHeight
                return (
                  <div
                    style={{
                      position: 'absolute',
                      left: `calc(${leftPercent}% - 1px)`,
                      top: 0,
                      width: 2,
                      height: chartBodyHeight,
                      backgroundColor: '#dc2626',
                      pointerEvents: 'none',
                      zIndex: 4,
                      boxSizing: 'border-box',
                    }}
                    title={tr('comp.ganttTasksChart.today')}
                  >
                    <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: 2, backgroundColor: '#dc2626' }} />
                    <div style={{ position: 'absolute', left: 0, bottom: 0, right: 0, height: 2, backgroundColor: '#dc2626' }} />
                  </div>
                )
              })()}
              {arrowPaths.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: rowsToRender.length * GANTT_CHART_SIZES.rowHeight,
                    pointerEvents: 'none',
                    zIndex: 5,
                  }}
                >
                <svg
                  width="100%"
                  height="100%"
                  preserveAspectRatio="none"
                  style={{ overflow: 'visible' }}
                >
                  <defs>
                    <marker id="gantt-arrow-pred" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                      <path d="M0,0 L0,8 L8,4 z" fill="#6366f1" />
                    </marker>
                    <marker id="gantt-arrow-pred-critical" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                      <path d="M0,0 L0,8 L8,4 z" fill="#dc2626" />
                    </marker>
                  </defs>
                  {arrowPaths.map((a, idx) => (
                    <g key={idx}>
                      <line
                        x1={`${a.fromX}%`}
                        y1={a.fromY}
                        x2={`${a.toX}%`}
                        y2={a.toY}
                        stroke={a.isCritical ? '#dc2626' : '#6366f1'}
                        strokeWidth={2}
                        strokeDasharray={a.depType === 'SS' || a.depType === 'FF' ? '4,3' : 'none'}
                        markerEnd={`url(#gantt-arrow-pred${a.isCritical ? '-critical' : ''})`}
                      />
                      <title>{tr('comp.ganttTasksChart.predTitle', { name: a.predName, type: a.depType })}</title>
                    </g>
                  ))}
                </svg>
                </div>
              )}
              {/* 차트 행들 - 바 영역만 */}
            {rowsToRender.map((task) => {
              const taskId =
                task.id != null ? String(task.id) : `local-${(task as any)._rowIndex}`
              const pos = getItemPosition(taskId)
              const schedule = pos?.schedule
              const isLevel1 = (task.outlineLevel ?? 1) === 1

              return (
                <div
                  key={taskId}
                  style={{
                    height: GANTT_CHART_SIZES.rowHeight + 'px',
                    minHeight: GANTT_CHART_SIZES.rowHeight + 'px',
                    maxHeight: GANTT_CHART_SIZES.rowHeight + 'px',
                    borderBottom: '1px solid #e5e7eb',
                    position: 'relative',
                    overflow: 'hidden',
                    backgroundColor: isLevel1 ? 'rgba(30, 58, 138, 0.06)' : undefined,
                  }}
                >
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
                    <div
                      style={{
                        position: 'absolute',
                        left: `${pos.left}%`,
                        width: `${pos.width}%`,
                        top: (GANTT_CHART_SIZES.rowHeight - GANTT_CHART_SIZES.barHeight) / 2,
                        height: GANTT_CHART_SIZES.barHeight + 'px',
                        backgroundColor: schedule.isCritical ? '#c62828' : '#0ea5e9',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 0.4rem',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        cursor: 'default',
                        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.25)',
                        overflow: 'hidden',
                      }}
                      title={`${schedule.taskName} (${schedule.startDate} ~ ${new Date(new Date(schedule.startDate || '').getTime() + schedule.durationDays * 24 * 60 * 60 * 1000).toLocaleDateString(dateLocale)})${
                        (task as any).progressPercent != null
                          ? tr('comp.ganttTasksChart.barActualSuffix', {
                              n: String(Math.round((task as any).progressPercent)),
                            })
                          : ''
                      }`}
                    >
                      {(task as any).progressPercent != null && (task as any).progressPercent > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: `${Math.min(100, Math.max(0, Math.round((task as any).progressPercent)))}%`,
                            backgroundColor: 'rgba(255,255,255,0.35)',
                            borderRadius: '4px 0 0 4px',
                          }}
                        />
                      )}
                      <span
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                        }}
                      >
                        {schedule.taskName}
                        {(task as any).progressPercent != null && (
                          <span style={{ marginLeft: '0.35rem', opacity: 0.9 }}>
                            {Math.round((task as any).progressPercent)}%
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


