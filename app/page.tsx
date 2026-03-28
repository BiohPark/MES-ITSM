'use client'

import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import type { MouseEvent } from 'react'
import type { Project, ProjectChild } from '@/types/project'
import { APP_VERSION, isValidTabKey, type TabKey } from '@/utils/constants'
import { useI18n, tabTranslationPath } from '@/lib/i18n'
import { buildNewProject, buildNewChild, buildNewGmpRecord, buildNewIssue, buildNewTicket, buildNewValPackage } from '@/utils/project-utils'
import type { Issue } from '@/types/issue'
import type { Ticket, TicketType } from '@/types/ticket'
import { IssuesTable } from '@/components/issues/IssuesTable'
import { IssueEditModal } from '@/components/issues/IssueEditModal'
import { TicketsTable } from '@/components/tickets/TicketsTable'
import { TicketEditModal } from '@/components/tickets/TicketEditModal'
import { ApprovalInboxView } from '@/components/tickets/ApprovalInboxView'
import { NotificationsView } from '@/components/tickets/NotificationsView'
import { AuditLogView } from '@/components/tickets/AuditLogView'
import { TicketPoliciesView } from '@/components/tickets/TicketPoliciesView'
import { MeetingNotesView } from '@/components/meetings/MeetingNotesView'
import { MeetingNoteEditModal } from '@/components/meetings/MeetingNoteEditModal'
import { MeetingNoteTemplateModal } from '@/components/meetings/MeetingNoteTemplateModal'
import { ActionItemsView } from '@/components/action-items/ActionItemsView'
import type { MeetingNote } from '@/types/meeting'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { ProjectsTable } from '@/components/projects/ProjectsTable'
import { ProjectEditModal } from '@/components/projects/ProjectEditModal'
import { ValPackagesTable } from '@/components/val-packages/ValPackagesTable'
import { ValPackageEditModal } from '@/components/val-packages/ValPackageEditModal'
import { TasksTable } from '@/components/tasks/TasksTable'
import { TaskEditModal } from '@/components/tasks/TaskEditModal'
import { ChildItemModal } from '@/components/tasks/ChildItemModal'
import { PersonalTasksView, type GanttMyTaskItem } from '@/components/personal/PersonalTasksView'
import { GanttWorkspace } from '@/components/gantt/GanttWorkspace'
import { GanttHistoryView } from '@/components/gantt/GanttHistoryView'
import { SearchView } from '@/components/search/SearchView'
import { VocView } from '@/components/voc/VocView'
import { BackupView } from '@/components/backup/BackupView'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { ContextMenu } from '@/components/common/ContextMenu'
import { Placeholder } from '@/components/common/Placeholder'
import { SettingsIcon, SearchIcon } from '@/components/common/Icons'
import { ServiceNowLayout } from '@/components/layout/ServiceNowLayout'

export default function Home() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard')
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  // VAL Pkg 관련 상태
  const [valPackages, setValPackages] = useState<Project[]>([])
  const [valPackagesLoading, setValPackagesLoading] = useState(false)
  const [valPackagesError, setValPackagesError] = useState<string | null>(null)
  const [selectedValPackage, setSelectedValPackage] = useState<Project | null>(null)
  const [isValPackageEditing, setIsValPackageEditing] = useState(false)
  const [valPackageEditMode, setValPackageEditMode] = useState<'create' | 'edit'>('edit')
  const [selectedValPackageIds, setSelectedValPackageIds] = useState<Set<string>>(new Set())
  const [editMode, setEditMode] = useState<'create' | 'edit'>('edit')
  const [isEditing, setIsEditing] = useState(false)
  const [childTarget, setChildTarget] = useState<Project | null>(null)
  const [isChildModalOpen, setIsChildModalOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    project: Project
  } | null>(null)
  // 일감 관련 상태
  const [selectedTask, setSelectedTask] = useState<{
    task: ProjectChild
    projectId: string | null
    projectName: string
  } | null>(null)
  const [isTaskEditing, setIsTaskEditing] = useState(false)
  const [taskEditMode, setTaskEditMode] = useState<'create' | 'edit'>('edit')
  // 삭제 모드 관련 상태
  const [isDeleteMode, setIsDeleteMode] = useState(false)
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set())
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [searchOwner, setSearchOwner] = useState<string>('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [selectedChildIds, setSelectedChildIds] = useState<Set<string>>(new Set()) // 프로젝트 하위 아이템 삭제용
  // GMP Record 관련 상태
  const [gmpRecords, setGmpRecords] = useState<Array<ProjectChild & { projectId?: string | null; projectName?: string; kind_number?: string }>>([])
  const [gmpRecordsLoading, setGmpRecordsLoading] = useState(false)
  const [gmpRecordsError, setGmpRecordsError] = useState<string | null>(null)
  // Orphan tasks 관련 상태
  const [orphanTasks, setOrphanTasks] = useState<ProjectChild[]>([])
  // 이슈 관리 관련 상태
  const [issues, setIssues] = useState<Issue[]>([])
  const [issuesLoading, setIssuesLoading] = useState(false)
  const [issuesError, setIssuesError] = useState<string | null>(null)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [isIssueEditing, setIsIssueEditing] = useState(false)
  const [issueEditMode, setIssueEditMode] = useState<'create' | 'edit'>('edit')
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(new Set())
  // ITSM 티켓 관련 상태
  const [ticketsByType, setTicketsByType] = useState<Record<TicketType, Ticket[]>>({
    request: [],
    incident: [],
    problem: [],
    change: [],
  })
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [ticketsError, setTicketsError] = useState<string | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [isTicketEditing, setIsTicketEditing] = useState(false)
  const [ticketEditMode, setTicketEditMode] = useState<'create' | 'edit'>('edit')
  // 회의록 관련 상태
  const [meetingNotes, setMeetingNotes] = useState<MeetingNote[]>([])
  const [meetingNotesLoading, setMeetingNotesLoading] = useState(false)
  const [meetingNotesError, setMeetingNotesError] = useState<string | null>(null)
  const [selectedMeetingNote, setSelectedMeetingNote] = useState<MeetingNote | null>(null)
  const [isMeetingNoteEditing, setIsMeetingNoteEditing] = useState(false)
  const [meetingNoteEditMode, setMeetingNoteEditMode] = useState<'create' | 'edit'>('edit')
  const [templateMeetingNote, setTemplateMeetingNote] = useState<MeetingNote | null>(null)
  const [selectedMeetingNoteIds, setSelectedMeetingNoteIds] = useState<Set<string>>(new Set())
  const [meetingNoteSearchKeyword, setMeetingNoteSearchKeyword] = useState<string>('')
  // 인증 관련 상태
  const [user, setUser] = useState<{ id: string; username: string; name: string; role: 'admin' | 'user'; email?: string; isAdmin?: boolean } | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const appVersion = APP_VERSION.getFullVersion()
  // 간트 차트: 내 일감에서 클릭 시 해당 프로젝트로 열기
  const [ganttMyTasks, setGanttMyTasks] = useState<GanttMyTaskItem[]>([])
  const [pendingGanttProjectId, setPendingGanttProjectId] = useState<number | null>(null)
  const projectsDetailRef = useRef<'lite' | 'full'>('lite')
  const orphanTasksDetailRef = useRef<'lite' | 'full'>('lite')
  const deepLinkHandledRef = useRef(false)
  const loadedDataRef = useRef<{
    projects: boolean
    orphanTasks: boolean
    issues: boolean
    gmpRecords: boolean
    valPackages: boolean
    ganttMyTasks: boolean
    tickets: Record<TicketType, boolean>
  }>({
    projects: false,
    orphanTasks: false,
    issues: false,
    gmpRecords: false,
    valPackages: false,
    ganttMyTasks: false,
    tickets: {
      request: false,
      incident: false,
      problem: false,
      change: false,
    },
  })
  const normalizeProjects = useCallback((items: Project[]) => {
    return items.map((project) => ({
      ...project,
      children: project.children ?? [],
    }))
  }, [])
  const normalizeGmpRecords = useCallback((data: any[]) => {
    return data.map((record: any) => ({
      ...record,
      projectId: record.projectId || null,
      projectName: record.projectName || 'N/A',
      kind_number:
        record.kind_number ||
        (record.kind && record.number !== undefined
          ? `${record.kind}-${String(record.number || 0).padStart(5, '0')}`
          : 'CC-00000'),
    }))
  }, [])

  const applyProjectsPayload = useCallback((items?: Project[], detail: 'lite' | 'full' = 'full') => {
    if (!items) return
    setProjects(normalizeProjects(items))
    loadedDataRef.current.projects = true
    projectsDetailRef.current = detail
  }, [normalizeProjects])

  const applyOrphanTasksPayload = useCallback((items?: ProjectChild[], detail: 'lite' | 'full' = 'full') => {
    if (!items) return
    setOrphanTasks(items)
    loadedDataRef.current.orphanTasks = true
    orphanTasksDetailRef.current = detail
  }, [])

  useEffect(() => {
    let isMounted = true
    const abortController = new AbortController()

    const init = async () => {
      if (!isMounted) return
      await checkSession(abortController.signal)
      if (!isMounted) return
      await Promise.all([
        fetchProjects(abortController.signal, 'lite'),
        fetchOrphanTasks(abortController.signal, 'lite'),
        fetchIssues(abortController.signal),
      ])
    }

    init()

    return () => {
      isMounted = false
      abortController.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkSession = async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/auth', {
        credentials: 'include',
        signal,
      })
      if (signal?.aborted) return
      const data = await response.json()
      if (data.authenticated && data.user) {
        setUser(data.user)
      } else {
        // 세션이 없으면 로그인 페이지로 리다이렉트
        // middleware에서 이미 처리되지만, 클라이언트에서도 확인
        if (window.location.pathname !== '/login') {
        window.location.href = '/login'
        }
      }
    } catch (error) {
      if (signal?.aborted) return
      if (process.env.NODE_ENV === 'development') {
        console.error('Session check error:', error)
      }
      if (window.location.pathname !== '/login') {
      window.location.href = '/login'
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoadingSession(false)
      }
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'logout' }),
      })
      window.location.href = '/login'
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Logout error:', error)
      }
    }
  }

  const fetchProjects = useCallback(async (signal?: AbortSignal, detail: 'lite' | 'full' = 'full') => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/projects?detail=${detail}`, {
        cache: 'no-store',
        signal,
      })
      
      if (signal?.aborted) return
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `HTTP ${response.status}: Failed to fetch projects`
        
        // 데이터베이스 연결 오류인 경우 명확한 메시지
        if (errorData.code === 'DB_CONNECTION_ERROR' || response.status === 503) {
          throw new Error(t('page.errors.dbConnection'))
        }
        
        throw new Error(errorMessage)
      }
      const data = (await response.json()) as Project[]
      if (signal?.aborted) return
      
      applyProjectsPayload(data, detail)
    } catch (err: any) {
      if (signal?.aborted) return
      
      // 네트워크 오류 처리
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError(t('page.errors.network'))
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage)
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching projects:', err)
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }, [applyProjectsPayload, t])

  // Orphan tasks 가져오기
  const fetchOrphanTasks = useCallback(async (signal?: AbortSignal, detail: 'lite' | 'full' = 'full') => {
    try {
      const response = await fetch(`/api/projects?type=orphan-tasks&detail=${detail}`, {
        cache: 'no-store',
        signal,
      })
      if (signal?.aborted) return
      if (response.ok) {
        const data = await response.json()
        if (signal?.aborted) return
        applyOrphanTasksPayload(data || [], detail)
      } else {
        setOrphanTasks([])
      }
    } catch (error) {
      if (signal?.aborted) return
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching orphan tasks:', error)
      }
      setOrphanTasks([])
    }
  }, [applyOrphanTasksPayload])

  // GMP Record 관련 함수들
  const fetchGmpRecords = useCallback(async (signal?: AbortSignal) => {
    try {
      setGmpRecordsLoading(true)
      setGmpRecordsError(null)
      
      const response = await fetch('/api/gmp-records', {
        cache: 'no-store',
        signal,
      })
      
      if (signal?.aborted) return
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `HTTP ${response.status}: Failed to fetch GMP records`
        
        // 데이터베이스 연결 오류인 경우 명확한 메시지
        if (errorData.code === 'DB_CONNECTION_ERROR' || response.status === 503) {
          throw new Error(t('page.errors.dbConnection'))
        }
        
        throw new Error(errorMessage)
      }
      const data = (await response.json()) as any[]
      if (signal?.aborted) return
      setGmpRecords(normalizeGmpRecords(data))
      loadedDataRef.current.gmpRecords = true
    } catch (err) {
      if (signal?.aborted) return
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setGmpRecordsError(errorMessage)
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching GMP records:', err)
      }
    } finally {
      if (!signal?.aborted) {
        setGmpRecordsLoading(false)
      }
    }
  }, [normalizeGmpRecords, t])

  // VAL Pkg 관련 함수들
  const fetchValPackages = useCallback(async (signal?: AbortSignal) => {
    try {
      setValPackagesLoading(true)
      setValPackagesError(null)
      
      const response = await fetch('/api/val-packages', {
        cache: 'no-store',
        signal,
      })
      
      if (signal?.aborted) return
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch VAL Pkg`)
      }
      const data = (await response.json()) as Project[]
      if (signal?.aborted) return
      setValPackages(data)
      loadedDataRef.current.valPackages = true
    } catch (err) {
      if (signal?.aborted) return
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setValPackagesError(errorMessage)
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching VAL Pkg:', err)
      }
    } finally {
      if (!signal?.aborted) {
        setValPackagesLoading(false)
      }
    }
  }, [])

  // 이슈 관리 관련 함수들
  const fetchIssues = useCallback(async (signal?: AbortSignal) => {
    try {
      setIssuesLoading(true)
      setIssuesError(null)
      const response = await fetch('/api/issues', { 
        cache: 'no-store',
        signal,
      })
      if (signal?.aborted) return
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch issues`)
      }
      const data = (await response.json()) as Issue[]
      if (signal?.aborted) return
      setIssues(data)
      loadedDataRef.current.issues = true
    } catch (err) {
      if (signal?.aborted) return
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setIssuesError(errorMessage)
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching issues:', err)
      }
    } finally {
      if (!signal?.aborted) {
        setIssuesLoading(false)
      }
    }
  }, [])

  const getTicketTypeForTab = useCallback((tab: TabKey): TicketType | null => {
    if (tab === 'request' || tab === 'incident' || tab === 'problem' || tab === 'change') {
      return tab
    }
    return null
  }, [])

  const fetchTickets = useCallback(async (ticketType: TicketType, signal?: AbortSignal) => {
    try {
      setTicketsLoading(true)
      setTicketsError(null)
      const response = await fetch(`/api/tickets?ticketType=${ticketType}`, {
        cache: 'no-store',
        signal,
      })
      if (signal?.aborted) return
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch tickets`)
      }
      const data = await response.json()
      if (signal?.aborted) return
      setTicketsByType((prev) => ({
        ...prev,
        [ticketType]: data.tickets || [],
      }))
      loadedDataRef.current.tickets[ticketType] = true
    } catch (err) {
      if (signal?.aborted) return
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setTicketsError(errorMessage)
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching tickets:', err)
      }
    } finally {
      if (!signal?.aborted) {
        setTicketsLoading(false)
      }
    }
  }, [])

  const fetchGanttMyTasks = useCallback(async (signal?: AbortSignal) => {
    try {
      const ganttRes = await fetch('/api/gantt/my-tasks', {
        cache: 'no-store',
        signal,
      })
      if (signal?.aborted) return
      if (ganttRes.ok) {
        const ganttData = await ganttRes.json()
        if (signal?.aborted) return
        setGanttMyTasks(ganttData.tasks ?? [])
        loadedDataRef.current.ganttMyTasks = true
      } else {
        setGanttMyTasks([])
      }
    } catch {
      if (!signal?.aborted) {
        setGanttMyTasks([])
      }
    }
  }, [])

  const handleOpenTicketDetail = useCallback(async (ticketId: string) => {
    try {
      const response = await fetch(`/api/tickets?type=detail&id=${encodeURIComponent(ticketId)}`, {
        cache: 'no-store',
      })
      const data = await response.json()
      if (!response.ok || !data.ticket) {
        throw new Error(data.error || t('page.errors.ticketLoad'))
      }
      setSelectedTicket(data.ticket)
      setTicketEditMode('edit')
      setIsTicketEditing(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : t('page.errors.ticketLoad'))
    }
  }, [t])

  const handleCreateTicket = useCallback(async (ticketType: TicketType) => {
    const newTicket = await buildNewTicket(ticketType)
    setSelectedTicket({
      ...newTicket,
      requester_name: user?.name || '',
      requester_dept: '',
    })
    setTicketEditMode('create')
    setIsTicketEditing(true)
  }, [user?.name])

  const handleSaveTicket = useCallback(async (updatedTicket: Ticket) => {
    const action = ticketEditMode === 'create' ? 'add' : 'update'
    const response = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        action,
        ticket: updatedTicket,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.error || t('page.errors.ticketSave'))
    }
    setTicketsByType((prev) => ({
      ...prev,
      [updatedTicket.ticket_type]: data.tickets || prev[updatedTicket.ticket_type],
    }))
    loadedDataRef.current.tickets[updatedTicket.ticket_type] = true
  }, [ticketEditMode, t])

  // 회의록 관련 함수들
  const fetchMeetingNotes = useCallback(async (signal?: AbortSignal): Promise<MeetingNote[] | undefined> => {
    try {
      setMeetingNotesLoading(true)
      setMeetingNotesError(null)
      const url = meetingNoteSearchKeyword
        ? `/api/meetings?keyword=${encodeURIComponent(meetingNoteSearchKeyword)}`
        : '/api/meetings'
      const response = await fetch(url, { 
        cache: 'no-store',
        signal,
      })
      if (signal?.aborted) return undefined
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch meeting notes`)
      }
      const data = (await response.json()) as MeetingNote[]
      if (signal?.aborted) return undefined
      setMeetingNotes(data)
      return data
    } catch (err) {
      if (signal?.aborted) return undefined
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setMeetingNotesError(errorMessage)
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching meeting notes:', err)
      }
      return undefined
    } finally {
      if (!signal?.aborted) {
        setMeetingNotesLoading(false)
      }
    }
  }, [meetingNoteSearchKeyword])

  const openIssueDetailById = useCallback(async (issueId: string) => {
    setActiveTab('issues')
    let issue = issues.find((item) => item.id === issueId) || null
    if (!issue) {
      const response = await fetch('/api/issues', {
        cache: 'no-store',
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error(t('page.errors.issueLoad'))
      }
      const data = (await response.json()) as Issue[]
      setIssues(data)
      loadedDataRef.current.issues = true
      issue = data.find((item) => item.id === issueId) || null
    }
    if (!issue) {
      throw new Error(t('page.errors.issueNotFound'))
    }
    setSelectedIssue(issue)
    setIssueEditMode('edit')
    setIsIssueEditing(true)
  }, [issues, t])

  const openMeetingNoteDetailById = useCallback(async (meetingNoteId: string) => {
    setActiveTab('meetings')
    let meetingNote = meetingNotes.find((item) => item.id === meetingNoteId) || null
    if (!meetingNote) {
      const response = await fetch(`/api/meetings?type=detail&id=${encodeURIComponent(meetingNoteId)}`, {
        cache: 'no-store',
        credentials: 'include',
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.meetingNote) {
        throw new Error(data.error || t('page.errors.meetingLoad'))
      }
      meetingNote = data.meetingNote as MeetingNote
      setMeetingNotes((prev) => (prev.some((item) => item.id === meetingNoteId) ? prev : [meetingNote!, ...prev]))
    }
    setSelectedMeetingNote(meetingNote)
    setMeetingNoteEditMode('edit')
    setIsMeetingNoteEditing(true)
  }, [meetingNotes, t])

  const openProjectTaskDetailById = useCallback(async (taskId: string) => {
    setActiveTab('tasks')

    let workingProjects = projects
    let workingOrphanTasks = orphanTasks

    if (projectsDetailRef.current !== 'full') {
      const response = await fetch('/api/projects?detail=full', {
        cache: 'no-store',
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error(t('page.errors.taskListLoad'))
      }
      const data = (await response.json()) as Project[]
      applyProjectsPayload(data, 'full')
      workingProjects = normalizeProjects(data)
    }

    if (orphanTasksDetailRef.current !== 'full') {
      const response = await fetch('/api/projects?type=orphan-tasks&detail=full', {
        cache: 'no-store',
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error(t('page.errors.orphanLoad'))
      }
      const data = (await response.json()) as ProjectChild[]
      applyOrphanTasksPayload(data, 'full')
      workingOrphanTasks = data
    }

    for (const project of workingProjects) {
      const task = (project.children || []).find((item) => item.id === taskId)
      if (task) {
        setSelectedTask({
          task,
          projectId: project.id,
          projectName: project.name,
        })
        setTaskEditMode('edit')
        setIsTaskEditing(true)
        return
      }
    }

    const orphanTask = workingOrphanTasks.find((item) => item.id === taskId)
    if (orphanTask) {
      setSelectedTask({
        task: orphanTask,
        projectId: null,
        projectName: 'N/A',
      })
      setTaskEditMode('edit')
      setIsTaskEditing(true)
      return
    }

    throw new Error(t('page.errors.taskNotFound'))
  }, [applyOrphanTasksPayload, applyProjectsPayload, normalizeProjects, orphanTasks, projects, t])

  const openGmpRecordDetailById = useCallback(async (recordId: string) => {
    setActiveTab('gmp-record')
    let records = gmpRecords
    if (!loadedDataRef.current.gmpRecords) {
      const response = await fetch('/api/gmp-records', {
        cache: 'no-store',
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error(t('page.errors.gmpLoad'))
      }
      const data = await response.json()
      records = normalizeGmpRecords(data)
      setGmpRecords(records)
      loadedDataRef.current.gmpRecords = true
    }
    const record = records.find((item: any) => item.id === recordId)
    if (!record) {
      throw new Error(t('page.errors.gmpNotFound'))
    }
    setSelectedTask({
      task: record,
      projectId: (record as any).projectId ?? null,
      projectName: (record as any).projectName || 'N/A',
    })
    setTaskEditMode('edit')
    setIsTaskEditing(true)
  }, [gmpRecords, normalizeGmpRecords, t])

  useEffect(() => {
    if (deepLinkHandledRef.current || isLoadingSession) return

    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    const taskId = params.get('taskId')
    const recordId = params.get('recordId')
    const issueId = params.get('issueId')
    const ticketId = params.get('ticketId')
    const meetingNoteId = params.get('meetingNoteId')
    const ganttProjectId = params.get('ganttProjectId')

    if (!tabParam && !taskId && !recordId && !issueId && !ticketId && !meetingNoteId && !ganttProjectId) {
      deepLinkHandledRef.current = true
      return
    }

    deepLinkHandledRef.current = true
    const clearDeepLinkParams = () => {
      const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`
      window.history.replaceState({}, document.title, cleanUrl)
    }

    void (async () => {
      try {
        if (ticketId) {
          const targetTab = tabParam && isValidTabKey(tabParam) ? (tabParam as TabKey) : 'incident'
          setActiveTab(targetTab)
          await handleOpenTicketDetail(ticketId)
          return
        }

        if (issueId) {
          await openIssueDetailById(issueId)
          return
        }

        if (recordId) {
          await openGmpRecordDetailById(recordId)
          return
        }

        if (taskId) {
          await openProjectTaskDetailById(taskId)
          return
        }

        if (meetingNoteId) {
          await openMeetingNoteDetailById(meetingNoteId)
          return
        }

        if (ganttProjectId) {
          const parsedProjectId = Number(ganttProjectId)
          if (!Number.isNaN(parsedProjectId)) {
            setPendingGanttProjectId(parsedProjectId)
            setActiveTab('gantt')
            return
          }
        }

        if (tabParam && isValidTabKey(tabParam)) {
          setActiveTab(tabParam as TabKey)
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Deep link open error:', error)
        }
      } finally {
        clearDeepLinkParams()
      }
    })()
  }, [
    handleOpenTicketDetail,
    isLoadingSession,
    openGmpRecordDetailById,
    openIssueDetailById,
    openMeetingNoteDetailById,
    openProjectTaskDetailById,
  ])

  useEffect(() => {
    if (activeTab === 'meetings') {
      const abortController = new AbortController()
      fetchMeetingNotes(abortController.signal)
      return () => abortController.abort()
    }
  }, [activeTab, meetingNoteSearchKeyword, fetchMeetingNotes])

  useEffect(() => {
    const abortController = new AbortController()
    let isMounted = true

    const loadTabData = async () => {
      const ticketType = getTicketTypeForTab(activeTab)
      if (ticketType && isMounted && !loadedDataRef.current.tickets[ticketType]) {
        await fetchTickets(ticketType, abortController.signal)
      }
      const needsFullProjectData = activeTab === 'list' || activeTab === 'tasks' || activeTab === 'personal'
      if (needsFullProjectData && isMounted && projectsDetailRef.current !== 'full') {
        await fetchProjects(abortController.signal, 'full')
      }
      const needsFullOrphanTasks = activeTab === 'tasks' || activeTab === 'personal'
      if (needsFullOrphanTasks && isMounted && orphanTasksDetailRef.current !== 'full') {
        await fetchOrphanTasks(abortController.signal, 'full')
      }
      // GMP Record 탭이 활성화될 때 데이터 로드
      if (activeTab === 'gmp-record' && !loadedDataRef.current.gmpRecords) {
        await fetchGmpRecords(abortController.signal)
      }
      // 이슈 관리 탭이 활성화될 때 데이터 로드
      if (activeTab === 'issues' && isMounted && !loadedDataRef.current.issues) {
        await fetchIssues(abortController.signal)
      }
      // VAL Pkg 탭이 활성화될 때 데이터 로드
      if (activeTab === 'val-pkg' && isMounted && !loadedDataRef.current.valPackages) {
        await fetchValPackages(abortController.signal)
      }
      // 내 일감 탭이 활성화될 때 데이터 로드
      if (activeTab === 'personal' && isMounted) {
        const personalFetches: Promise<void>[] = []
        if (!loadedDataRef.current.projects || projectsDetailRef.current !== 'full') {
          personalFetches.push(fetchProjects(abortController.signal, 'full'))
        }
        if (!loadedDataRef.current.gmpRecords) {
          personalFetches.push(fetchGmpRecords(abortController.signal))
        }
        if (!loadedDataRef.current.orphanTasks || orphanTasksDetailRef.current !== 'full') {
          personalFetches.push(fetchOrphanTasks(abortController.signal, 'full'))
        }
        if (!loadedDataRef.current.ganttMyTasks) {
          personalFetches.push(fetchGanttMyTasks(abortController.signal))
        }
        if (personalFetches.length > 0) {
          await Promise.all(personalFetches)
        }
      }
    }

    loadTabData()

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [activeTab, fetchGanttMyTasks, fetchGmpRecords, fetchIssues, fetchTickets, fetchValPackages, fetchProjects, fetchOrphanTasks, getTicketTypeForTab])

  useEffect(() => {
    const closeMenu = () => setContextMenu(null)
    document.addEventListener('click', closeMenu)
    window.addEventListener('resize', closeMenu)
    return () => {
      document.removeEventListener('click', closeMenu)
      window.removeEventListener('resize', closeMenu)
    }
  }, [])

  /** 이슈 모달에서 연결 일감 선택용 옵션 (프로젝트별 일감 + 미배정 일감, GMP 제외) — 훅은 조건부 return 이전에 호출 */
  const issueTaskLinkOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = []
    projects.forEach((project) => {
      (project.children || []).forEach((child) => {
        if ((child as any).kind_number || (child as any).isGmpRecord) return
        opts.push({ value: child.id, label: `${project.name} — ${child.title}` })
      })
    })
    orphanTasks.forEach((task) => {
      opts.push({ value: task.id, label: `${t('common.unassignedPrefix')} ${task.title}` })
    })
    return opts
  }, [projects, orphanTasks, t])

  const handleProjectSave = async (project: Project, mode: 'create' | 'edit') => {
    try {
      const sanitizedProject: Project = {
        ...project,
        children: project.children ?? [],
      }

      const payload =
        mode === 'create'
          ? { action: 'add', ...sanitizedProject }
          : { action: 'update', id: project.id, data: sanitizedProject }

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save project')
      }

      const data = await response.json().catch(() => ({}))
      applyProjectsPayload(data.projects)
      setIsEditing(false)
      setSelectedProject(null)
      setEditMode('edit')
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error saving project:', err)
      }
      const errorMessage = err instanceof Error ? err.message : t('page.errors.projectSaveFailed')
      alert(errorMessage)
    }
  }

  const handleAddChild = async (projectId: string, child: ProjectChild) => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'addChild',
          projectId,
          child,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add child item')
      }

      const data = await response.json().catch(() => ({}))
      applyProjectsPayload(data.projects)
      setChildTarget(null)
      setIsChildModalOpen(false)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error adding child:', err)
      }
      alert(t('page.alerts.addChildFailed'))
    }
  }

  const handleAddTask = async (projectId: string | null, task: ProjectChild) => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'addChild',
          projectId: projectId || null,
          child: task,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add task')
      }

      const data = await response.json().catch(() => ({}))
      applyProjectsPayload(data.projects)
      if (projectId === null) {
        await fetchOrphanTasks()
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error adding task:', err)
      }
      alert(t('page.alerts.addTaskFailed'))
      throw err
    }
  }

  const handleBatchDeleteProjects = async () => {
    if (selectedProjectIds.size === 0) {
      alert(t('page.alerts.selectProjects'))
      return
    }

    if (!confirm(t('page.confirms.deleteProjects', { count: selectedProjectIds.size }))) {
      return
    }

    try {
      let latestProjects: Project[] | undefined
      for (const projectId of Array.from(selectedProjectIds)) {
        const response = await fetch('/api/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'delete',
            id: projectId,
          }),
        })

        if (!response.ok) {
          throw new Error(`Failed to delete project ${projectId}`)
        }
        const data = await response.json().catch(() => ({}))
        latestProjects = data.projects
      }

      applyProjectsPayload(latestProjects)
      setSelectedProjectIds(new Set())
      setIsDeleteMode(false)
      alert(t('page.alerts.projectsDeleted'))
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error deleting projects:', err)
      }
      alert(t('page.alerts.projectsDeleteFailed'))
    }
  }

  const handleBatchDeleteTasks = async () => {
    if (selectedTaskIds.size === 0) {
      alert(t('page.alerts.selectTasks'))
      return
    }

    if (!confirm(t('page.confirms.deleteTasks', { count: selectedTaskIds.size }))) {
      return
    }

    try {
      // 선택된 일감들을 프로젝트별로 그룹화
      const tasksByProject = new Map<string | null, string[]>()
      
      // 모든 프로젝트의 일감과 orphan tasks를 확인
      projects.forEach((project) => {
        project.children?.forEach((child) => {
          if (selectedTaskIds.has(child.id)) {
            if (!tasksByProject.has(project.id)) {
              tasksByProject.set(project.id, [])
            }
            tasksByProject.get(project.id)!.push(child.id)
          }
        })
      })

      orphanTasks.forEach((task: ProjectChild) => {
        if (selectedTaskIds.has(task.id)) {
          if (!tasksByProject.has(null)) {
            tasksByProject.set(null, [])
          }
          tasksByProject.get(null)!.push(task.id)
        }
      })

      // 각 프로젝트별로 일감 삭제
      let latestProjects: Project[] | undefined
      for (const [projectId, taskIds] of Array.from(tasksByProject.entries())) {
        for (const taskId of taskIds) {
          try {
            const response = await fetch('/api/projects', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'deleteChild',
                projectId: projectId,
                childId: taskId,
              }),
            })

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}))
              const errorMessage = errorData.error || `HTTP ${response.status}`
              if (process.env.NODE_ENV === 'development') {
                console.error(`Failed to delete task ${taskId} from project ${projectId}:`, errorMessage)
              }
              throw new Error(t('page.errors.taskDeleteLine', { taskId, message: errorMessage }))
            }
            const data = await response.json().catch(() => ({}))
            latestProjects = data.projects
          } catch (err) {
            if (process.env.NODE_ENV === 'development') {
              console.error(`Error deleting task ${taskId}:`, err)
            }
            throw err
          }
        }
      }

      applyProjectsPayload(latestProjects)
      if (tasksByProject.has(null)) {
        setOrphanTasks((prev) => prev.filter((task) => !selectedTaskIds.has(task.id)))
      }
      setSelectedTaskIds(new Set())
      setIsDeleteMode(false)
      alert(t('page.alerts.tasksDeleted'))
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error deleting tasks:', err)
      }
      const errorMessage = err instanceof Error ? err.message : t('common.unknownError')
      alert(t('page.alerts.tasksDeleteFailed', { message: errorMessage }))
    }
  }

  const handleAddGmpRecord = async (projectId: string | null, record: ProjectChild) => {
    try {
      const response = await fetch('/api/gmp-records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'add',
          projectId: projectId || null,
          child: record,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add GMP record')
      }

      // 데이터 새로고침 (내 일감 탭도 자동 업데이트됨)
      await fetchGmpRecords()
      await fetchProjects()
      await fetchOrphanTasks()
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error adding GMP record:', err)
      }
      alert(t('page.alerts.addGmpFailed'))
      throw err
    }
  }

  const handleBatchDeleteGmpRecords = async () => {
    if (selectedTaskIds.size === 0) {
      alert(t('page.alerts.selectGmp'))
      return
    }

    if (!confirm(t('page.confirms.deleteGmp', { count: selectedTaskIds.size }))) {
      return
    }

    try {
      for (const recordId of Array.from(selectedTaskIds)) {
        // GMP Record의 projectId를 찾기 위해 records에서 검색
        const record = gmpRecords.find((r: any) => r.id === recordId)
        const projectId = record ? (record.projectId || null) : null
        
        const response = await fetch('/api/gmp-records', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'delete',
            projectId: projectId,
            childId: recordId,
          }),
        })

        if (!response.ok) {
          throw new Error(`Failed to delete GMP record ${recordId}`)
        }
      }

      await fetchGmpRecords()
      setSelectedTaskIds(new Set())
      setIsDeleteMode(false)
      alert(t('page.alerts.gmpDeleted'))
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error deleting GMP records:', err)
      }
      alert(t('page.alerts.gmpDeleteFailed'))
    }
  }

  const handleBatchDeleteChildren = async () => {
    if (selectedChildIds.size === 0) {
      alert(t('page.alerts.selectChildren'))
      return
    }

    if (!confirm(t('page.confirms.deleteChildren', { count: selectedChildIds.size }))) {
      return
    }

    try {
      // 선택된 하위 아이템들을 프로젝트별로 그룹화 (일반 일감과 GMP Record 구분)
      const childrenByProject = new Map<string, string[]>()
      const gmpRecordsByProject = new Map<string, string[]>()
      
      projects.forEach((project) => {
        project.children?.forEach((child) => {
          if (selectedChildIds.has(child.id)) {
            const isGmpRecord = !!(child as any).kind_number || !!(child as any).isGmpRecord
            
            if (isGmpRecord) {
              // GMP Record
              if (!gmpRecordsByProject.has(project.id)) {
                gmpRecordsByProject.set(project.id, [])
              }
              gmpRecordsByProject.get(project.id)!.push(child.id)
            } else {
              // 일반 일감
              if (!childrenByProject.has(project.id)) {
                childrenByProject.set(project.id, [])
              }
              childrenByProject.get(project.id)!.push(child.id)
            }
          }
        })
      })

      // 일반 일감 삭제
      for (const [projectId, childIds] of Array.from(childrenByProject.entries())) {
        for (const childId of childIds) {
          const response = await fetch('/api/projects', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'deleteChild',
              projectId: projectId,
              childId: childId,
            }),
          })

          if (!response.ok) {
            throw new Error(`Failed to delete child ${childId}`)
          }
        }
      }

      // GMP Record 삭제
      for (const [projectId, recordIds] of Array.from(gmpRecordsByProject.entries())) {
        for (const recordId of recordIds) {
          const response = await fetch('/api/gmp-records', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'delete',
              projectId: projectId,
              childId: recordId,
            }),
          })

          if (!response.ok) {
            throw new Error(`Failed to delete GMP record ${recordId}`)
          }
        }
      }

      await fetchProjects()
      setSelectedChildIds(new Set())
      alert(t('page.alerts.childrenDeleted'))
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error deleting children:', err)
      }
      const errorMessage = err instanceof Error ? err.message : t('common.unknownError')
      alert(t('page.alerts.childrenDeleteFailed', { message: errorMessage }))
    }
  }

  const handleNewProject = async () => {
    // 다른 모달들 닫기
    setIsTaskEditing(false)
    setSelectedTask(null)
    setIsIssueEditing(false)
    setSelectedIssue(null)
    setIsValPackageEditing(false)
    setSelectedValPackage(null)
    setIsChildModalOpen(false)
    setChildTarget(null)
    
    const newProject = await buildNewProject()
    setSelectedProject(newProject)
    setEditMode('create')
    setIsEditing(true)
  }

  const handleNewValPackage = async () => {
    // 다른 모달들 닫기
    setIsEditing(false)
    setSelectedProject(null)
    setIsTaskEditing(false)
    setSelectedTask(null)
    setIsIssueEditing(false)
    setSelectedIssue(null)
    setIsChildModalOpen(false)
    setChildTarget(null)
    
    const newValPackage = await buildNewValPackage()
    setSelectedValPackage(newValPackage)
    setValPackageEditMode('create')
    setIsValPackageEditing(true)
  }

  const handleValPackageSave = async (valPackage: Project, mode: 'create' | 'edit') => {
    try {
      const sanitizedValPackage: Project = {
        ...valPackage,
        children: [],
      }

      const payload =
        mode === 'create'
          ? { action: 'add', ...sanitizedValPackage }
          : { action: 'update', id: valPackage.id, data: sanitizedValPackage }

      const response = await fetch('/api/val-packages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save VAL Pkg')
      }

      await fetchValPackages()
      setIsValPackageEditing(false)
      setSelectedValPackage(null)
      setValPackageEditMode('edit')
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error saving VAL Pkg:', err)
      }
      const errorMessage = err instanceof Error ? err.message : t('page.errors.valPkgSaveFailed')
      alert(errorMessage)
    }
  }

  const handleBatchDeleteValPackages = async () => {
    if (selectedValPackageIds.size === 0) {
      alert(t('page.alerts.selectValPkg'))
      return
    }

    if (!confirm(t('page.confirms.deleteValPkg', { count: selectedValPackageIds.size }))) {
      return
    }

    try {
      for (const valPackageId of Array.from(selectedValPackageIds)) {
        const response = await fetch('/api/val-packages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'delete',
            id: valPackageId,
          }),
        })

        if (!response.ok) {
          throw new Error(`Failed to delete VAL Pkg ${valPackageId}`)
        }
      }

      await fetchValPackages()
      setSelectedValPackageIds(new Set())
      setIsDeleteMode(false)
      alert(t('page.alerts.valPkgDeleted'))
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error deleting VAL Pkg:', err)
      }
      alert(t('page.alerts.valPkgDeleteFailed'))
    }
  }

  const handleProjectContextMenu = (event: MouseEvent, project: Project) => {
    event.preventDefault()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      project,
    })
  }


  const handleAddIssue = async (issue: Issue) => {
    try {
      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'add',
          issue: issue,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add issue')
      }

      const data = await response.json().catch(() => ({}))
      if (data.issues) {
        setIssues(data.issues)
        loadedDataRef.current.issues = true
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error adding issue:', err)
      }
      alert(t('page.alerts.addIssueFailed'))
      throw err
    }
  }

  const handleUpdateIssue = async (issue: Issue) => {
    try {
      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update',
          issue: issue,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update issue')
      }

      const data = await response.json().catch(() => ({}))
      if (data.issues) {
        setIssues(data.issues)
        loadedDataRef.current.issues = true
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error updating issue:', err)
      }
      alert(t('page.alerts.updateIssueFailed'))
      throw err
    }
  }

  const handleBatchDeleteIssues = async () => {
    if (selectedIssueIds.size === 0) {
      alert(t('page.alerts.selectIssues'))
      return
    }

    if (!confirm(t('page.confirms.deleteIssues', { count: selectedIssueIds.size }))) {
      return
    }

    try {
      let latestIssues: Issue[] | undefined
      for (const issueId of Array.from(selectedIssueIds)) {
        const response = await fetch('/api/issues', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'delete',
            issueId: issueId,
          }),
        })

        if (!response.ok) {
          throw new Error(`Failed to delete issue ${issueId}`)
        }
        const data = await response.json().catch(() => ({}))
        latestIssues = data.issues
      }

      if (latestIssues) {
        setIssues(latestIssues)
        loadedDataRef.current.issues = true
      }
      setSelectedIssueIds(new Set())
      setIsDeleteMode(false)
      alert(t('page.alerts.issuesDeleted'))
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error deleting issues:', err)
      }
      alert(t('page.alerts.issuesDeleteFailed'))
    }
  }

  // 회의록 관련 핸들러
  const handleAddMeetingNote = async (meetingNote: MeetingNote) => {
    try {
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'add',
          meetingNote: meetingNote,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add meeting note')
      }

      await fetchMeetingNotes()
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error adding meeting note:', err)
      }
      alert(t('page.alerts.addMeetingFailed'))
      throw err
    }
  }

  const handleUpdateMeetingNote = async (meetingNote: MeetingNote) => {
    try {
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update',
          meetingNote: meetingNote,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update meeting note')
      }

      await fetchMeetingNotes()
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error updating meeting note:', err)
      }
      alert(t('page.alerts.updateMeetingFailed'))
      throw err
    }
  }

  const handleBatchDeleteMeetingNotes = async () => {
    if (selectedMeetingNoteIds.size === 0) {
      alert(t('page.alerts.selectMeetings'))
      return
    }

    if (!confirm(t('page.confirms.deleteMeetings', { count: selectedMeetingNoteIds.size }))) {
      return
    }

    try {
      for (const meetingNoteId of Array.from(selectedMeetingNoteIds)) {
        const response = await fetch('/api/meetings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'delete',
            id: meetingNoteId,
          }),
        })

        if (!response.ok) {
          throw new Error(`Failed to delete meeting note ${meetingNoteId}`)
        }
      }

      await fetchMeetingNotes()
      setSelectedMeetingNoteIds(new Set())
      setIsDeleteMode(false)
      alert(t('page.alerts.meetingsDeleted'))
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error deleting meeting notes:', err)
      }
      alert(t('page.alerts.meetingsDeleteFailed'))
    }
  }

  const handleNewMeetingNote = async () => {
    try {
      const response = await fetch('/api/meetings?type=nextId')
      if (!response.ok) {
        throw new Error('Failed to get next meeting note ID')
      }
      const data = await response.json()
      const nextId = data.nextId

      const newMeetingNote: MeetingNote = {
        id: nextId,
        title: '',
        meeting_date: new Date().toISOString().slice(0, 10),
        attendees: [],
        agenda: [],
        discussion: '',
        decisions: '',
        action_items: [],
        next_meeting_date: null,
        created_by: user?.name || '',
        status: 'draft',
      }

      setSelectedMeetingNote(newMeetingNote)
      setMeetingNoteEditMode('create')
      setIsMeetingNoteEditing(true)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error creating new meeting note:', err)
      }
      alert(t('page.alerts.createMeetingFailed'))
    }
  }

  // 세션 로딩 중이면 표시하지 않음 (middleware에서 리다이렉트)
  if (isLoadingSession) {
    return (
      <main className="dashboard">
        <div className="placeholder" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <p>{t('common.loading')}</p>
        </div>
      </main>
    )
  }

  // 로딩 상태일 때 전체 화면 표시
  if (loading && projects.length === 0) {
    return (
      <main className="dashboard">
        <div className="placeholder" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <p>{t('common.loadingData')}</p>
        </div>
      </main>
    )
  }

  const handleGlobalSearch = (query: string) => {
    setActiveTab('search')
    // SearchView에서 검색을 수행하도록 처리
    // 실제 검색 로직은 SearchView 컴포넌트 내부에서 처리됨
  }

  return (
    <ServiceNowLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onSearch={handleGlobalSearch}
      onSettingsClick={(user?.role === 'admin' || user?.isAdmin) ? () => setIsSettingsOpen(true) : undefined}
      onLogout={handleLogout}
      user={user}
    >
      <div className="servicenow-content">
        {activeTab === 'dashboard' ? (
          <DashboardView
            projects={projects}
            issues={issues}
            orphanTasks={orphanTasks}
            loading={loading}
            error={error}
            onRefresh={async () => {
              await Promise.all([
                fetchProjects(),
                fetchIssues(),
                fetchOrphanTasks(),
              ])
            }}
          />
        ) : activeTab === 'list' ? (
          <>
            <ProjectsTable
              projects={projects}
              loading={loading}
              error={error}
              onRefresh={fetchProjects}
              onProjectClick={(project: Project) => {
                if (!isDeleteMode) {
                  // 다른 모달들 닫기
                  setIsTaskEditing(false)
                  setSelectedTask(null)
                  setIsIssueEditing(false)
                  setSelectedIssue(null)
                  setIsValPackageEditing(false)
                  setSelectedValPackage(null)
                  setIsChildModalOpen(false)
                  setChildTarget(null)
                  
                  setSelectedProject(project)
                  setEditMode('edit')
                  setIsEditing(true)
                }
              }}
              onNewProject={handleNewProject}
              onProjectContextMenu={handleProjectContextMenu}
              isDeleteMode={isDeleteMode}
              selectedProjectIds={selectedProjectIds}
              onToggleProjectSelection={(projectId: string) => {
                const newSet = new Set(selectedProjectIds)
                if (newSet.has(projectId)) {
                  newSet.delete(projectId)
                } else {
                  newSet.add(projectId)
                }
                setSelectedProjectIds(newSet)
              }}
              onDeleteModeChange={(enabled: boolean) => {
                setIsDeleteMode(enabled)
                if (!enabled) {
                  setSelectedProjectIds(new Set())
                  setSelectedChildIds(new Set())
                }
              }}
              onBatchDelete={handleBatchDeleteProjects}
              selectedChildIds={selectedChildIds}
              onToggleChildSelection={(childId: string) => {
                const newSet = new Set(selectedChildIds)
                if (newSet.has(childId)) {
                  newSet.delete(childId)
                } else {
                  newSet.add(childId)
                }
                setSelectedChildIds(newSet)
              }}
              onBatchDeleteChildren={handleBatchDeleteChildren}
              onChildClick={(child: ProjectChild, projectId: string, projectName: string) => {
                // 다른 모달들 닫기
                setIsEditing(false)
                setSelectedProject(null)
                setIsIssueEditing(false)
                setSelectedIssue(null)
                setIsValPackageEditing(false)
                setSelectedValPackage(null)
                setIsChildModalOpen(false)
                setChildTarget(null)
                
                // GMP Record인지 확인 (kind_number 필드 존재 여부)
                const isGmpRecord = !!(child as any).kind_number || !!(child as any).isGmpRecord
                
                if (isGmpRecord) {
                  // GMP Record 모달을 열기 위해 activeTab을 변경하지 않고 GMP Record 모달 열기
                  setSelectedTask({
                    task: child,
                    projectId: projectId,
                    projectName: projectName,
                  })
                  setTaskEditMode('edit')
                  setIsTaskEditing(true)
                  // activeTab을 'gmp-record'로 변경하지 않음 (프로젝트 목록 탭 유지)
                } else {
                  // 일반 일감 모달 열기
                  setSelectedTask({
                    task: child,
                    projectId: projectId,
                    projectName: projectName,
                  })
                  setTaskEditMode('edit')
                  setIsTaskEditing(true)
                }
              }}
            />
            {isEditing && selectedProject && (
              <ProjectEditModal
                project={selectedProject}
                mode={editMode}
                onClose={() => {
                  setIsEditing(false)
                  setSelectedProject(null)
                  setEditMode('edit')
                }}
                onSave={(updatedProject: Project) => handleProjectSave(updatedProject, editMode)}
                currentUser={user ? { name: user.name, username: user.username } : undefined}
              />
            )}

            {isChildModalOpen && childTarget && (
              <ChildItemModal
                project={childTarget}
                onClose={() => {
                  setIsChildModalOpen(false)
                  setChildTarget(null)
                }}
                onSave={(child: ProjectChild) => handleAddChild(childTarget.id, child)}
              />
            )}

            {contextMenu && (
              <ContextMenu
                x={contextMenu.x}
                y={contextMenu.y}
                projectName={contextMenu.project.name}
                onAddChild={() => {
                  setChildTarget(contextMenu.project)
                  setIsChildModalOpen(true)
                  setContextMenu(null)
                }}
              />
            )}
          </>
        ) : activeTab === 'gmp-record' ? (
          <>
            <TasksTable
              records={gmpRecords}
              loading={gmpRecordsLoading}
              error={gmpRecordsError}
              title={t('page.gmpRecordListTitle')}
              onRefresh={async () => {
                await fetchGmpRecords()
              }}
              onTaskClick={(task: ProjectChild, projectId: string | null, projectName: string) => {
                if (!isDeleteMode) {
                  // 다른 모달들 닫기
                  setIsEditing(false)
                  setSelectedProject(null)
                  setIsIssueEditing(false)
                  setSelectedIssue(null)
                  setIsValPackageEditing(false)
                  setSelectedValPackage(null)
                  setIsChildModalOpen(false)
                  setChildTarget(null)
                  
                  setSelectedTask({ 
                    task, 
                    projectId: (projectId === 'N/A' || !projectId) ? null : projectId, 
                    projectName: projectName || 'N/A' 
                  })
                  setTaskEditMode('edit')
                  setIsTaskEditing(true)
                }
              }}
              onNewTask={async () => {
                // 다른 모달들 닫기
                setIsEditing(false)
                setSelectedProject(null)
                setIsIssueEditing(false)
                setSelectedIssue(null)
                setIsValPackageEditing(false)
                setSelectedValPackage(null)
                setIsChildModalOpen(false)
                setChildTarget(null)
                
                const newRecord = await buildNewGmpRecord()
                setSelectedTask({
                  task: newRecord,
                  projectId: null,
                  projectName: 'N/A',
                })
                setTaskEditMode('create')
                setIsTaskEditing(true)
              }}
              isDeleteMode={isDeleteMode}
              selectedTaskIds={selectedTaskIds}
              onToggleTaskSelection={(taskId: string) => {
                const newSet = new Set(selectedTaskIds)
                if (newSet.has(taskId)) {
                  newSet.delete(taskId)
                } else {
                  newSet.add(taskId)
                }
                setSelectedTaskIds(newSet)
              }}
              onDeleteModeChange={(enabled: boolean) => {
                setIsDeleteMode(enabled)
                if (!enabled) {
                  setSelectedTaskIds(new Set())
                }
              }}
              onBatchDelete={handleBatchDeleteGmpRecords}
            />
          </>
        ) : activeTab === 'val-pkg' ? (
          <>
            <ValPackagesTable
              valPackages={valPackages}
              loading={valPackagesLoading}
              error={valPackagesError}
              onRefresh={fetchValPackages}
              onValPackageClick={(valPackage: Project) => {
                if (!isDeleteMode) {
                  // 다른 모달들 닫기
                  setIsEditing(false)
                  setSelectedProject(null)
                  setIsTaskEditing(false)
                  setSelectedTask(null)
                  setIsIssueEditing(false)
                  setSelectedIssue(null)
                  setIsChildModalOpen(false)
                  setChildTarget(null)
                  
                  setSelectedValPackage(valPackage)
                  setValPackageEditMode('edit')
                  setIsValPackageEditing(true)
                }
              }}
              onNewValPackage={handleNewValPackage}
              isDeleteMode={isDeleteMode}
              selectedValPackageIds={selectedValPackageIds}
              onToggleValPackageSelection={(valPackageId: string) => {
                const newSet = new Set(selectedValPackageIds)
                if (newSet.has(valPackageId)) {
                  newSet.delete(valPackageId)
                } else {
                  newSet.add(valPackageId)
                }
                setSelectedValPackageIds(newSet)
              }}
              onDeleteModeChange={(enabled: boolean) => {
                setIsDeleteMode(enabled)
                if (!enabled) {
                  setSelectedValPackageIds(new Set())
                }
              }}
              onBatchDelete={handleBatchDeleteValPackages}
            />
            {isValPackageEditing && selectedValPackage && (
              <ValPackageEditModal
                valPackage={selectedValPackage}
                mode={valPackageEditMode}
                onClose={() => {
                  setIsValPackageEditing(false)
                  setSelectedValPackage(null)
                  setValPackageEditMode('edit')
                }}
                onSave={(updatedValPackage: Project) => handleValPackageSave(updatedValPackage, valPackageEditMode)}
                currentUser={user ? { name: user.name, username: user.username } : undefined}
              />
            )}
          </>
        ) : activeTab === 'tasks' ? (
          <>
            <TasksTable
              projects={projects}
              loading={loading}
              error={error}
              onRefresh={async () => {
                await fetchProjects()
              }}
              onTaskClick={(task: ProjectChild, projectId: string | null, projectName: string) => {
                if (!isDeleteMode) {
                  // 다른 모달들 닫기
                  setIsEditing(false)
                  setSelectedProject(null)
                  setIsIssueEditing(false)
                  setSelectedIssue(null)
                  setIsValPackageEditing(false)
                  setSelectedValPackage(null)
                  setIsChildModalOpen(false)
                  setChildTarget(null)
                  
                  setSelectedTask({ 
                    task, 
                    projectId: (projectId === 'N/A' || !projectId) ? null : projectId, 
                    projectName: projectName || 'N/A' 
                  })
                  setTaskEditMode('edit')
                  setIsTaskEditing(true)
                }
              }}
              onNewTask={async () => {
                // 다른 모달들 닫기
                setIsEditing(false)
                setSelectedProject(null)
                setIsIssueEditing(false)
                setSelectedIssue(null)
                setIsValPackageEditing(false)
                setSelectedValPackage(null)
                setIsChildModalOpen(false)
                setChildTarget(null)
                
                const newTask = await buildNewChild()
                setSelectedTask({
                  task: newTask,
                  projectId: projects.length > 0 ? projects[0].id : null,
                  projectName: projects.length > 0 ? projects[0].name : 'N/A',
                })
                setTaskEditMode('create')
                setIsTaskEditing(true)
              }}
              isDeleteMode={isDeleteMode}
              selectedTaskIds={selectedTaskIds}
              onToggleTaskSelection={(taskId: string) => {
                const newSet = new Set(selectedTaskIds)
                if (newSet.has(taskId)) {
                  newSet.delete(taskId)
                } else {
                  newSet.add(taskId)
                }
                setSelectedTaskIds(newSet)
              }}
              onDeleteModeChange={(enabled: boolean) => {
                setIsDeleteMode(enabled)
                if (!enabled) {
                  setSelectedTaskIds(new Set())
                }
              }}
              onBatchDelete={handleBatchDeleteTasks}
            />
          </>
        ) : activeTab === 'personal' ? (
          <PersonalTasksView
            projects={projects}
            gmpRecords={gmpRecords}
            orphanTasks={orphanTasks}
            ganttMyTasks={ganttMyTasks}
            loading={loading}
            error={error}
            searchOwner={searchOwner}
            onSearchOwnerChange={setSearchOwner}
            onRefresh={async () => {
              await Promise.all([
                fetchProjects(),
                fetchGmpRecords(),
                fetchOrphanTasks(),
                fetchGanttMyTasks(),
              ])
            }}
            onGanttTaskClick={(projectId, _projectName) => {
              setPendingGanttProjectId(projectId)
              setActiveTab('gantt')
            }}
            onTaskClick={(task: ProjectChild, projectId: string | null, projectName: string) => {
              // 다른 모달들 닫기
              setIsEditing(false)
              setSelectedProject(null)
              setIsIssueEditing(false)
              setSelectedIssue(null)
              setIsValPackageEditing(false)
              setSelectedValPackage(null)
              setIsChildModalOpen(false)
              setChildTarget(null)
              
              setSelectedTask({
                task,
                projectId: (projectId === 'N/A' || !projectId) ? null : projectId,
                projectName: projectName || 'N/A',
              })
              setTaskEditMode('edit')
              setIsTaskEditing(true)
            }}
            onProjectClick={(project: Project) => {
              // 다른 모달들 닫기
              setIsTaskEditing(false)
              setSelectedTask(null)
              setIsIssueEditing(false)
              setSelectedIssue(null)
              setIsValPackageEditing(false)
              setSelectedValPackage(null)
              setIsChildModalOpen(false)
              setChildTarget(null)
              
              setSelectedProject(project)
              setEditMode('edit')
              setIsEditing(true)
            }}
            currentUser={user ? { name: user.name, username: user.username } : undefined}
          />
        ) : activeTab === 'gantt-history' ? (
          <GanttHistoryView />
        ) : activeTab === 'gantt' ? (
          <GanttWorkspace
            initialProjectId={pendingGanttProjectId ?? undefined}
            onInitialProjectIdConsumed={() => setPendingGanttProjectId(null)}
          />
        ) : activeTab === 'request' || activeTab === 'incident' || activeTab === 'problem' || activeTab === 'change' ? (
          <TicketsTable
            ticketType={activeTab}
            tickets={ticketsByType[activeTab] || []}
            loading={ticketsLoading}
            error={ticketsError}
            onRefresh={() => void fetchTickets(activeTab)}
            onNewTicket={() => void handleCreateTicket(activeTab)}
            onTicketClick={(ticket) => void handleOpenTicketDetail(ticket.id)}
          />
        ) : activeTab === 'approval-inbox' ? (
          <ApprovalInboxView onOpenTicket={(ticketId) => void handleOpenTicketDetail(ticketId)} />
        ) : activeTab === 'notifications' ? (
          <NotificationsView />
        ) : activeTab === 'audit-log' ? (
          <AuditLogView />
        ) : activeTab === 'priority-policy' ? (
          <TicketPoliciesView mode="priority" isAdmin={!!(user?.role === 'admin' || user?.isAdmin)} />
        ) : activeTab === 'sla-policy' ? (
          <TicketPoliciesView mode="sla" isAdmin={!!(user?.role === 'admin' || user?.isAdmin)} />
        ) : activeTab === 'issues' ? (
          <>
            <IssuesTable
              issues={issues}
              loading={issuesLoading}
              error={issuesError}
              onRefresh={async () => {
                await fetchIssues()
              }}
              onIssueClick={(issue: Issue) => {
                if (!isDeleteMode) {
                  // 다른 모달들 닫기
                  setIsEditing(false)
                  setSelectedProject(null)
                  setIsTaskEditing(false)
                  setSelectedTask(null)
                  setIsValPackageEditing(false)
                  setSelectedValPackage(null)
                  setIsChildModalOpen(false)
                  setChildTarget(null)
                  
                  setSelectedIssue(issue)
                  setIssueEditMode('edit')
                  setIsIssueEditing(true)
                }
              }}
              onNewIssue={async () => {
                // 다른 모달들 닫기
                setIsEditing(false)
                setSelectedProject(null)
                setIsTaskEditing(false)
                setSelectedTask(null)
                setIsValPackageEditing(false)
                setSelectedValPackage(null)
                setIsChildModalOpen(false)
                setChildTarget(null)
                
                const newIssue = await buildNewIssue()
                setSelectedIssue(newIssue)
                setIssueEditMode('create')
                setIsIssueEditing(true)
              }}
              isDeleteMode={isDeleteMode}
              selectedIssueIds={selectedIssueIds}
              onToggleIssueSelection={(issueId: string) => {
                const newSet = new Set(selectedIssueIds)
                if (newSet.has(issueId)) {
                  newSet.delete(issueId)
                } else {
                  newSet.add(issueId)
                }
                setSelectedIssueIds(newSet)
              }}
              onDeleteModeChange={(enabled: boolean) => {
                setIsDeleteMode(enabled)
                if (!enabled) {
                  setSelectedIssueIds(new Set())
                }
              }}
              onBatchDelete={handleBatchDeleteIssues}
            />
          </>
        ) : activeTab === 'search' ? (
          <SearchView
            onProjectClick={(project: Project) => {
              // 다른 모달들 닫기
              setIsTaskEditing(false)
              setSelectedTask(null)
              setIsIssueEditing(false)
              setSelectedIssue(null)
              setIsValPackageEditing(false)
              setSelectedValPackage(null)
              setIsChildModalOpen(false)
              setChildTarget(null)
              
              setSelectedProject(project)
              setEditMode('edit')
              setIsEditing(true)
            }}
            onTaskClick={(task: ProjectChild, projectId: string | null, projectName: string) => {
              // 다른 모달들 닫기
              setIsEditing(false)
              setSelectedProject(null)
              setIsIssueEditing(false)
              setSelectedIssue(null)
              setIsValPackageEditing(false)
              setSelectedValPackage(null)
              setIsChildModalOpen(false)
              setChildTarget(null)
              
              // GMP Record인지 확인
              const isGmpRecord = !!(task as any).kind_number || !!(task as any).isGmpRecord || (task as any).type === 'gmp-record'
              
              setSelectedTask({
                task,
                projectId: projectId,
                projectName: projectName || 'N/A',
              })
              setTaskEditMode('edit')
              setIsTaskEditing(true)
            }}
            onGanttTaskClick={(projectId) => {
              setPendingGanttProjectId(projectId)
              setActiveTab('gantt')
            }}
          />
        ) : activeTab === 'voc' ? (
          <VocView
            currentUser={user ? { name: user.name, username: user.username, role: user.role } : undefined}
          />
        ) : activeTab === 'backup' ? (
          user && (user.role === 'admin' || user.isAdmin) ? (
            <BackupView />
          ) : (
            <Placeholder label={t('page.noAccess')} />
          )
        ) : (
          <Placeholder label={t(tabTranslationPath(activeTab))} />
        )}

        {/* 프로젝트 목록 탭과 일감 탭, GMP Record 탭, 검색 탭에서 일감 수정 모달 표시 */}
        {(activeTab === 'list' || activeTab === 'tasks' || activeTab === 'gmp-record' || activeTab === 'search') && isTaskEditing && selectedTask && (
          <TaskEditModal
            task={selectedTask.task}
            projectId={selectedTask.projectId}
            projectName={selectedTask.projectName}
            projects={projects}
            mode={taskEditMode}
            isGmpRecord={activeTab === 'gmp-record' || activeTab === 'search' && ((selectedTask.task as any).type === 'gmp-record') || !!(selectedTask.task as any).kind_number || !!(selectedTask.task as any).isGmpRecord}
            currentUser={user ? { name: user.name, username: user.username } : undefined}
            onOpenIssue={(issueId) => {
              const issue = issues.find((i) => i.id === issueId)
              if (!issue) return
              setIsTaskEditing(false)
              setSelectedTask(null)
              setSelectedIssue(issue)
              setActiveTab('issues')
              setIsIssueEditing(true)
            }}
            onClose={() => {
              setIsTaskEditing(false)
              setSelectedTask(null)
              setTaskEditMode('edit')
            }}
            onSave={async (updatedTask: ProjectChild, newProjectId: string | null) => {
              try {
                const isGmpRecord = activeTab === 'gmp-record' || (activeTab === 'search' && (selectedTask.task as any).type === 'gmp-record') || !!(selectedTask.task as any).kind_number || !!(selectedTask.task as any).isGmpRecord
                if (isGmpRecord) {
                  // GMP Record 저장
                  if (taskEditMode === 'create') {
                    await handleAddGmpRecord(newProjectId, updatedTask)
                  } else {
                    const response = await fetch('/api/gmp-records', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        action: 'update',
                        projectId: newProjectId,
                        child: updatedTask,
                      }),
                    })
                    if (!response.ok) {
                      throw new Error('Failed to update GMP record')
                    }
                  }
                  // 데이터 새로고침 (내 일감 탭도 자동 업데이트됨)
                  await fetchGmpRecords()
                  await fetchProjects()
                  await fetchOrphanTasks()
                } else {
                  // 일반 일감 저장
                  if (taskEditMode === 'create') {
                    await handleAddTask(newProjectId, updatedTask)
                  } else {
                    // 수정 모드에서는 항상 updateChild를 사용 (프로젝트 변경도 자동 처리)
                    const response = await fetch('/api/projects', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        action: 'updateChild',
                        projectId: newProjectId,
                        child: updatedTask,
                      }),
                    })
                    if (!response.ok) {
                      throw new Error('Failed to update task')
                    }
                    const data = await response.json().catch(() => ({}))
                    applyProjectsPayload(data.projects)
                  }
                  // 데이터 새로고침 (내 일감 탭도 자동 업데이트됨)
                  await fetchGmpRecords()
                  if (newProjectId === null) {
                    await fetchOrphanTasks()
                  }
                }
                setIsTaskEditing(false)
                setSelectedTask(null)
                setTaskEditMode('edit')
              } catch (err) {
                if (process.env.NODE_ENV === 'development') {
                  console.error('Error saving task:', err)
                }
                alert(activeTab === 'gmp-record' ? t('page.alerts.saveGmpFailed') : t('page.alerts.saveTaskFailed'))
              }
            }}
          />
        )}

        {isTicketEditing && selectedTicket && (
          <TicketEditModal
            ticket={selectedTicket}
            mode={ticketEditMode}
            currentUser={user ? { id: user.id, name: user.name, username: user.username, role: user.role, isAdmin: user.isAdmin } : undefined}
            onClose={() => {
              setIsTicketEditing(false)
              setSelectedTicket(null)
              setTicketEditMode('edit')
            }}
            onSave={async (updatedTicket) => {
              try {
                await handleSaveTicket(updatedTicket)
                setIsTicketEditing(false)
                setSelectedTicket(null)
                setTicketEditMode('edit')
              } catch (err) {
                if (process.env.NODE_ENV === 'development') {
                  console.error('Error saving ticket:', err)
                }
                alert(err instanceof Error ? err.message : t('page.alerts.saveTicketFailed'))
              }
            }}
          />
        )}

        {/* 이슈 관리 탭에서 이슈 편집 모달 표시 */}
        {activeTab === 'issues' && isIssueEditing && selectedIssue && (
          <IssueEditModal
            issue={selectedIssue}
            mode={issueEditMode}
            allIssues={issues}
            currentUser={user ? { id: user.id, name: user.name, role: user.role } : undefined}
            taskLinkOptions={issueTaskLinkOptions}
            projectOptions={projects.map((p) => ({ id: p.id, name: p.name }))}
            onCreateTask={async (projectId, title, issueId) => {
              try {
                const res = await fetch('/api/projects', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'addChild',
                    projectId,
                    child: {
                      title,
                      owner: selectedIssue?.owner || '',
                      status: 'Planning',
                      progress: 0,
                      start: new Date().toISOString().slice(0, 10),
                      due: '',
                      linked_issue_id: issueId,
                    },
                  }),
                })
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}))
                  throw new Error(err.error || t('page.errors.taskCreateFailed'))
                }
                const data = await res.json()
                applyProjectsPayload(data.projects)
                if (projectId === null) {
                  await fetchOrphanTasks()
                }
                return data.newTaskId || null
              } catch (e) {
                if (process.env.NODE_ENV === 'development') console.error(e)
                alert(e instanceof Error ? e.message : t('page.errors.taskCreateFailedAlert'))
                return null
              }
            }}
            onTaskCreated={async () => {}}
            onOpenGmpRecord={(gmpRecordId) => {
              const record = gmpRecords.find((r: any) => r.id === gmpRecordId)
              if (!record) return
              setIsIssueEditing(false)
              setSelectedIssue(null)
              setSelectedTask({
                task: record,
                projectId: (record as any).projectId ?? null,
                projectName: (record as any).projectName || 'N/A',
              })
              setActiveTab('gmp-record')
              setIsTaskEditing(true)
            }}
            onOpenTask={(taskId) => {
              let projectId: string | null = null
              let projectName = 'N/A'
              let task: ProjectChild | null = null
              for (const project of projects) {
                const child = (project.children || []).find((c) => c.id === taskId)
                if (child) {
                  task = child
                  projectId = project.id
                  projectName = project.name
                  break
                }
              }
              if (!task) {
                const orphan = orphanTasks.find((t) => t.id === taskId)
                if (orphan) {
                  task = orphan
                  projectId = null
                  projectName = 'N/A'
                }
              }
              if (!task) return
              setIsIssueEditing(false)
              setSelectedIssue(null)
              setSelectedTask({ task, projectId, projectName })
              setActiveTab('list')
              setIsTaskEditing(true)
            }}
            onClose={() => {
              setIsIssueEditing(false)
              setSelectedIssue(null)
              setIssueEditMode('edit')
            }}
            onSave={async (updatedIssue: Issue) => {
              try {
                if (issueEditMode === 'create') {
                  await handleAddIssue(updatedIssue)
                } else {
                  await handleUpdateIssue(updatedIssue)
                }
                setIsIssueEditing(false)
                setSelectedIssue(null)
                setIssueEditMode('edit')
              } catch (err) {
                if (process.env.NODE_ENV === 'development') {
                  console.error('Error saving issue:', err)
                }
                alert(t('page.alerts.saveIssueFailed'))
              }
            }}
          />
        )}

        {/* 회의록 탭 */}
        {activeTab === 'meetings' && (
          <MeetingNotesView
            meetingNotes={meetingNotes}
            loading={meetingNotesLoading}
            error={meetingNotesError}
            onRefresh={() => { void fetchMeetingNotes(); }}
            onMeetingNoteClick={(meetingNote: MeetingNote) => {
              if (!isDeleteMode) {
                setSelectedMeetingNote(meetingNote)
                setMeetingNoteEditMode('edit')
                setIsMeetingNoteEditing(true)
              }
            }}
            onNewMeetingNote={handleNewMeetingNote}
            isDeleteMode={isDeleteMode}
            selectedMeetingNoteIds={selectedMeetingNoteIds}
            onToggleMeetingNoteSelection={(meetingNoteId: string) => {
              const newSet = new Set(selectedMeetingNoteIds)
              if (newSet.has(meetingNoteId)) {
                newSet.delete(meetingNoteId)
              } else {
                newSet.add(meetingNoteId)
              }
              setSelectedMeetingNoteIds(newSet)
            }}
            onDeleteModeChange={(enabled: boolean) => {
              setIsDeleteMode(enabled)
              if (!enabled) {
                setSelectedMeetingNoteIds(new Set())
              }
            }}
            onBatchDelete={handleBatchDeleteMeetingNotes}
            searchKeyword={meetingNoteSearchKeyword}
            onSearchChange={setMeetingNoteSearchKeyword}
            onViewTemplate={(meetingNote) => setTemplateMeetingNote(meetingNote)}
          />
        )}

        {/* 회의록 템플릿 보기 모달 */}
        {activeTab === 'meetings' && templateMeetingNote && (
          <MeetingNoteTemplateModal
            meetingNote={templateMeetingNote}
            onClose={() => setTemplateMeetingNote(null)}
          />
        )}

        {/* 액션 아이템 탭 */}
        {activeTab === 'action-items' && (
          <ActionItemsView
            currentUser={user ? { name: user.name, username: user.username } : undefined}
            onMeetingNoteClick={async (meetingNoteId: string) => {
              // 회의록 탭으로 이동하고 해당 회의록 열기
              setActiveTab('meetings')
              try {
                const response = await fetch(`/api/meetings`)
                if (response.ok) {
                  const meetingNotes = await response.json()
                  const meetingNote = meetingNotes.find((mn: MeetingNote) => mn.id === meetingNoteId)
                  if (meetingNote) {
                    setSelectedMeetingNote(meetingNote)
                    setMeetingNoteEditMode('edit')
                    setIsMeetingNoteEditing(true)
                  }
                }
              } catch (err) {
                console.error('Error fetching meeting note:', err)
              }
            }}
          />
        )}

        {/* 회의록 편집 모달 */}
        {activeTab === 'meetings' && isMeetingNoteEditing && selectedMeetingNote && (
          <MeetingNoteEditModal
            meetingNote={selectedMeetingNote}
            mode={meetingNoteEditMode}
            onClose={() => {
              setIsMeetingNoteEditing(false)
              setSelectedMeetingNote(null)
              setMeetingNoteEditMode('edit')
            }}
            onSave={async (updatedMeetingNote: MeetingNote, options?: { autoSave?: boolean }) => {
              try {
                if (meetingNoteEditMode === 'create') {
                  await handleAddMeetingNote(updatedMeetingNote)
                } else {
                  await handleUpdateMeetingNote(updatedMeetingNote)
                }
                const list = await fetchMeetingNotes()
                if (options?.autoSave) {
                  if (meetingNoteEditMode === 'create' && list) {
                    const created = list.find((m) => m.id === updatedMeetingNote.id)
                    if (created) {
                      setSelectedMeetingNote(created)
                      setMeetingNoteEditMode('edit')
                    }
                  }
                  return
                }
                setIsMeetingNoteEditing(false)
                setSelectedMeetingNote(null)
                setMeetingNoteEditMode('edit')
              } catch (err) {
                if (process.env.NODE_ENV === 'development') {
                  console.error('Error saving meeting note:', err)
                }
                alert(t('page.alerts.saveMeetingFailed'))
              }
            }}
          />
        )}

        {/* 개인별 일감 탭에서도 일감 수정 모달 표시 */}
        {activeTab === 'personal' && isTaskEditing && selectedTask && (
          <TaskEditModal
            task={selectedTask.task}
            projectId={selectedTask.projectId}
            projectName={selectedTask.projectName}
            projects={projects}
            mode={taskEditMode}
            currentUser={user ? { name: user.name, username: user.username } : undefined}
            onClose={() => {
              setIsTaskEditing(false)
              setSelectedTask(null)
              setTaskEditMode('edit')
            }}
            onSave={async (updatedTask: ProjectChild, newProjectId: string | null) => {
              try {
                if (taskEditMode === 'create') {
                  await handleAddTask(newProjectId, updatedTask)
                } else {
                  // 수정 모드에서는 항상 updateChild를 사용 (프로젝트 변경도 자동 처리)
                  const response = await fetch('/api/projects', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      action: 'updateChild',
                      projectId: newProjectId,
                      child: updatedTask,
                    }),
                  })
                  if (!response.ok) {
                    throw new Error('Failed to update task')
                  }
                  const data = await response.json().catch(() => ({}))
                  applyProjectsPayload(data.projects)
                }
                // 데이터 새로고침 (내 일감 탭도 자동 업데이트됨)
                await fetchGmpRecords()
                if (newProjectId === null) {
                  await fetchOrphanTasks()
                }
                setIsTaskEditing(false)
                setSelectedTask(null)
                setTaskEditMode('edit')
              } catch (err) {
                if (process.env.NODE_ENV === 'development') {
                  console.error('Error saving task:', err)
                }
                alert(t('page.alerts.saveTaskFailedGeneric'))
              }
            }}
          />
        )}
        {/* 버전 · 저작권 */}
        <footer style={{
          marginTop: '3rem',
          padding: '1.5rem',
          textAlign: 'center',
          borderTop: '1px solid #e5e7eb',
          color: '#6b7280',
          fontSize: '0.875rem'
        }}>
          <p style={{ margin: '0 0 0.5rem' }}>{t('footer.versionLine', { version: appVersion })}</p>
          <p style={{ margin: 0, fontSize: '0.8125rem' }}>{t('footer.copyright', { year: new Date().getFullYear() })}</p>
        </footer>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (user?.role === 'admin' || user?.isAdmin) && user && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          currentUser={user}
        />
      )}
    </ServiceNowLayout>
  )
}
