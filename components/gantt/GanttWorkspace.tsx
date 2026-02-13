'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parsePredecessorString } from '@/lib/predecessor-parser'
import { GanttTasksChart } from './GanttTasksChart'

const LONG_PRESS_MS = 450

/** date input용 YYYY-MM-DD 정규화 */
function toDateInputValue(date: string | null | undefined): string {
  if (!date) return ''
  const d = date.includes('T') ? date.split('T')[0] : date
  return d || ''
}

/** YYYY-MM-DD를 로컬 날짜로 파싱 (타임존 버그 방지, ISO 형식 지원) */
function parseLocalDate(dateStr: string): Date {
  const normalized = dateStr && dateStr.includes('T') ? dateStr.split('T')[0] : (dateStr || '')
  const parts = normalized.split('-').map(Number)
  const [y, m, d] = [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
  return new Date(y, m - 1, d)
}

/** Date를 YYYY-MM-DD(로컬 기준)로 포맷 */
function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 날짜 문자열에 일수 더하기 (YYYY-MM-DD, 로컬 기준) */
function addDaysToDate(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr)
  d.setDate(d.getDate() + days)
  return formatLocalDate(d)
}

/** 반응형 컬럼 스타일 - 고정 너비 컬럼 (flex: 0 0 auto) */
const WBS_COLUMNS = {
  seq: 'clamp(2rem, 2.2vw, 2.5rem)',
  wbs: 'clamp(3rem, 4vw, 4.5rem)',
  level: 'clamp(2.5rem, 3vw, 3.5rem)',
  date: 'clamp(5.5rem, 7vw, 8rem)',
  duration: 'clamp(3rem, 3.5vw, 4rem)',
  progress: 'clamp(3.5rem, 4vw, 5rem)',
  predecessors: 'clamp(5rem, 6.5vw, 8rem)',
  assignee: 'clamp(5rem, 6vw, 7.5rem)',
  indent: 'clamp(3rem, 3.5vw, 4rem)',
  addChild: 'clamp(3.5rem, 4vw, 4.5rem)',
  delete: 'clamp(2.5rem, 2.8vw, 3rem)',
} as const
/** 작업명 컬럼: 남는 공간을 채움 (minWidth만 지정) */
const WBS_NAME_MIN = 'clamp(8rem, 12vw, 14rem)'

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
  progressPercent?: number | null
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
  const [showXmlSection, setShowXmlSection] = useState(false)
  const [activeSubTab, setActiveSubTab] = useState<SubTabKey>('wbs')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [canEditWbs, setCanEditWbs] = useState<boolean | null>(null)

  // 드래그 앤 드롭 상태
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<{ type: 'child'; index: number } | { type: 'sibling'; index: number } | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const autoSaveTimerRef = useRef<number | null>(null)

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

  useEffect(() => {
    let cancelled = false
    fetch('/api/gantt/permission')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setCanEditWbs(!!data.canEditWbs)
      })
      .catch(() => {
        if (!cancelled) setCanEditWbs(false)
      })
    return () => { cancelled = true }
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
      setHasUnsavedChanges(false)
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
        progressPercent: 0,
        predecessors: '',
        assignee: '',
        isMilestone: false,
      },
    ])
    setHasUnsavedChanges(true)
  }

  /** 특정 행의 하위 레벨 행 추가 (마지막 자식 위치 = 맨 아래) */
  const handleAddChildRow = (parentIndex: number) => {
    if (!selectedProjectId) {
      alert('먼저 Gantt 프로젝트를 선택하거나 생성하세요.')
      return
    }
    setTasks((prev) => {
      const parent = prev[parentIndex]
      if (!parent) return prev
      const parentLevel = parent.outlineLevel ?? 1
      const childLevel = parentLevel + 1

      // 부모의 마지막 직접 자식 다음 위치에 삽입 (맨 아래)
      let insertAt = parentIndex + 1
      for (let i = parentIndex + 1; i < prev.length; i++) {
        const lv = prev[i].outlineLevel ?? 1
        if (lv <= parentLevel) break
        if (lv === childLevel) insertAt = i + 1
      }

      const nextSort = prev.length === 0 ? 1 : Math.max(...prev.map((t) => t.sortOrder ?? 1)) + 1
      const newTask: GanttTask = {
        projectId: selectedProjectId,
        outlineLevel: childLevel,
        sortOrder: nextSort,
        name: '',
        durationDays: 1,
        progressPercent: 0,
        predecessors: '',
        assignee: '',
        isMilestone: false,
      }
      const copy = [...prev]
      copy.splice(insertAt, 0, newTask)
      return copy
    })
    setHasUnsavedChanges(true)
  }

  /** 드래그 중인 항목 + 하위 항목들의 인덱스 집합 */
  const getDraggedSubtreeIndices = useCallback((startIdx: number): number[] => {
    const level = tasks[startIdx]?.outlineLevel ?? 1
    const indices: number[] = [startIdx]
    for (let i = startIdx + 1; i < tasks.length; i++) {
      const lv = tasks[i].outlineLevel ?? 1
      if (lv <= level) break
      indices.push(i)
    }
    return indices
  }, [tasks])

  /** 드롭 처리: child = 해당 행의 하위로, sibling = 같은 레벨로 위치만 변경 */
  const handleDrop = useCallback(
    (targetType: 'child' | 'sibling', targetIndex: number) => {
      if (draggingIndex == null) return
      const indices = getDraggedSubtreeIndices(draggingIndex)
      if (indices.length === 0) return

      setTasks((prev) => {
        const copy = [...prev]
        const [dragged] = indices.map((i) => copy[i])
        const draggedLevel = dragged.outlineLevel ?? 1

        if (targetType === 'child') {
          const parent = copy[targetIndex]
          const parentLevel = parent.outlineLevel ?? 1
          const newLevel = parentLevel + 1

          let insertAt = targetIndex + 1
          for (let i = targetIndex + 1; i < copy.length; i++) {
            const lv = copy[i].outlineLevel ?? 1
            if (lv <= parentLevel) break
            if (lv === newLevel) insertAt = i + 1
          }

          const extracted = indices.sort((a, b) => b - a).map((i) => copy.splice(i, 1)[0])
          const adjusted = extracted.map((t) => ({
            ...t,
            outlineLevel: Math.max(1, newLevel + ((t.outlineLevel ?? 1) - draggedLevel)),
          }))
          copy.splice(insertAt, 0, ...adjusted)
        } else {
          let insertAt = targetIndex
          if (draggingIndex < targetIndex) {
            const removeCount = indices.filter((i) => i < targetIndex).length
            insertAt = targetIndex - removeCount
          }

          const extracted = indices.sort((a, b) => b - a).map((i) => copy.splice(i, 1)[0])
          copy.splice(insertAt, 0, ...extracted)
        }

        return copy
      })
      setDraggingIndex(null)
      setDropTarget(null)
      setHasUnsavedChanges(true)
    },
    [draggingIndex, getDraggedSubtreeIndices]
  )

  /** 마우스 이동 시 드롭 타겟 계산 */
  const updateDropTarget = useCallback(
    (clientY: number) => {
      if (draggingIndex == null) return
      const entries = Array.from(rowRefs.current.entries()).filter(([i]) => !getDraggedSubtreeIndices(draggingIndex).includes(i))
      for (const [idx, el] of entries) {
        const rect = el.getBoundingClientRect()
        const relY = clientY - rect.top
        const h = rect.height
        if (relY < 0) continue
        if (relY > h) continue

        if (relY < h * 0.25) {
          setDropTarget({ type: 'sibling', index: idx })
          return
        }
        if (relY > h * 0.75) {
          setDropTarget({ type: 'sibling', index: idx + 1 })
          return
        }
        setDropTarget({ type: 'child', index: idx })
        return
      }
      if (entries.length > 0) {
        const lastIdx = entries[entries.length - 1][0]
        setDropTarget({ type: 'sibling', index: lastIdx + 1 })
      } else {
        setDropTarget(null)
      }
    },
    [draggingIndex, getDraggedSubtreeIndices]
  )

  useEffect(() => {
    if (draggingIndex == null) return
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    const onMove = (e: MouseEvent) => updateDropTarget(e.clientY)
    const onUp = () => {
      if (dropTarget) {
        handleDrop(dropTarget.type, dropTarget.index)
      } else {
        setDraggingIndex(null)
        setDropTarget(null)
      }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [draggingIndex, dropTarget, handleDrop, updateDropTarget])

  const handleChangeTask = (
    index: number,
    field: keyof GanttTask,
    value: any
  ) => {
    setTasks((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }

      // 기간(일) 수동 입력 시: 시작일이 있으면 종료일 자동 업데이트
      if (field === 'durationDays' && value != null && Number(value) > 0) {
        const curr = copy[index]
        if (curr.startDate) {
          const dur = Math.max(1, Number(value))
          copy[index] = {
            ...copy[index],
            finishDate: addDaysToDate(curr.startDate, dur - 1),
          }
        }
      }

      // 선행 작업 지정 시: 시작일 = (모든 선행 작업의 종료일 중 가장 늦은 날) + 1일
      if (field === 'predecessors') {
        const parsed = parsePredecessorString(value || '')
        if (parsed.length > 0) {
          const predIndices = parsed
            .map((p) => p.index - 1) // 1-based → 0-based
            .filter((pi) => pi >= 0 && pi < copy.length)

          const finishTimes = predIndices
            .map((pi) => copy[pi].finishDate)
            .filter((d): d is string => !!d)
            .map((d) => parseLocalDate(d).getTime())

          if (finishTimes.length > 0) {
            const latestFinishMs = Math.max(...finishTimes)
            const latestFinish = formatLocalDate(new Date(latestFinishMs))
            const newStart = addDaysToDate(latestFinish, 1)
            copy[index] = { ...copy[index], startDate: newStart }
            // 기간 유지: 종료일 = 시작일 + (기간-1)일
            const dur = copy[index].durationDays ?? 1
            copy[index] = {
              ...copy[index],
              finishDate: addDaysToDate(newStart, Math.max(1, dur) - 1),
            }
          }
        }
      }

      // 날짜/기간 변경 시: 기간 재계산 또는 연쇄·상위 업데이트
      if (field === 'startDate' || field === 'finishDate' || field === 'durationDays') {
        const curr = copy[index]
        // 날짜 변경 시에만 기간 재계산 (기간 수동 입력 시에는 유지)
        if ((field === 'startDate' || field === 'finishDate') && curr.startDate && curr.finishDate) {
          const s = parseLocalDate(curr.startDate).getTime()
          const f = parseLocalDate(curr.finishDate).getTime()
          const diffDays = Math.ceil((f - s) / (1000 * 60 * 60 * 24))
          curr.durationDays = Math.max(1, diffDays + 1) // inclusive
        }

        // 종료일 변경 시(직접 수정 또는 기간 입력): 후속 작업들 업데이트
        if (field === 'finishDate' || field === 'durationDays') {
          for (let i = 0; i < copy.length; i++) {
            if (i === index) continue // 사용자가 직접 수정한 작업은 덮어쓰지 않음
            const parsed = parsePredecessorString(copy[i].predecessors || '')
            if (parsed.length === 0) continue

            // 이 작업(i)의 선행 작업들 중, 현재 변경된 작업(index)이 포함될 때만 재계산
            const predIndices = parsed
              .map((p) => p.index - 1)
              .filter((pi) => pi >= 0 && pi < copy.length)
            if (!predIndices.includes(index)) continue

            const finishTimes = predIndices
              .map((pi) => copy[pi].finishDate)
              .filter((d): d is string => !!d)
              .map((d) => parseLocalDate(d).getTime())
            if (finishTimes.length === 0) continue

            const latestFinishMs = Math.max(...finishTimes)
            const latestFinish = formatLocalDate(new Date(latestFinishMs))
            const newStart = addDaysToDate(latestFinish, 1)
            const dur = copy[i].durationDays ?? 1
            copy[i] = {
              ...copy[i],
              startDate: newStart,
              finishDate: addDaysToDate(newStart, Math.max(1, dur) - 1),
            }
          }
        }

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
            parent.startDate = formatLocalDate(minStartDate)
          }

          if (childFinishDates.length > 0) {
            const maxFinishDate = new Date(Math.max(...childFinishDates))
            parent.finishDate = formatLocalDate(maxFinishDate)
          }

          // duration_days도 자동 계산 (inclusive)
          if (parent.startDate && parent.finishDate) {
            const start = parseLocalDate(parent.startDate).getTime()
            const finish = parseLocalDate(parent.finishDate).getTime()
            const diffDays = Math.ceil((finish - start) / (1000 * 60 * 60 * 24))
            parent.durationDays = Math.max(1, diffDays + 1)
          }
        }
      }
      
      return copy
    })
    setHasUnsavedChanges(true)
  }

  const handleDeleteRow = (index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index))
    setHasUnsavedChanges(true)
  }

  const handleIndent = (index: number, direction: 1 | -1) => {
    setTasks((prev) => {
      const copy = [...prev]
      const t = { ...copy[index] }
      t.outlineLevel = Math.max(1, (t.outlineLevel || 1) + direction)
      copy[index] = t
      return copy
    })
    setHasUnsavedChanges(true)
  }

  const recomputeWbsCodes = (items: GanttTask[]): GanttTask[] => {
    const counters: number[] = []
    const result: GanttTask[] = []
    // 화면 표시 순서(배열 순서)를 기준으로 WBS 계산 (sortOrder 무시)
    const ordered = items.slice()

    /** 시작일~종료일 포함 기간(일) 계산 - 3/1~3/10 = 10일 */
    const calcDurationFromDates = (start: string, finish: string): number => {
      const s = parseLocalDate(start).getTime()
      const f = parseLocalDate(finish).getTime()
      const diffDays = Math.ceil((f - s) / (1000 * 60 * 60 * 24))
      return Math.max(1, diffDays + 1) // inclusive: 동일일=1일
    }

    // 1단계: WBS 코드 계산 (배열 순서 기준)
    for (let i = 0; i < ordered.length; i++) {
      const t = ordered[i]
      const level = Math.max(1, t.outlineLevel || 1)
      counters.length = level
      counters[level - 1] = (counters[level - 1] || 0) + 1
      const wbs = counters.slice(0, level).join('.')
      result.push({
        ...t,
        outlineLevel: level,
        wbsCode: wbs,
        sortOrder: i + 1, // 저장 시 순서 유지를 위해 재할당
      })
    }

    // 2단계: 리프 작업 - 시작/종료가 있으면 기간 자동 계산
    for (let i = 0; i < result.length; i++) {
      const curr = result[i]
      const currLevel = curr.outlineLevel || 1
      const hasChildren = i + 1 < result.length && (result[i + 1].outlineLevel ?? 1) > currLevel
      if (!hasChildren && curr.startDate && curr.finishDate && curr.durationDays === undefined) {
        curr.durationDays = calcDurationFromDates(curr.startDate, curr.finishDate)
      }
    }

    // 3단계: 상위 레벨의 시작/종료 날짜 및 실적(%)를 하위 레벨에 따라 자동 계산
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

        // 하위 항목이 있는 경우, 시작일·종료일·실적 자동 계산
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
            current.startDate = formatLocalDate(minStartDate)
          }

          if (childFinishDates.length > 0) {
            const maxFinishDate = new Date(Math.max(...childFinishDates))
            current.finishDate = formatLocalDate(maxFinishDate)
          }

          // duration_days도 자동 계산 (최소 1일)
          if (current.startDate && current.finishDate) {
            current.durationDays = calcDurationFromDates(current.startDate, current.finishDate)
          }

          // 상위 실적 %: 하위가 하나라도 실적을 가지면 하위 기준으로 항상 자동 계산 (0이어도 반영)
          const childrenWithProgress = childItems.filter(
            (c) => c.progressPercent != null
          )
          if (childrenWithProgress.length > 0) {
            const weightedChildren = childrenWithProgress.filter(
              (c) => (c.durationDays ?? 0) > 0
            )
            let agg = 0
            if (weightedChildren.length > 0) {
              const totalWeight = weightedChildren.reduce(
                (sum, c) => sum + (c.durationDays ?? 0),
                0
              )
              const weightedSum = weightedChildren.reduce(
                (sum, c) => sum + (c.progressPercent ?? 0) * (c.durationDays ?? 0),
                0
              )
              agg = totalWeight > 0 ? weightedSum / totalWeight : 0
            } else {
              agg =
                childrenWithProgress.reduce(
                  (sum, c) => sum + (c.progressPercent ?? 0),
                  0
                ) / childrenWithProgress.length
            }
            current.progressPercent = Math.round(agg * 100) / 100
          }
        }
      }
    }

    return result
  }

  /** 표시용: WBS·날짜·기간이 재계산된 태스크 목록 */
  const displayTasks = useMemo(() => recomputeWbsCodes(tasks), [tasks])

  /** 프로젝트 실적 요약: 계획 기간, 계획 실적 %, 전체 실적 % (가중 평균) */
  const projectProgressSummary = useMemo(() => {
    const empty = { planDays: 0, plannedProgress: 0, overallProgress: 0, startDate: null as string | null, finishDate: null as string | null }
    if (displayTasks.length === 0) return empty
    const withDates = displayTasks.filter((t) => t.startDate && t.finishDate)
    if (withDates.length === 0) return empty
    const minStart = withDates.reduce((a, t) => {
      const s = t.startDate!.includes('T') ? t.startDate!.split('T')[0] : t.startDate!
      return s < a ? s : a
    }, withDates[0].startDate!.includes('T') ? withDates[0].startDate!.split('T')[0]! : withDates[0].startDate!)
    const maxFinish = withDates.reduce((a, t) => {
      const f = t.finishDate!.includes('T') ? t.finishDate!.split('T')[0] : t.finishDate!
      return f > a ? f : a
    }, withDates[0].finishDate!.includes('T') ? withDates[0].finishDate!.split('T')[0]! : withDates[0].finishDate!)
    const startMs = parseLocalDate(minStart).getTime()
    const finishMs = parseLocalDate(maxFinish).getTime()
    const diffDays = !isNaN(startMs) && !isNaN(finishMs)
      ? Math.ceil((finishMs - startMs) / (1000 * 60 * 60 * 24)) + 1
      : 0
    const planDays = Math.max(1, diffDays)
    // 계획 실적: 현재일 기준 경과 비율 (시작일~종료일 사이에서)
    let plannedProgress = 0
    if (!isNaN(startMs) && !isNaN(finishMs)) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayMs = today.getTime()
      if (todayMs < startMs) plannedProgress = 0
      else if (todayMs >= finishMs) plannedProgress = 100
      else {
        const elapsedDays = Math.ceil((todayMs - startMs) / (1000 * 60 * 60 * 24))
        plannedProgress = Math.min(100, Math.max(0, (elapsedDays / planDays) * 100))
      }
    }
    // 리프 작업만 가중 평균 (기간 기준)
    const leafTasks = displayTasks.filter((t, i) => {
      const currLevel = t.outlineLevel ?? 1
      const nextLevel = i + 1 < displayTasks.length ? (displayTasks[i + 1].outlineLevel ?? 1) : 0
      return nextLevel <= currLevel
    })
    const withDuration = leafTasks.filter((t) => (t.durationDays ?? 0) > 0)
    let overallProgress = 0
    if (withDuration.length > 0) {
      const totalWeight = withDuration.reduce((s, t) => s + (t.durationDays ?? 0), 0)
      const weightedSum = withDuration.reduce((s, t) => s + (t.progressPercent ?? 0) * (t.durationDays ?? 0), 0)
      overallProgress = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0
    } else if (leafTasks.length > 0) {
      overallProgress = leafTasks.reduce((s, t) => s + (t.progressPercent ?? 0), 0) / leafTasks.length
    }
    return { planDays, plannedProgress, overallProgress, startDate: minStart, finishDate: maxFinish }
  }, [displayTasks])

  const readOnlyWbs = canEditWbs === false

  /** WBS 자동 저장 (입력 시 일정 시간 후 백엔드로 저장, 권한 있을 때만) */
  useEffect(() => {
    if (!canEditWbs || !selectedProjectId) return
    if (!hasUnsavedChanges) return
    if (tasks.length === 0) return

    if (autoSaveTimerRef.current != null) {
      clearTimeout(autoSaveTimerRef.current)
    }

    autoSaveTimerRef.current = window.setTimeout(async () => {
      try {
        const normalized = recomputeWbsCodes(tasks)
        await fetch(`/api/gantt/tasks/${selectedProjectId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tasks: normalized }),
        })
        setHasUnsavedChanges(false)
      } catch (err) {
        console.error('자동 저장 실패', err)
        // 조용히 로그만 남기고, 사용자는 필요 시 수동 저장 버튼을 다시 눌러 복구할 수 있도록 둔다.
      }
    }, 1500)

    return () => {
      if (autoSaveTimerRef.current != null) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [selectedProjectId, hasUnsavedChanges, tasks])

  const handleSaveTasks = async () => {
    if (!selectedProjectId) {
      alert('먼저 Gantt 프로젝트를 선택하세요.')
      return
    }
    const normalized = recomputeWbsCodes(tasks)
    setHasUnsavedChanges(false)
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
        const msg = data.details ? `${data.error || '태스크 저장 실패'}: ${data.details}` : (data.error || '태스크 저장 실패')
        throw new Error(msg)
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
              disabled={readOnlyWbs}
            >
              새로 만들기
            </button>
          </div>
        </div>

        {/* Row 2: XML Import / Export (접기/펼치기) */}
        <div className="servicenow-toolbar__section" style={{ marginTop: '0.5rem' }}>
          <button
            type="button"
            className="servicenow-button servicenow-button--secondary"
            onClick={() => setShowXmlSection((v) => !v)}
            style={{ fontSize: '0.85rem' }}
          >
            {showXmlSection ? '▼ MS Project XML 접기' : '▶ MS Project XML Import/Export'}
          </button>
          {showXmlSection && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: 4, border: '1px solid #e2e8f0' }}>
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
                  disabled={importing || readOnlyWbs}
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
              <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.5rem', marginBottom: 0 }}>
                Microsoft Project XML 형식 파일을 업로드하면 새 Gantt 프로젝트로 Import 됩니다. Export된 XML 파일은 Microsoft Project에서 열 수 있습니다.
              </p>
            </div>
          )}
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
              {readOnlyWbs && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    backgroundColor: '#fef3c7',
                    border: '1px solid #f59e0b',
                    borderRadius: 8,
                    fontSize: '0.875rem',
                    color: '#92400e',
                  }}
                >
                  WBS 수정 권한이 없습니다. 관리자(설정 → 사용자 관리)에서 WBS 수정 권한 부여를 요청하세요.
                </div>
              )}
              {/* WBS 편집 영역 - 모던 카드 스타일 */}
              <div
                style={{
                  marginBottom: '1.25rem',
                  padding: '1rem 1.25rem',
                  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                  borderRadius: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  border: '1px solid rgba(226,232,240,0.8)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '1.1rem',
                    }}
                  >
                    📋
                  </div>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>
                      {selectedProject.name}
                      <span style={{ marginLeft: '0.5rem', color: '#94a3b8', fontWeight: 400, fontSize: '0.85rem' }}>
                        #{selectedProject.id}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                      행을 0.5초 이상 누르면 드래그로 이동 · 선행 작업은 드롭다운으로 선택
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="servicenow-button servicenow-button--secondary"
                    onClick={handleAddRow}
                    disabled={readOnlyWbs}
                    style={{
                      borderRadius: 8,
                      padding: '0.5rem 1rem',
                      fontWeight: 500,
                    }}
                  >
                    + 행 추가
                  </button>
                  <button
                    type="button"
                    className="servicenow-button servicenow-button--primary"
                    onClick={handleSaveTasks}
                    disabled={tasksLoading || readOnlyWbs}
                    style={{
                      borderRadius: 8,
                      padding: '0.5rem 1.25rem',
                      fontWeight: 600,
                      background: tasksLoading ? '#94a3b8' : undefined,
                    }}
                  >
                    {tasksLoading ? '저장 중...' : '💾 WBS 저장'}
                  </button>
                </div>
              </div>

              {/* 계획 대비 실적 요약 - 글래스모피즘 스타일 */}
              {displayTasks.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    gap: '1.5rem',
                    padding: '1rem 1.25rem',
                    marginBottom: '1.25rem',
                    background: 'linear-gradient(135deg, rgba(248,250,252,0.9) 0%, rgba(241,245,249,0.95) 100%)',
                    borderRadius: 12,
                    border: '1px solid rgba(226,232,240,0.6)',
                    flexWrap: 'wrap',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#64748b', fontSize: '0.85rem' }}>계획 기간</span>
                    <strong style={{ fontSize: '1rem' }}>
                      {Number.isFinite(projectProgressSummary.planDays) ? projectProgressSummary.planDays : 0}일
                    </strong>
                    {projectProgressSummary.startDate && projectProgressSummary.finishDate && (
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                        ({projectProgressSummary.startDate} ~ {projectProgressSummary.finishDate})
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#64748b', fontSize: '0.85rem' }}>계획 실적</span>
                    <strong style={{ fontSize: '1.05rem', color: '#64748b' }}>
                      {Number.isFinite(projectProgressSummary.plannedProgress) ? projectProgressSummary.plannedProgress.toFixed(1) : '0.0'}%
                    </strong>
                    <span style={{ color: '#cbd5e1', margin: '0 0.25rem' }}>{' | '}</span>
                    <span style={{ color: '#64748b', fontSize: '0.85rem' }}>전체 실적</span>
                    <strong style={{ fontSize: '1.1rem', color: '#2A84D5' }}>
                      {Number.isFinite(projectProgressSummary.overallProgress) ? projectProgressSummary.overallProgress.toFixed(1) : '0.0'}%
                    </strong>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 120,
                      maxWidth: 200,
                      height: 8,
                      backgroundColor: '#e2e8f0',
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(0, Number.isFinite(projectProgressSummary.overallProgress) ? projectProgressSummary.overallProgress : 0))}%`,
                        height: '100%',
                        backgroundColor: '#2A84D5',
                        transition: 'width 0.2s',
                      }}
                    />
                  </div>
                </div>
              )}

              <div
                style={{
                  width: '100%',
                  minWidth: 0,
                  border: '1px solid rgba(226,232,240,0.8)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
              <div
                style={{
                  display: 'flex',
                  width: '100%',
                  minWidth: 0,
                  background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
                  borderBottom: '2px solid #e2e8f0',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: '#475569',
                }}
              >
                <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.seq, minWidth: WBS_COLUMNS.seq, padding: '0.35rem 0.6rem', textAlign: 'center' }}>#</div>
                <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.wbs, minWidth: WBS_COLUMNS.wbs, padding: '0.35rem 0.6rem', textAlign: 'center' }}>WBS</div>
                <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.level, minWidth: WBS_COLUMNS.level, padding: '0.35rem 0.6rem', textAlign: 'center' }}>레벨</div>
                <div style={{ flex: '1 1 0%', minWidth: WBS_NAME_MIN, padding: '0.35rem 0.6rem' }}>작업명</div>
                <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.progress, minWidth: WBS_COLUMNS.progress, padding: '0.35rem 0.6rem', textAlign: 'center' }}>실적(%)</div>
                <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.date, minWidth: WBS_COLUMNS.date, padding: '0.35rem 0.6rem' }}>시작</div>
                <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.date, minWidth: WBS_COLUMNS.date, padding: '0.35rem 0.6rem' }}>종료</div>
                <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.duration, minWidth: WBS_COLUMNS.duration, padding: '0.35rem 0.6rem', textAlign: 'center' }}>기간(일)</div>
                <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.predecessors, minWidth: WBS_COLUMNS.predecessors, padding: '0.35rem 0.6rem' }}>선행 작업</div>
                <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.assignee, minWidth: WBS_COLUMNS.assignee, padding: '0.35rem 0.6rem' }}>담당자</div>
                <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.indent, minWidth: WBS_COLUMNS.indent, padding: '0.35rem 0.6rem', textAlign: 'center' }}>조정</div>
                <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.addChild, minWidth: WBS_COLUMNS.addChild, padding: '0.35rem 0.6rem', textAlign: 'center' }}>하위</div>
                <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.delete, minWidth: WBS_COLUMNS.delete, padding: '0.35rem 0.6rem', textAlign: 'center' }}>삭제</div>
              </div>
              <div style={{ width: '100%', minWidth: 0, maxHeight: 'min(65vh, 600px)', overflow: 'auto' }}>
                {displayTasks.map((t, idx) => {
                  const isDragging = draggingIndex != null && getDraggedSubtreeIndices(draggingIndex).includes(idx)
                  const isDropChild = dropTarget?.type === 'child' && dropTarget.index === idx
                  const isDropSiblingBefore = dropTarget?.type === 'sibling' && dropTarget.index === idx
                  const isDropSiblingAfter = dropTarget?.type === 'sibling' && dropTarget.index === idx + 1
                  return (
                  <div
                    key={idx}
                    ref={(el) => {
                      if (el) rowRefs.current.set(idx, el)
                      else rowRefs.current.delete(idx)
                    }}
                    onMouseDown={(e) => {
                      if (readOnlyWbs) return
                      if (e.button !== 0) return
                      const target = e.target as HTMLElement
                      if (target.closest('input') || target.closest('button')) return
                      longPressTimerRef.current = setTimeout(() => {
                        longPressTimerRef.current = null
                        setDraggingIndex(idx)
                      }, LONG_PRESS_MS)
                    }}
                    onMouseUp={() => {
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current)
                        longPressTimerRef.current = null
                      }
                    }}
                    onMouseLeave={() => {
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current)
                        longPressTimerRef.current = null
                      }
                    }}
                    style={{
                      display: 'flex',
                      width: '100%',
                      minWidth: 0,
                      borderBottom: '1px solid #f1f5f9',
                      fontSize: '0.8rem',
                      alignItems: 'center',
                      opacity: isDragging ? 0.4 : 1,
                      backgroundColor: isDropChild
                        ? '#e0f2fe'
                        : idx % 2 === 1
                          ? 'rgba(248,250,252,0.6)'
                          : undefined,
                      position: 'relative',
                      userSelect: 'none',
                      transition: 'background-color 0.15s',
                    }}
                  >
                    {isDropSiblingBefore && (
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: 0,
                          height: 3,
                          backgroundColor: '#2A84D5',
                          zIndex: 10,
                        }}
                      />
                    )}
                    {isDropSiblingAfter && (
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          bottom: 0,
                          height: 3,
                          backgroundColor: '#2A84D5',
                          zIndex: 10,
                        }}
                      />
                    )}
                    <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.seq, minWidth: WBS_COLUMNS.seq, padding: '0.3rem 0.55rem', textAlign: 'center', color: '#64748b' }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.wbs, minWidth: WBS_COLUMNS.wbs, padding: '0.3rem 0.55rem', fontFamily: 'monospace' }}>
                      {t.wbsCode || '-'}
                    </div>
                    <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.level, minWidth: WBS_COLUMNS.level, padding: '0.3rem 0.55rem' }}>
                      <input
                        type="number"
                        min={1}
                        value={t.outlineLevel || 1}
                        readOnly={readOnlyWbs}
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
                    <div style={{ flex: '1 1 0%', minWidth: WBS_NAME_MIN, padding: '0.3rem 0.55rem' }}>
                      <input
                        type="text"
                        value={t.name}
                        readOnly={readOnlyWbs}
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
                    <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.progress, minWidth: WBS_COLUMNS.progress, padding: '0.3rem 0.55rem' }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={t.progressPercent != null ? t.progressPercent : ''}
                        readOnly={readOnlyWbs}
                        onChange={(e) => {
                          const raw = e.target.value.trim()
                          const num = raw === '' ? null : Math.min(100, Math.max(0, Number(raw) || 0))
                          handleChangeTask(idx, 'progressPercent', num)
                        }}
                        placeholder="0~100"
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
                    <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.date, minWidth: WBS_COLUMNS.date, padding: '0.3rem 0.55rem' }}>
                      <input
                        type="date"
                        value={toDateInputValue(t.startDate)}
                        readOnly={readOnlyWbs}
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
                    <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.date, minWidth: WBS_COLUMNS.date, padding: '0.3rem 0.55rem' }}>
                      <input
                        type="date"
                        value={toDateInputValue(t.finishDate)}
                        readOnly={readOnlyWbs}
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
                    <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.duration, minWidth: WBS_COLUMNS.duration, padding: '0.3rem 0.55rem' }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={t.durationDays ?? ''}
                        readOnly={readOnlyWbs}
                        onChange={(e) => {
                          const raw = e.target.value.trim()
                          handleChangeTask(
                            idx,
                            'durationDays',
                            raw === '' ? null : (Number(raw) || null)
                          )
                        }}
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
                    <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.predecessors, minWidth: WBS_COLUMNS.predecessors, padding: '0.3rem 0.55rem' }}>
                      <input
                        type="text"
                        value={t.predecessors || ''}
                        readOnly={readOnlyWbs}
                        onChange={(e) =>
                          handleChangeTask(idx, 'predecessors', e.target.value)
                        }
                        placeholder="예: 1FS;3FS;5FS"
                        style={{
                          width: '100%',
                          padding: '0.15rem 0.3rem',
                          border: '1px solid #d1d5db',
                          borderRadius: 3,
                          fontSize: '0.78rem',
                        }}
                      />
                    </div>
                    <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.assignee, minWidth: WBS_COLUMNS.assignee, padding: '0.3rem 0.55rem' }}>
                      <input
                        type="text"
                        value={t.assignee || ''}
                        readOnly={readOnlyWbs}
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
                        flex: '0 0 auto',
                        width: WBS_COLUMNS.indent,
                        minWidth: WBS_COLUMNS.indent,
                        padding: '0.3rem 0.55rem',
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
                        disabled={readOnlyWbs}
                      >
                        ◁
                      </button>
                      <button
                        type="button"
                        className="servicenow-button servicenow-button--secondary servicenow-button--sm"
                        onClick={() => handleIndent(idx, 1)}
                        disabled={readOnlyWbs}
                      >
                        ▷
                      </button>
                    </div>
                    <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.addChild, minWidth: WBS_COLUMNS.addChild, padding: '0.3rem 0.55rem', textAlign: 'center' }}>
                      <button
                        type="button"
                        className="servicenow-button servicenow-button--secondary servicenow-button--sm"
                        onClick={() => handleAddChildRow(idx)}
                        title="하위 레벨 행 추가"
                        disabled={readOnlyWbs}
                      >
                        + 하위
                      </button>
                    </div>
                    <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.delete, minWidth: WBS_COLUMNS.delete, padding: '0.3rem 0.55rem', textAlign: 'center' }}>
                      <button
                        type="button"
                        className="servicenow-button servicenow-button--danger servicenow-button--sm"
                        onClick={() => handleDeleteRow(idx)}
                        disabled={readOnlyWbs}
                        title="행 삭제"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  )
                })}
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
              {/* CP(Critical Path, 주공정) 안내 */}
              <div
                style={{
                  marginBottom: '0.5rem',
                  fontSize: '0.78rem',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span style={{ fontWeight: 600 }}>CP (Critical Path, 주공정)</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ color: '#c62828', fontWeight: 700 }}>●</span>
                  <span>● 표시는 공기(프로젝트 전체 기간)에 직접 영향을 주는 주공정 작업을 의미합니다.</span>
                </span>
              </div>

              {tasksLoading ? (
                <div className="placeholder">
                  <p>일정을 계산하는 중...</p>
                </div>
              ) : tasksError ? (
                <div className="placeholder">
                  <p>에러: {tasksError}</p>
                </div>
              ) : (
                <GanttTasksChart tasks={displayTasks} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}


