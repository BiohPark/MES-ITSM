'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parsePredecessorString, formatPredecessorString } from '@/lib/predecessor-parser'
import { GanttTasksChart, type GanttChartEvent } from './GanttTasksChart'

const LONG_PRESS_MS = 450

/** date input용 YYYY-MM-DD 정규화 */
function toDateInputValue(date: string | null | undefined): string {
  if (!date) return ''
  const d = date.includes('T') ? date.split('T')[0] : date
  return d || ''
}

/** 셀 표시용: YYYY-MM-DD → yymmdd (6자리, 예: 260216) */
function formatDateYymmdd(date: string | null | undefined): string {
  const normalized = toDateInputValue(date)
  if (!normalized || normalized.length < 10) return ''
  const yy = normalized.slice(2, 4)
  const mm = normalized.slice(5, 7)
  const dd = normalized.slice(8, 10)
  return `${yy}${mm}${dd}`
}

/** 입력값(yymmdd 6자리 또는 yyyymmdd 8자리)을 저장용 YYYY-MM-DD로 파싱. yy는 2000~2099 */
function parseDateToYyyyMmDd(raw: string): string | null {
  const s = raw.trim().replace(/-/g, '')
  let y: number, m: number, d: number
  if (s.length === 6) {
    const yy = parseInt(s.slice(0, 2), 10)
    y = yy >= 0 && yy <= 99 ? 2000 + yy : yy
    m = parseInt(s.slice(2, 4), 10)
    d = parseInt(s.slice(4, 6), 10)
  } else if (s.length === 8) {
    y = parseInt(s.slice(0, 4), 10)
    m = parseInt(s.slice(4, 6), 10)
    d = parseInt(s.slice(6, 8), 10)
  } else {
    return null
  }
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${y}-${pad(m)}-${pad(d)}`
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

/** 날짜 문자열을 YYYY-MM-DD로 정규화 (비교용, 다양한 API 형식 대응) */
function normalizeDateStr(s: string | null | undefined): string | null {
  if (s == null || s === '') return null
  const part = s.includes('T') ? s.split('T')[0]! : s
  const digits = part.replace(/-/g, '')
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  }
  if (part.match(/^\d{4}-\d{2}-\d{2}$/)) return part
  return null
}

/** 목록에서 해당 인덱스 행이 직접 자식(바로 다음 레벨)을 갖는지 여부 */
function hasDirectChildrenInList(
  list: { outlineLevel?: number }[],
  index: number
): boolean {
  const level = list[index]?.outlineLevel ?? 1
  for (let j = index + 1; j < list.length; j++) {
    const nextLevel = list[j].outlineLevel ?? 1
    if (nextLevel <= level) return false
    if (nextLevel === level + 1) return true
  }
  return false
}

/** 행 순서가 바뀐 경우(드래그 드롭 등), 기존 순서 기준 선행 인덱스를 새 순서 기준으로 재매핑 */
function remapPredecessorIndicesAfterReorder(
  original: GanttTask[],
  reordered: GanttTask[]
): GanttTask[] {
  if (original.length !== reordered.length) {
    return reordered
  }

  const result = reordered.map((t) => ({ ...t }))

  for (let i = 0; i < result.length; i++) {
    const raw = result[i].predecessors || ''
    if (!raw.trim()) continue
    const parsed = parsePredecessorString(raw)
    if (parsed.length === 0) continue

    const remapped = parsed.map((p) => {
      const oldIdx = p.index - 1
      const source = original[oldIdx]
      if (!source) return p
      // 동일 객체(참조) 기준으로 새 인덱스 찾기
      const newIdx = reordered.indexOf(source)
      if (newIdx === -1) return p
      return { ...p, index: newIdx + 1 }
    })

    result[i].predecessors = formatPredecessorString(remapped)
  }

  return result
}

/** 이슈 작업 여부: 시작일 지났는데 실적 0% / 종료일 지났는데 실적 100% 아님 (todayStr = YYYY-MM-DD) */
function isTaskIssue(
  t: { startDate?: string | null; finishDate?: string | null; progressPercent?: number | null },
  todayStr: string
): boolean {
  const start = normalizeDateStr(t.startDate ?? null)
  const finish = normalizeDateStr(t.finishDate ?? null)
  const p = Math.round(Number(t.progressPercent ?? 0))
  return (
    (!!start && todayStr > start && p === 0) ||
    (!!finish && todayStr > finish && p < 100)
  )
}

/** 반응형 컬럼 스타일 - 고정 너비 컬럼 (flex: 0 0 auto), 레벨 컬럼 제거(작업명 들여쓰기로 대체) */
/** WBS 최대 레벨 (이 레벨에서는 하위 조정·+하위 비활성화) */
const WBS_MAX_LEVEL = 5

const WBS_COLUMNS = {
  seq: 'clamp(2rem, 2.2vw, 2.5rem)',
  wbs: 'clamp(3rem, 4vw, 4.5rem)',
  issue: '1.75rem',
  date: 'clamp(5.5rem, 7vw, 8rem)',
  duration: 'clamp(3rem, 3.5vw, 4rem)',
  progress: 'clamp(3.5rem, 4vw, 5rem)',
  predecessors: 'clamp(5rem, 6.5vw, 8rem)',
  assignee: 'clamp(5rem, 6vw, 7.5rem)',
  indent: 'clamp(3rem, 3.5vw, 4rem)',
  addChild: 'clamp(4.75rem, 5.5vw, 6rem)',
  delete: 'clamp(2.5rem, 2.8vw, 3rem)',
} as const
/** 작업명 셀 레벨당 들여쓰기(px) */
const WBS_LEVEL_INDENT_PX = 20
/** 작업명 컬럼: 남는 공간을 채움 (minWidth만 지정) */
const WBS_NAME_MIN = 'clamp(6rem, 9vw, 11rem)'
/** WBS 행 내 입력/버튼 공통 높이·스타일 (한 줄 정렬) */
const WBS_ROW_CELL = {
  minHeight: '1.85rem',
  padding: '0.2rem 0.35rem',
  border: '1px solid #d1d5db',
  borderRadius: 3,
  fontSize: '0.78rem',
  boxSizing: 'border-box' as const,
  lineHeight: 1.25,
}

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

export function GanttWorkspace({
  initialProjectId,
  onInitialProjectIdConsumed,
}: {
  initialProjectId?: number
  onInitialProjectIdConsumed?: () => void
} = {}) {
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'notStarted' | 'inProgress' | 'completed' | 'issue'>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [canEditWbs, setCanEditWbs] = useState<boolean | null>(null)
  /** 레벨 1 필터: null = 전체, number = 해당 레벨 1 행 인덱스(그 하위만 표시) */
  const [selectedLevel1Index, setSelectedLevel1Index] = useState<number | null>(null)
  /** 담당자 검증용 등록 사용자 목록 (name, username) */
  const [registeredUserNames, setRegisteredUserNames] = useState<Set<string>>(new Set())
  const [assigneeError, setAssigneeError] = useState<string | null>(null)
  /** 차트 이벤트 (특정 날짜 목표/마일스톤) - 프로젝트별 서버 저장 */
  const [chartEvents, setChartEvents] = useState<GanttChartEvent[]>([])
  /** 이벤트 추가 팝업: { date, name } */
  const [addEventModal, setAddEventModal] = useState<{ date: string; name: string } | null>(null)

  // 드래그 앤 드롭 상태
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<{ type: 'child'; index: number } | { type: 'sibling'; index: number } | null>(null)
  /** 형제(sibling) 드롭 후 한 번만 WBS 코드를 재할당하지 않고 기존 코드 유지 (2.1/2.2 뒤바뀜 방지) */
  const [preserveWbsCodeAfterReorder, setPreserveWbsCodeAfterReorder] = useState(false)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const autoSaveTimerRef = useRef<number | null>(null)
  const xmlFileInputRef = useRef<HTMLInputElement>(null)

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

  /** 내 일감에서 간트 작업 클릭 시 해당 프로젝트 선택 */
  useEffect(() => {
    if (initialProjectId == null || projects.length === 0) return
    const exists = projects.some((p) => p.id === initialProjectId)
    if (exists) {
      setSelectedProjectId(initialProjectId)
      onInitialProjectIdConsumed?.()
    }
  }, [initialProjectId, projects, onInitialProjectIdConsumed])

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

  /** 담당자 검증용: 등록된 사용자 목록 로드 (name, username) */
  useEffect(() => {
    let cancelled = false
    fetch('/api/users')
      .then((res) => res.ok ? res.json() : { users: [] })
      .then((data) => {
        if (cancelled) return
        const names = new Set<string>()
        ;(data.users || []).forEach((u: { name?: string; username?: string }) => {
          if (u.name) names.add(String(u.name).trim())
          if (u.username) names.add(String(u.username).trim())
        })
        setRegisteredUserNames(names)
      })
      .catch(() => {
        if (!cancelled) setRegisteredUserNames(new Set())
      })
    return () => { cancelled = true }
  }, [])

  const loadTasks = async (projectId: number) => {
    setTasksLoading(true)
    setTasksError(null)
    setPreserveWbsCodeAfterReorder(false)
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

  // 프로젝트 선택 시: 태스크 + 이벤트를 함께 로드 (이벤트는 서버에서 공유)
  useEffect(() => {
    let cancelled = false
    async function loadForProject(projectId: number) {
      await loadTasks(projectId)
      try {
        const res = await fetch(`/api/gantt/events?projectId=${projectId}`)
        if (!res.ok) throw new Error('이벤트를 불러오지 못했습니다.')
        const data = await res.json()
        if (!cancelled) {
          setChartEvents((data.events || []).map((e: any) => ({
            id: e.id,
            date: e.date,
            name: e.name,
          })))
        }
      } catch {
        if (!cancelled) setChartEvents([])
      }
    }

    if (selectedProjectId) {
      loadForProject(selectedProjectId)
    } else {
      setPreserveWbsCodeAfterReorder(false)
      setTasks([])
      setChartEvents([])
    }

    return () => {
      cancelled = true
    }
  }, [selectedProjectId])

  const handleAddRow = () => {
    if (!selectedProjectId) {
      alert('먼저 Gantt 프로젝트를 선택하거나 생성하세요.')
      return
    }
    setPreserveWbsCodeAfterReorder(false)
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
    setPreserveWbsCodeAfterReorder(false)
    setTasks((prev) => {
      const parent = prev[parentIndex]
      if (!parent) return prev
      const parentLevel = parent.outlineLevel ?? 1
      if (parentLevel >= WBS_MAX_LEVEL) return prev
      const childLevel = Math.min(parentLevel + 1, WBS_MAX_LEVEL)

      // 부모의 마지막 손자까지 포함한 전체 하위 트리 다음에 삽입 (기존 하위 작업 순서 유지)
      let insertAt = parentIndex + 1
      for (let i = parentIndex + 1; i < prev.length; i++) {
        const lv = prev[i].outlineLevel ?? 1
        if (lv <= parentLevel) break
        insertAt = i + 1
      }

      const nextSort =
        prev.length === 0 ? 1 : Math.max(...prev.map((t) => t.sortOrder ?? 1)) + 1
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
      // prev 기준 insertAt 위치에 새 행 삽입
      copy.splice(insertAt, 0, newTask)

      // 선행 작업 인덱스 보정:
      // prev 기준으로 insertAt 이후에 있던 행들은 모두 +1만큼 뒤로 밀렸으므로,
      // 해당 행들을 가리키던 모든 predecessor index도 +1 해준다.
      const insertedRowNumber = insertAt + 1 // 1-based
      for (let i = 0; i < copy.length; i++) {
        const raw = copy[i].predecessors || ''
        if (!raw.trim()) continue
        const parsed = parsePredecessorString(raw)
        if (parsed.length === 0) continue
        const adjusted = parsed.map((p) => {
          if (p.index >= insertedRowNumber) {
            return { ...p, index: p.index + 1 }
          }
          return p
        })
        copy[i] = {
          ...copy[i],
          predecessors: formatPredecessorString(adjusted),
        }
      }

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

      // 형제 순서만 바꾼 경우: WBS 코드를 위치로 재할당하지 않고 기존 코드 유지 (2.1/2.2 뒤바뀜 방지)
      if (targetType === 'sibling') {
        setPreserveWbsCodeAfterReorder(true)
        setTimeout(() => setPreserveWbsCodeAfterReorder(false), 0)
      }

      setTasks((prev) => {
        const original = [...prev]
        const copy = [...prev]
        const [dragged] = indices.map((i) => copy[i])
        const draggedLevel = dragged.outlineLevel ?? 1

        if (targetType === 'child') {
          const parent = copy[targetIndex]
          const parentLevel = parent.outlineLevel ?? 1
          if (parentLevel >= WBS_MAX_LEVEL) return prev
          const newLevel = Math.min(parentLevel + 1, WBS_MAX_LEVEL)

          // 부모의 마지막 손자까지 포함한 전체 하위 트리 다음에 삽입 (기존 하위 작업 순서 유지)
          let insertAt = targetIndex + 1
          for (let i = targetIndex + 1; i < copy.length; i++) {
            const lv = copy[i].outlineLevel ?? 1
            if (lv <= parentLevel) break
            insertAt = i + 1
          }

          const extracted = indices.sort((a, b) => b - a).map((i) => copy.splice(i, 1)[0])
          const removedBeforeInsert = indices.filter((i) => i < insertAt).length
          insertAt -= removedBeforeInsert
          const adjusted = extracted.map((t) => ({
            ...t,
            outlineLevel: Math.max(1, Math.min(WBS_MAX_LEVEL, newLevel + ((t.outlineLevel ?? 1) - draggedLevel))),
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

        // 행 순서가 바뀐 뒤, 기존 순서 대비 선행 인덱스를 재매핑
        return remapPredecessorIndicesAfterReorder(original, copy)
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

      // 기간(일) 수동 입력 시: 종료일 자동 설정 (시작일 있으면 시작+기간, 없으면 오늘 기준)
      if (field === 'durationDays' && value != null && Number(value) > 0) {
        const curr = copy[index]
        const dur = Math.max(1, Number(value))
        const start = curr.startDate ? curr.startDate : formatLocalDate(new Date())
        copy[index] = {
          ...copy[index],
          startDate: curr.startDate || start,
          finishDate: addDaysToDate(start, dur - 1),
        }
      }

      // 시작일 직접 변경 시: 기간(일)을 유지하면서 종료일 자동 업데이트
      if (field === 'startDate') {
        const curr = copy[index]
        const dur =
          curr.durationDays != null && Number(curr.durationDays) > 0
            ? Math.max(1, Number(curr.durationDays))
            : null
        if (curr.startDate && dur != null) {
          copy[index] = {
            ...curr,
            finishDate: addDaysToDate(curr.startDate, dur - 1),
          }
        }
      }

      // 선행 작업 지정 시: 유효성 검증 + 시작일 = (모든 선행 작업의 종료일 중 가장 늦은 날) + 1일
      if (field === 'predecessors') {
        const parsed = parsePredecessorString(value || '')

        // 선행 유효성 검증: 자기 자신/상위 작업/존재하지 않는 행은 허용하지 않음
        if (parsed.length > 0) {
          const selfRow = index + 1
          const selfLevel = prev[index]?.outlineLevel ?? 1
          // 상위(조상) 행 인덱스 수집
          const ancestorIndices: number[] = []
          let currentLevel = selfLevel
          for (let i = index - 1; i >= 0; i--) {
            const lv = prev[i]?.outlineLevel ?? 1
            if (lv < currentLevel) {
              ancestorIndices.push(i)
              currentLevel = lv
              if (currentLevel === 1) break
            }
          }

          for (const p of parsed) {
            // 존재하지 않는 행
            if (p.index < 1 || p.index > prev.length) {
              alert(`존재하지 않는 행(#${p.index})을 선행 작업으로 지정할 수 없습니다.`)
              return prev
            }
            // 자기 자신
            if (p.index === selfRow) {
              alert('자기 자신을 선행 작업으로 지정할 수 없습니다.')
              return prev
            }
            // 상위(조상) 작업
            if (ancestorIndices.includes(p.index - 1)) {
              alert('상위(조상) 작업을 선행 작업으로 지정할 수 없습니다.')
              return prev
            }
          }
        }

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

        // 종료일/기간/시작일 변경 시: 후속 작업들(선행 관계로 연결된 작업들) 전체를 다시 계산
        if (field === 'finishDate' || field === 'durationDays' || field === 'startDate') {
          for (let i = 0; i < copy.length; i++) {
            if (i === index) continue // 사용자가 직접 수정한 작업은 덮어쓰지 않음
            const parsed = parsePredecessorString(copy[i].predecessors || '')
            if (parsed.length === 0) continue

            const predIndices = parsed
              .map((p) => p.index - 1)
              .filter((pi) => pi >= 0 && pi < copy.length)

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
          
          // 상위 레벨의 시작일과 종료일 자동 계산 (로컬 날짜 기준, 타임존으로 ±1일 오류 방지)
          const childStartDates = childItems
            .map(item => item.startDate)
            .filter((date): date is string => date !== null && date !== undefined)
            .map(date => parseLocalDate(date).getTime())
          
          const childFinishDates = childItems
            .map(item => item.finishDate)
            .filter((date): date is string => date !== null && date !== undefined)
            .map(date => parseLocalDate(date).getTime())

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
    setTasks((prev) => {
      const deletedRowNumber = index + 1 // 1-based
      const remaining = prev.filter((_, i) => i !== index)

      // 삭제된 행 이후를 가리키던 선행 인덱스들은 -1, 삭제된 행 자체를 가리키던 인덱스는 제거
      const adjusted = remaining.map((t) => {
        const raw = t.predecessors || ''
        if (!raw.trim()) return t
        const parsed = parsePredecessorString(raw)
        if (parsed.length === 0) return t
        const fixed = parsed
          .filter((p) => p.index !== deletedRowNumber)
          .map((p) => ({
            ...p,
            index: p.index > deletedRowNumber ? p.index - 1 : p.index,
          }))
        return {
          ...t,
          predecessors: formatPredecessorString(fixed),
        }
      })

      return adjusted
    })
    setHasUnsavedChanges(true)
  }

  const handleIndent = (index: number, direction: 1 | -1) => {
    setPreserveWbsCodeAfterReorder(false)
    setTasks((prev) => {
      const currentLevel = prev[index]?.outlineLevel ?? 1
      if (direction === 1 && currentLevel >= WBS_MAX_LEVEL) return prev
      const copy = [...prev]
      const t = { ...copy[index] }
      t.outlineLevel = Math.max(1, Math.min(WBS_MAX_LEVEL, (t.outlineLevel || 1) + direction))
      copy[index] = t
      return copy
    })
    setHasUnsavedChanges(true)
  }

  const recomputeWbsCodes = (items: GanttTask[], preserveWbsCode = false): GanttTask[] => {
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

    // 1단계: WBS 코드 계산 (배열 순서 기준). 형제 드롭 후에는 기존 wbsCode 유지해 2.1/2.2 뒤바뀜 방지
    for (let i = 0; i < ordered.length; i++) {
      const t = ordered[i]
      const level = Math.max(1, t.outlineLevel || 1)
      let wbs: string
      if (preserveWbsCode && (t.wbsCode ?? '').trim()) {
        wbs = (t.wbsCode ?? '').trim()
      } else {
        counters.length = level
        counters[level - 1] = (counters[level - 1] || 0) + 1
        wbs = counters.slice(0, level).join('.')
      }
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

        // 하위 항목이 있는 경우, 시작일·종료일·실적 자동 계산 (로컬 날짜 기준, 타임존 ±1일 오류 방지)
        if (childItems.length > 0) {
          const childStartDates = childItems
            .map(item => item.startDate)
            .filter((date): date is string => date !== null && date !== undefined)
            .map(date => parseLocalDate(date).getTime())
          
          const childFinishDates = childItems
            .map(item => item.finishDate)
            .filter((date): date is string => date !== null && date !== undefined)
            .map(date => parseLocalDate(date).getTime())

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

          // 상위 실적 %: 하위가 있으면 항상 하위 기준 가중 평균(정수 반올림)으로 자동 반영 (요약 작업은 항상 자식 실적 반영)
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
            // 실적은 소수점 없이, 0~100 범위의 정수로 저장
            current.progressPercent = Math.min(100, Math.max(0, Math.round(agg)))
          }
        }
      }
    }

    return result
  }

  /** 표시용: WBS·날짜·기간이 재계산된 태스크 목록 (필터는 행 표시 시 적용, 인덱스 일치 유지) */
  const displayTasks = useMemo(
    () => recomputeWbsCodes(tasks, preserveWbsCodeAfterReorder),
    [tasks, preserveWbsCodeAfterReorder]
  )

  /** 각 행이 속한 레벨 1의 displayTasks 인덱스 (행 순서대로) */
  const rootLevel1IndexForRow = useMemo(() => {
    const result: number[] = []
    let lastL1 = -1
    for (let i = 0; i < displayTasks.length; i++) {
      if ((displayTasks[i].outlineLevel ?? 1) === 1) lastL1 = i
      result[i] = lastL1
    }
    return result
  }, [displayTasks])

  /** 레벨 1 작업만의 목록 (드롭다운용): { index, label } */
  const level1Options = useMemo(() => {
    return displayTasks
      .map((t, idx) => ({ index: idx, task: t }))
      .filter(({ task }) => (task.outlineLevel ?? 1) === 1)
      .map(({ index, task }) => ({
        index,
        label: `${task.wbsCode ?? ''} ${(task.name || '(이름 없음)').trim()}`.trim() || `레벨 1 #${index + 1}`,
      }))
  }, [displayTasks])

  /** 담당자 필터용 옵션 (현재 표시 중인 WBS 기준) */
  const assigneeOptions = useMemo(() => {
    const names = new Set<string>()
    displayTasks.forEach((t) => {
      const a = (t.assignee ?? '').trim()
      if (a) names.add(a)
    })
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'ko-KR'))
  }, [displayTasks])

  const todayStr = formatLocalDate(new Date())

  /** 필터 적용된 태스크 목록 (레벨1 + 상태 + 담당자 + 이슈, 차트/요약용) */
  const filteredDisplayTasks = useMemo(() => {
    return displayTasks.filter((t, idx) => {
      if (selectedLevel1Index != null && rootLevel1IndexForRow[idx] !== selectedLevel1Index) return false
      if (statusFilter !== 'all') {
        const p = Math.round(Number(t.progressPercent ?? 0))
        if (statusFilter === 'notStarted' && p !== 0) return false
        if (statusFilter === 'inProgress' && (p <= 0 || p >= 100)) return false
        if (statusFilter === 'completed' && p < 100) return false
        if (statusFilter === 'issue' && !isTaskIssue(t, todayStr)) return false
      }
      if (assigneeFilter !== '' && (t.assignee ?? '').trim() !== assigneeFilter) return false
      return true
    })
  }, [displayTasks, selectedLevel1Index, rootLevel1IndexForRow, statusFilter, assigneeFilter, todayStr])

  /** 필터 통과한 displayTasks 인덱스 집합 (WBS 테이블 행 표시/숨김용) */
  const filteredRowIndices = useMemo(() => {
    const set = new Set<number>()
    displayTasks.forEach((t, idx) => {
      if (selectedLevel1Index != null && rootLevel1IndexForRow[idx] !== selectedLevel1Index) return
      if (statusFilter !== 'all') {
        const p = Math.round(Number(t.progressPercent ?? 0))
        if (statusFilter === 'notStarted' && p !== 0) return
        if (statusFilter === 'inProgress' && (p <= 0 || p >= 100)) return
        if (statusFilter === 'completed' && p < 100) return
        if (statusFilter === 'issue' && !isTaskIssue(t, todayStr)) return
      }
      if (assigneeFilter !== '' && (t.assignee ?? '').trim() !== assigneeFilter) return
      set.add(idx)
    })
    return set
  }, [displayTasks, selectedLevel1Index, rootLevel1IndexForRow, statusFilter, assigneeFilter, todayStr])

  /** 프로젝트 실적 요약: 계획 기간, 계획 실적 %, 전체 실적 % (가중 평균, 필터 적용 목록 기준) */
  const projectProgressSummary = useMemo(() => {
    const empty = { planDays: 0, plannedProgress: 0, overallProgress: 0, startDate: null as string | null, finishDate: null as string | null, plannedProgressReason: '' as string }
    if (filteredDisplayTasks.length === 0) return empty
    const withDates = filteredDisplayTasks.filter((t) => t.startDate && t.finishDate)
    if (withDates.length === 0) return { ...empty, plannedProgressReason: '시작/종료일이 있는 작업이 없습니다.' }
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
    // 계획 실적: 오늘 기준으로 계획 기간(시작~종료) 중 경과한 비율
    let plannedProgress = 0
    let plannedProgressReason = ''
    if (!isNaN(startMs) && !isNaN(finishMs)) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayMs = today.getTime()
      if (todayMs < startMs) {
        plannedProgress = 0
        plannedProgressReason = '오늘이 프로젝트 시작일보다 이전이라 0%입니다.'
      } else if (todayMs >= finishMs) {
        plannedProgress = 100
        plannedProgressReason = '프로젝트 종료일이 지났습니다.'
      } else {
        const elapsedDays = Math.ceil((todayMs - startMs) / (1000 * 60 * 60 * 24))
        plannedProgress = Math.min(100, Math.max(0, (elapsedDays / planDays) * 100))
        plannedProgressReason = '오늘 기준 계획 기간 대비 경과율입니다.'
      }
    } else {
      plannedProgressReason = '시작/종료일을 확인할 수 없습니다.'
    }
    // 리프 작업만 가중 평균 (기간 기준)
    const leafTasks = filteredDisplayTasks.filter((t, i) => {
      const currLevel = t.outlineLevel ?? 1
      const nextLevel = i + 1 < filteredDisplayTasks.length ? (filteredDisplayTasks[i + 1].outlineLevel ?? 1) : 0
      return nextLevel <= currLevel
    })
    const withDuration = leafTasks.filter((t) => (t.durationDays ?? 0) > 0)
    let overallProgress = 0
    if (withDuration.length > 0) {
      const totalWeight = withDuration.reduce((s, t) => s + (t.durationDays ?? 0), 0)
      const weightedSum = withDuration.reduce((s, t) => s + (t.progressPercent ?? 0) * (t.durationDays ?? 0), 0)
      overallProgress = totalWeight > 0 ? (weightedSum / totalWeight) : 0
    } else if (leafTasks.length > 0) {
      overallProgress = leafTasks.reduce((s, t) => s + (t.progressPercent ?? 0), 0) / leafTasks.length
    }
    // 요약 출력 시에는 toFixed(1)로 표시하지만, 내부 값도 0~100 범위로 정규화
    return {
      planDays,
      plannedProgress: Math.min(100, Math.max(0, plannedProgress)),
      overallProgress: Math.min(100, Math.max(0, overallProgress)),
      startDate: minStart,
      finishDate: maxFinish,
      plannedProgressReason,
    }
  }, [filteredDisplayTasks])

  /** 작업 지표: 전체 / 미시작 / 진행 중 / 완료 / 이슈 (필터 적용 목록 기준) */
  const taskStats = useMemo(() => {
    const total = filteredDisplayTasks.length
    let notStarted = 0
    let inProgress = 0
    let completed = 0
    let issues = 0
    for (const t of filteredDisplayTasks) {
      const p = t.progressPercent ?? 0
      if (p >= 100) completed++
      else if (p > 0) inProgress++
      else notStarted++
      if (isTaskIssue(t, todayStr)) issues++
    }
    return { total, notStarted, inProgress, completed, issues }
  }, [filteredDisplayTasks, todayStr])

  /** 이슈 작업의 task.id 집합 (간트 차트 강조용) */
  const issueTaskIds = useMemo(
    () =>
      new Set(
        filteredDisplayTasks
          .filter((t) => isTaskIssue(t, todayStr))
          .map((t) => t.id)
          .filter((id): id is number => typeof id === 'number')
      ),
    [filteredDisplayTasks, todayStr]
  )

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
        // 부모(요약) 행은 재계산된 실적 저장, 리프는 원본 실적 유지
        const toSave = normalized.map((n, i) => ({
          ...n,
          progressPercent: hasDirectChildrenInList(normalized, i)
            ? n.progressPercent
            : (tasks[i]?.progressPercent ?? n.progressPercent),
        }))
        await fetch(`/api/gantt/tasks/${selectedProjectId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tasks: toSave }),
        })
        setHasUnsavedChanges(false)
      } catch (err) {
        console.error('자동 저장 실패', err)
        // 조용히 로그만 남기고, 사용자는 필요 시 수동 저장 버튼을 다시 눌러 복구할 수 있도록 둔다.
      }
    }, 800)

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
    setAssigneeError(null)
    const normalized = recomputeWbsCodes(tasks)
    for (const t of normalized) {
      const assignee = (t.assignee ?? '').trim()
      if (assignee && !registeredUserNames.has(assignee)) {
        setAssigneeError(`담당자 "${assignee}"(은)는 등록된 사용자가 아닙니다. 사용자 관리에서 등록 후 선택해 주세요.`)
        return
      }
    }
    // 부모(요약) 행은 재계산된 실적 저장, 리프는 원본 실적 유지
    const toSave = normalized.map((n, i) => ({
      ...n,
      progressPercent: hasDirectChildrenInList(normalized, i)
        ? n.progressPercent
        : (tasks[i]?.progressPercent ?? n.progressPercent),
    }))
    setHasUnsavedChanges(false)
    setTasks(normalized)
    setTasksLoading(true)
    try {
      const res = await fetch(`/api/gantt/tasks/${selectedProjectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tasks: toSave }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = data.details ? `${data.error || '태스크 저장 실패'}: ${data.details}` : (data.error || '태스크 저장 실패')
        throw new Error(msg)
      }
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

  const handleImportXml = async (fileArg?: File | null) => {
    const f = fileArg ?? xmlFile
    if (!f) {
      alert('XML 파일을 선택하세요.')
      return
    }
    setImporting(true)
    try {
      const form = new FormData()
      form.append('file', f)
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
      if (xmlFileInputRef.current) xmlFileInputRef.current.value = ''
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

  const handleExportExcel = async () => {
    if (!selectedProjectId) {
      alert('먼저 Gantt 프로젝트를 선택하세요.')
      return
    }
    try {
      const res = await fetch(`/api/gantt/export-excel/${selectedProjectId}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Excel Export 실패')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gantt_project_${selectedProjectId}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('Failed to export excel', err)
      alert(err.message || 'Excel Export 실패')
    }
  }

  return (
    <div className="table-wrapper">
      <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Gantt 프로젝트 및 WBS 편집</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            ref={xmlFileInputRef}
            type="file"
            accept=".xml,application/xml,text/xml"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImportXml(file)
              e.target.value = ''
            }}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="servicenow-button servicenow-button--secondary"
            onClick={() => xmlFileInputRef.current?.click()}
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
          <button
            type="button"
            className="servicenow-button servicenow-button--secondary"
            onClick={handleExportExcel}
          >
            Excel Export
          </button>
        </div>
      </div>

      {/* 상단 툴바 영역 - 프로젝트 선택/생성만 (XML은 헤더 우측으로 이동) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
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
              marginBottom: '0.5rem',
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

          {/* 작업 지표 (WBS·간트 차트 공통) */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem 1.25rem',
              padding: '0.5rem 1rem',
              marginBottom: '0.5rem',
              backgroundColor: '#f8fafc',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              fontSize: '0.875rem',
            }}
          >
            <span style={{ color: '#475569', fontWeight: 600 }}>작업 지표</span>
            <span style={{ color: '#64748b' }}>
              전체 <strong style={{ color: '#0f172a', marginLeft: '0.25rem' }}>{taskStats.total}</strong>개
            </span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span style={{ color: '#64748b' }}>
              미시작 <strong style={{ color: '#64748b', marginLeft: '0.25rem' }}>{taskStats.notStarted}</strong>개
            </span>
            <span style={{ color: '#64748b' }}>
              진행 중 <strong style={{ color: '#2A84D5', marginLeft: '0.25rem' }}>{taskStats.inProgress}</strong>개
            </span>
            <span style={{ color: '#64748b' }}>
              완료 <strong style={{ color: '#059669', marginLeft: '0.25rem' }}>{taskStats.completed}</strong>개
            </span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span style={{ color: '#64748b' }}>
              이슈 <strong style={{ color: '#dc2626', marginLeft: '0.25rem' }}>{taskStats.issues}</strong>개
            </span>
          </div>

          {/* 계획 대비 실적 요약 (WBS·간트 차트 공통) */}
          {displayTasks.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: '1.5rem',
                padding: '0.5rem 1rem',
                marginBottom: '0.5rem',
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
                <strong
                  style={{ fontSize: '1.05rem', color: '#64748b', cursor: projectProgressSummary.plannedProgressReason ? 'help' : undefined }}
                  title={projectProgressSummary.plannedProgressReason || undefined}
                >
                  {Number.isFinite(projectProgressSummary.plannedProgress) ? Math.round(projectProgressSummary.plannedProgress) : 0}%
                </strong>
                <span style={{ color: '#cbd5e1', margin: '0 0.25rem' }}>{' | '}</span>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>전체 실적</span>
                <strong style={{ fontSize: '1.1rem', color: '#2A84D5' }}>
                  {Number.isFinite(projectProgressSummary.overallProgress) ? Math.round(projectProgressSummary.overallProgress) : 0}%
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
                    width: `${Math.min(100, Math.max(0, Number.isFinite(projectProgressSummary.overallProgress) ? Math.round(projectProgressSummary.overallProgress) : 0))}%`,
                    height: '100%',
                    backgroundColor: '#2A84D5',
                    transition: 'width 0.2s',
                  }}
                />
              </div>
            </div>
          )}

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
              {assigneeError && (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.4)',
                  }}
                  onClick={() => setAssigneeError(null)}
                >
                  <div
                    style={{
                      background: '#fff',
                      padding: '1.25rem 1.5rem',
                      borderRadius: 12,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                      maxWidth: 420,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p style={{ margin: 0, marginBottom: '1rem', color: '#b91c1c', fontWeight: 500 }}>{assigneeError}</p>
                    <button
                      type="button"
                      className="servicenow-button servicenow-button--primary"
                      onClick={() => setAssigneeError(null)}
                    >
                      확인
                    </button>
                  </div>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#475569' }}>
                    <span style={{ whiteSpace: 'nowrap' }}>레벨 1 보기:</span>
                    <select
                      value={selectedLevel1Index == null ? '' : String(selectedLevel1Index)}
                      onChange={(e) => {
                        const v = e.target.value
                        setSelectedLevel1Index(v === '' ? null : parseInt(v, 10))
                      }}
                      style={{
                        minWidth: '12rem',
                        padding: '0.35rem 0.5rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        fontSize: '0.8rem',
                        color: '#334155',
                      }}
                    >
                      <option value="">전체</option>
                      {level1Options.map((opt) => (
                        <option key={opt.index} value={opt.index}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#475569' }}>
                    <span style={{ whiteSpace: 'nowrap' }}>상태</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                      style={{
                        minWidth: 90,
                        padding: '0.35rem 0.5rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        fontSize: '0.8rem',
                        color: '#334155',
                      }}
                    >
                      <option value="all">전체</option>
                      <option value="notStarted">미시작</option>
                      <option value="inProgress">진행 중</option>
                      <option value="completed">완료</option>
                      <option value="issue">이슈 ❗</option>
                    </select>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#475569' }}>
                    <span style={{ whiteSpace: 'nowrap' }}>담당자</span>
                    <select
                      value={assigneeFilter}
                      onChange={(e) => setAssigneeFilter(e.target.value)}
                      style={{
                        minWidth: 100,
                        padding: '0.35rem 0.5rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        fontSize: '0.8rem',
                        color: '#334155',
                      }}
                    >
                      <option value="">전체</option>
                      {assigneeOptions.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
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
              <div style={{ width: '100%', minWidth: 0, maxHeight: 'min(75vh, 720px)', overflow: 'auto' }}>
                <div
                  style={{
                    display: 'flex',
                    width: '100%',
                    minWidth: 0,
                    minHeight: '2.25rem',
                    alignItems: 'center',
                    background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
                    borderBottom: '2px solid #e2e8f0',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: '#475569',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.seq, minWidth: WBS_COLUMNS.seq, padding: '0.3rem 0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>#</div>
                  <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.wbs, minWidth: WBS_COLUMNS.wbs, padding: '0.3rem 0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>WBS</div>
                  <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.issue, minWidth: WBS_COLUMNS.issue, padding: '0.3rem 0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                  <div style={{ flex: '1 1 0%', minWidth: WBS_NAME_MIN, padding: '0.3rem 0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>작업명</div>
                  <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.progress, minWidth: WBS_COLUMNS.progress, padding: '0.3rem 0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}>실적(%)</div>
                  <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.date, minWidth: WBS_COLUMNS.date, padding: '0.3rem 0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>시작</div>
                  <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.date, minWidth: WBS_COLUMNS.date, padding: '0.3rem 0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>종료</div>
                  <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.duration, minWidth: WBS_COLUMNS.duration, padding: '0.3rem 0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}>기간(일)</div>
                  <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.predecessors, minWidth: WBS_COLUMNS.predecessors, padding: '0.3rem 0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>선행 작업</div>
                  <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.assignee, minWidth: WBS_COLUMNS.assignee, padding: '0.3rem 0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>담당자</div>
                  <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.indent, minWidth: WBS_COLUMNS.indent, padding: '0.3rem 0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>조정</div>
                  <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.addChild, minWidth: WBS_COLUMNS.addChild, padding: '0.3rem 0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>하위</div>
                  <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.delete, minWidth: WBS_COLUMNS.delete, padding: '0.3rem 0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>삭제</div>
                </div>
                {displayTasks.map((t, idx) => {
                  if (!filteredRowIndices.has(idx)) return null

                  const isDragging = draggingIndex != null && getDraggedSubtreeIndices(draggingIndex).includes(idx)
                  const isDropChild = dropTarget?.type === 'child' && dropTarget.index === idx
                  const isDropSiblingBefore = dropTarget?.type === 'sibling' && dropTarget.index === idx
                  const isDropSiblingAfter = dropTarget?.type === 'sibling' && dropTarget.index === idx + 1

                  // 요약(부모) 행 여부: 바로 아래에 더 높은 레벨(=자식)이 존재하면 요약 행으로 간주
                  const currentLevel = t.outlineLevel ?? 1
                  let hasChildren = false
                  for (let j = idx + 1; j < displayTasks.length; j++) {
                    const nextLevel = displayTasks[j].outlineLevel ?? 1
                    if (nextLevel <= currentLevel) break
                    if (nextLevel === currentLevel + 1) {
                      hasChildren = true
                      break
                    }
                  }
                  const isSummaryRow = hasChildren

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
                      minHeight: '2.25rem',
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
                    <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.issue, minWidth: WBS_COLUMNS.issue, padding: '0.3rem 0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isTaskIssue(t, todayStr) ? <span aria-hidden>❗</span> : null}
                    </div>
                    <div
                      style={{
                        flex: '1 1 0%',
                        minWidth: WBS_NAME_MIN,
                        padding: '0.3rem 0.55rem',
                        paddingLeft: `${0.3 + ((t.outlineLevel ?? 1) - 1) * (WBS_LEVEL_INDENT_PX / 16)}rem`,
                      }}
                    >
                      <input
                        type="text"
                        value={t.name}
                        readOnly={readOnlyWbs}
                        onChange={(e) =>
                          handleChangeTask(idx, 'name', e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (!readOnlyWbs) {
                              void handleSaveTasks()
                            }
                          }
                        }}
                        placeholder="작업명"
                        style={{
                          width: '100%',
                          minHeight: WBS_ROW_CELL.minHeight,
                          padding: WBS_ROW_CELL.padding,
                          border: WBS_ROW_CELL.border,
                          borderRadius: WBS_ROW_CELL.borderRadius,
                          fontSize: WBS_ROW_CELL.fontSize,
                          boxSizing: WBS_ROW_CELL.boxSizing,
                          lineHeight: WBS_ROW_CELL.lineHeight,
                          ...(isTaskIssue(t, todayStr)
                            ? { color: '#dc2626', fontWeight: 700 }
                            : {}),
                        }}
                      />
                    </div>
                    <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.progress, minWidth: WBS_COLUMNS.progress, padding: '0.3rem 0.55rem' }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={t.progressPercent != null ? Math.round(t.progressPercent) : ''}
                        readOnly={readOnlyWbs || isSummaryRow}
                        onChange={(e) => {
                          const raw = e.target.value.trim()
                          const parsed = raw === '' ? null : Number(raw)
                          const rounded = parsed == null || Number.isNaN(parsed) ? null : Math.round(parsed)
                          const num = rounded === null ? null : Math.min(100, Math.max(0, rounded))
                          handleChangeTask(idx, 'progressPercent', num)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (!readOnlyWbs) {
                              void handleSaveTasks()
                            }
                          }
                        }}
                        placeholder="0~100"
                        style={{
                          width: '100%',
                          minHeight: WBS_ROW_CELL.minHeight,
                          padding: WBS_ROW_CELL.padding,
                          border: WBS_ROW_CELL.border,
                          borderRadius: WBS_ROW_CELL.borderRadius,
                          fontSize: WBS_ROW_CELL.fontSize,
                          boxSizing: WBS_ROW_CELL.boxSizing,
                          textAlign: 'right',
                        }}
                      />
                    </div>
                    <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.date, minWidth: WBS_COLUMNS.date, padding: '0.3rem 0.55rem' }}>
                      <input
                        key={`start-${idx}-${t.startDate ?? ''}`}
                        type="text"
                        inputMode="numeric"
                        placeholder="yymmdd"
                        defaultValue={formatDateYymmdd(t.startDate)}
                        readOnly={readOnlyWbs || isSummaryRow}
                        onBlur={(e) => {
                          const raw = e.target.value.trim().replace(/-/g, '')
                          const parsed = raw === '' ? null : parseDateToYyyyMmDd(e.target.value)
                          if (raw === '' || parsed !== null) handleChangeTask(idx, 'startDate', parsed)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const raw = e.currentTarget.value.trim().replace(/-/g, '')
                            const parsed = raw === '' ? null : parseDateToYyyyMmDd(e.currentTarget.value)
                            if (raw === '' || parsed !== null) {
                              handleChangeTask(idx, 'startDate', parsed)
                              if (!readOnlyWbs) {
                                void handleSaveTasks()
                              }
                            }
                          }
                        }}
                        style={{
                          width: '100%',
                          minHeight: WBS_ROW_CELL.minHeight,
                          padding: WBS_ROW_CELL.padding,
                          border: WBS_ROW_CELL.border,
                          borderRadius: WBS_ROW_CELL.borderRadius,
                          fontSize: WBS_ROW_CELL.fontSize,
                          boxSizing: WBS_ROW_CELL.boxSizing,
                          textAlign: 'center',
                        }}
                      />
                    </div>
                    <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.date, minWidth: WBS_COLUMNS.date, padding: '0.3rem 0.55rem' }}>
                      <input
                        key={`finish-${idx}-${t.finishDate ?? t.startDate ?? ''}`}
                        type="text"
                        inputMode="numeric"
                        placeholder="yymmdd"
                        defaultValue={formatDateYymmdd(t.finishDate ?? t.startDate ?? null)}
                        readOnly={readOnlyWbs || isSummaryRow}
                        onBlur={(e) => {
                          const raw = e.target.value.trim().replace(/-/g, '')
                          const parsed = raw === '' ? null : parseDateToYyyyMmDd(e.target.value)
                          if (raw === '' || parsed !== null) handleChangeTask(idx, 'finishDate', parsed)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const raw = e.currentTarget.value.trim().replace(/-/g, '')
                            const parsed = raw === '' ? null : parseDateToYyyyMmDd(e.currentTarget.value)
                            if (raw === '' || parsed !== null) {
                              handleChangeTask(idx, 'finishDate', parsed)
                              if (!readOnlyWbs) {
                                void handleSaveTasks()
                              }
                            }
                          }
                        }}
                        style={{
                          width: '100%',
                          minHeight: WBS_ROW_CELL.minHeight,
                          padding: WBS_ROW_CELL.padding,
                          border: WBS_ROW_CELL.border,
                          borderRadius: WBS_ROW_CELL.borderRadius,
                          fontSize: WBS_ROW_CELL.fontSize,
                          boxSizing: WBS_ROW_CELL.boxSizing,
                          textAlign: 'center',
                        }}
                      />
                    </div>
                    <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.duration, minWidth: WBS_COLUMNS.duration, padding: '0.3rem 0.55rem' }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={t.durationDays ?? ''}
                        readOnly={readOnlyWbs || isSummaryRow}
                        onChange={(e) => {
                          const raw = e.target.value.trim()
                          handleChangeTask(
                            idx,
                            'durationDays',
                            raw === '' ? null : (Number(raw) || null)
                          )
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (!readOnlyWbs) {
                              void handleSaveTasks()
                            }
                          }
                        }}
                        style={{
                          width: '100%',
                          minHeight: WBS_ROW_CELL.minHeight,
                          padding: WBS_ROW_CELL.padding,
                          border: WBS_ROW_CELL.border,
                          borderRadius: WBS_ROW_CELL.borderRadius,
                          fontSize: WBS_ROW_CELL.fontSize,
                          boxSizing: WBS_ROW_CELL.boxSizing,
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
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (!readOnlyWbs) {
                              void handleSaveTasks()
                            }
                          }
                        }}
                        placeholder="예: 1FS;3FS;5FS"
                        style={{
                          width: '100%',
                          minHeight: WBS_ROW_CELL.minHeight,
                          padding: WBS_ROW_CELL.padding,
                          border: WBS_ROW_CELL.border,
                          borderRadius: WBS_ROW_CELL.borderRadius,
                          fontSize: WBS_ROW_CELL.fontSize,
                          boxSizing: WBS_ROW_CELL.boxSizing,
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
                        onBlur={() => {
                          const assignee = (t.assignee ?? '').trim()
                          if (assignee && registeredUserNames.size > 0 && !registeredUserNames.has(assignee)) {
                            setAssigneeError(`담당자 "${assignee}"(은)는 등록된 사용자가 아닙니다. 사용자 관리에서 등록 후 선택해 주세요.`)
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (!readOnlyWbs) {
                              void handleSaveTasks()
                            }
                          }
                        }}
                        placeholder="담당자"
                        style={{
                          width: '100%',
                          minHeight: WBS_ROW_CELL.minHeight,
                          padding: WBS_ROW_CELL.padding,
                          border: WBS_ROW_CELL.border,
                          borderRadius: WBS_ROW_CELL.borderRadius,
                          fontSize: WBS_ROW_CELL.fontSize,
                          boxSizing: WBS_ROW_CELL.boxSizing,
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
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <button
                        type="button"
                        className="servicenow-button servicenow-button--secondary servicenow-button--sm"
                        onClick={() => handleIndent(idx, -1)}
                        disabled={readOnlyWbs}
                        style={{ minHeight: WBS_ROW_CELL.minHeight, padding: WBS_ROW_CELL.padding, lineHeight: 1 }}
                      >
                        ◁
                      </button>
                      <button
                        type="button"
                        className="servicenow-button servicenow-button--secondary servicenow-button--sm"
                        onClick={() => handleIndent(idx, 1)}
                        disabled={readOnlyWbs || (t.outlineLevel ?? 1) >= WBS_MAX_LEVEL}
                        title={(t.outlineLevel ?? 1) >= WBS_MAX_LEVEL ? `레벨 ${WBS_MAX_LEVEL}까지만 허용됩니다` : '하위로'}
                        style={{ minHeight: WBS_ROW_CELL.minHeight, padding: WBS_ROW_CELL.padding, lineHeight: 1 }}
                      >
                        ▷
                      </button>
                    </div>
                    <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.addChild, minWidth: WBS_COLUMNS.addChild, padding: '0.3rem 0.55rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <button
                        type="button"
                        className="servicenow-button servicenow-button--secondary servicenow-button--sm"
                        onClick={() => handleAddChildRow(idx)}
                        title={(t.outlineLevel ?? 1) >= WBS_MAX_LEVEL ? `레벨 ${WBS_MAX_LEVEL}까지만 허용됩니다` : '하위 레벨 행 추가'}
                        disabled={readOnlyWbs || (t.outlineLevel ?? 1) >= WBS_MAX_LEVEL}
                        style={{ minHeight: WBS_ROW_CELL.minHeight, padding: WBS_ROW_CELL.padding, lineHeight: 1, whiteSpace: 'nowrap' }}
                      >
                        + 하위
                      </button>
                    </div>
                    <div style={{ flex: '0 0 auto', width: WBS_COLUMNS.delete, minWidth: WBS_COLUMNS.delete, padding: '0.3rem 0.55rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <button
                        type="button"
                        className="servicenow-button servicenow-button--danger servicenow-button--sm"
                        onClick={() => handleDeleteRow(idx)}
                        disabled={readOnlyWbs}
                        title="행 삭제"
                        style={{ minHeight: WBS_ROW_CELL.minHeight, padding: WBS_ROW_CELL.padding, lineHeight: 1 }}
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
                <GanttTasksChart
                  tasks={filteredDisplayTasks}
                  events={chartEvents}
                  issueTaskIds={issueTaskIds}
                onDoubleClickDate={(date) => setAddEventModal({ date, name: '' })}
                onDeleteEvent={async (ev) => {
                  if (typeof window !== 'undefined' && window.confirm(`이벤트 "${ev.name || '(이벤트)'}"을(를) 삭제할까요?`)) {
                    const next = chartEvents.filter(
                      (e) =>
                        !(
                          (ev.id != null && e.id === ev.id) ||
                          (ev.id == null && e.date === e.date && e.name === ev.name)
                        )
                    )
                    setChartEvents(next)
                    if (selectedProjectId) {
                      try {
                        const payload = {
                          projectId: selectedProjectId,
                          events: next.map((e) => ({ date: e.date, name: e.name })),
                        }
                        await fetch('/api/gantt/events', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(payload),
                        })
                      } catch (err) {
                        console.error('Failed to delete gantt event', err)
                      }
                    }
                  }
                }}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* 이벤트 추가 팝업 (차트 날짜 더블클릭 시) */}
      {addEventModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.4)',
          }}
          onClick={() => setAddEventModal(null)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: 8,
              padding: '1.25rem 1.5rem',
              minWidth: 320,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>이벤트 추가</h3>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#64748b' }}>날짜</p>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 500 }}>
              {(() => {
                const [y, m, d] = addEventModal.date.split('-').map(Number)
                const local = new Date(y, m - 1, d)
                return `${addEventModal.date.replace(/-/g, '.')} (${local.toLocaleDateString('ko-KR', { weekday: 'short' })})`
              })()}
            </p>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
              이벤트명
            </label>
            <input
              type="text"
              value={addEventModal.name}
              onChange={(e) => setAddEventModal((prev) => (prev ? { ...prev, name: e.target.value } : null))}
              placeholder="예: 출시 목표, 검토 회의"
              autoFocus
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.5rem 0.6rem',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: '0.9rem',
                marginBottom: '1rem',
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setAddEventModal(null)}
                style={{
                  padding: '0.45rem 0.9rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  backgroundColor: '#fff',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={async () => {
                  const name = (addEventModal?.name ?? '').trim() || '이벤트'
                  const newEvent: GanttChartEvent = {
                    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ev-${Date.now()}`,
                    date: addEventModal!.date,
                    name,
                  }
                  setChartEvents((prev) => [...prev, newEvent])
                  setAddEventModal(null)

                  if (selectedProjectId) {
                    try {
                      const payload = {
                        projectId: selectedProjectId,
                        events: [...chartEvents, newEvent].map((e) => ({
                          date: e.date,
                          name: e.name,
                        })),
                      }
                      await fetch('/api/gantt/events', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                      })
                    } catch (err) {
                      console.error('Failed to save gantt events', err)
                    }
                  }
                }}
                style={{
                  padding: '0.45rem 0.9rem',
                  border: 'none',
                  borderRadius: 6,
                  backgroundColor: '#ea580c',
                  color: '#fff',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


