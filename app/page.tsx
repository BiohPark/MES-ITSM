'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import type { MouseEvent } from 'react'
import type { Project, ProjectChild } from '@/types/project'
import { TABS, type TabKey } from '@/utils/constants'
import { buildNewProject, buildNewChild, buildNewGmpRecord, buildNewIssue } from '@/utils/project-utils'
import type { Issue } from '@/types/issue'
import { IssuesTable } from '@/components/issues/IssuesTable'
import { IssueEditModal } from '@/components/issues/IssueEditModal'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { ProjectsTable } from '@/components/projects/ProjectsTable'
import { ProjectEditModal } from '@/components/projects/ProjectEditModal'
import { TasksTable } from '@/components/tasks/TasksTable'
import { TaskEditModal } from '@/components/tasks/TaskEditModal'
import { ChildItemModal } from '@/components/tasks/ChildItemModal'
import { PersonalTasksView } from '@/components/personal/PersonalTasksView'
import { GanttChartView } from '@/components/gantt/GanttChartView'
import { SearchView } from '@/components/search/SearchView'
import { UserManagementModal } from '@/components/users/UserManagementModal'
import { ContextMenu } from '@/components/common/ContextMenu'
import { Placeholder } from '@/components/common/Placeholder'
import { SettingsIcon, SearchIcon } from '@/components/common/Icons'

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard')
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
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
  // 인증 관련 상태
  const [user, setUser] = useState<{ id: string; username: string; name: string; role: 'admin' | 'user'; email?: string } | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)

  useEffect(() => {
    checkSession()
    fetchProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth', {
        credentials: 'include',
      })
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
      if (process.env.NODE_ENV === 'development') {
        console.error('Session check error:', error)
      }
      if (window.location.pathname !== '/login') {
      window.location.href = '/login'
      }
    } finally {
      setIsLoadingSession(false)
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

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/projects', {
        cache: 'no-store',
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch projects`)
      }
      const data = (await response.json()) as Project[]
      setProjects(
        data.map((project) => ({
          ...project,
          children: project.children ?? [],
        }))
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching projects:', err)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Orphan tasks 가져오기
  const fetchOrphanTasks = useCallback(async () => {
    try {
      const response = await fetch('/api/projects?type=orphan-tasks', {
        cache: 'no-store',
      })
      if (response.ok) {
        const data = await response.json()
        setOrphanTasks(data || [])
      } else {
        setOrphanTasks([])
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching orphan tasks:', error)
      }
      setOrphanTasks([])
    }
  }, [])

  // GMP Record 관련 함수들
  const fetchGmpRecords = useCallback(async () => {
    try {
      setGmpRecordsLoading(true)
      setGmpRecordsError(null)
      
      const response = await fetch('/api/gmp-records', {
        cache: 'no-store',
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch GMP records`)
      }
      const data = (await response.json()) as any[]
      // GMP Record 데이터를 ProjectChild 형식으로 변환 (프로젝트 정보 포함)
      const formattedRecords = data.map((record: any) => ({
        ...record,
        projectId: record.projectId || null,
        projectName: record.projectName || 'N/A',
        kind_number: record.kind_number || (record.kind && record.number !== undefined 
          ? `${record.kind}-${String(record.number || 0).padStart(5, '0')}` 
          : 'CC-00000'),
      }))
      setGmpRecords(formattedRecords)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setGmpRecordsError(errorMessage)
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching GMP records:', err)
      }
    } finally {
      setGmpRecordsLoading(false)
    }
  }, [])

  // 이슈 관리 관련 함수들
  const fetchIssues = useCallback(async () => {
    try {
      setIssuesLoading(true)
      setIssuesError(null)
      const response = await fetch('/api/issues', { cache: 'no-store' })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch issues`)
      }
      const data = (await response.json()) as Issue[]
      setIssues(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setIssuesError(errorMessage)
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching issues:', err)
      }
    } finally {
      setIssuesLoading(false)
    }
  }, [])

  useEffect(() => {
    checkSession()
    fetchProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchProjects])

  useEffect(() => {
    // GMP Record 탭이 활성화될 때 데이터 로드
    if (activeTab === 'gmp-record') {
      fetchGmpRecords()
    }
    // 이슈 관리 탭이 활성화될 때 데이터 로드
    if (activeTab === 'issues') {
      fetchIssues()
    }
  }, [activeTab, fetchGmpRecords, fetchIssues])

  useEffect(() => {
    const closeMenu = () => setContextMenu(null)
    document.addEventListener('click', closeMenu)
    window.addEventListener('resize', closeMenu)
    return () => {
      document.removeEventListener('click', closeMenu)
      window.removeEventListener('resize', closeMenu)
    }
  }, [])

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

      await fetchProjects()
      setIsEditing(false)
      setSelectedProject(null)
      setEditMode('edit')
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error saving project:', err)
      }
      const errorMessage = err instanceof Error ? err.message : '프로젝트 저장에 실패했습니다.'
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

      await fetchProjects()
      setChildTarget(null)
      setIsChildModalOpen(false)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error adding child:', err)
      }
      alert('하위 아이템 추가에 실패했습니다.')
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

      await fetchProjects()
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error adding task:', err)
      }
      alert('일감 추가에 실패했습니다.')
      throw err
    }
  }

  const handleBatchDeleteProjects = async () => {
    if (selectedProjectIds.size === 0) {
      alert('삭제할 프로젝트를 선택해주세요.')
      return
    }

    if (!confirm(`선택한 ${selectedProjectIds.size}개의 프로젝트를 삭제하시겠습니까?`)) {
      return
    }

    try {
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
      }

      await fetchProjects()
      setSelectedProjectIds(new Set())
      setIsDeleteMode(false)
      alert('프로젝트가 삭제되었습니다.')
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error deleting projects:', err)
      }
      alert('프로젝트 삭제에 실패했습니다.')
    }
  }

  const handleBatchDeleteTasks = async () => {
    if (selectedTaskIds.size === 0) {
      alert('삭제할 일감을 선택해주세요.')
      return
    }

    if (!confirm(`선택한 ${selectedTaskIds.size}개의 일감을 삭제하시겠습니까?`)) {
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

      // Orphan tasks 확인
      try {
        const orphanResponse = await fetch('/api/projects?type=orphan-tasks')
        if (orphanResponse.ok) {
          const orphanTasks = await orphanResponse.json()
          orphanTasks.forEach((task: ProjectChild) => {
            if (selectedTaskIds.has(task.id)) {
              if (!tasksByProject.has(null)) {
                tasksByProject.set(null, [])
              }
              tasksByProject.get(null)!.push(task.id)
            }
          })
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error fetching orphan tasks:', error)
        }
      }

      // 각 프로젝트별로 일감 삭제
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
              throw new Error(`일감 ${taskId} 삭제 실패: ${errorMessage}`)
            }
          } catch (err) {
            if (process.env.NODE_ENV === 'development') {
              console.error(`Error deleting task ${taskId}:`, err)
            }
            throw err
          }
        }
      }

      await fetchProjects()
      setSelectedTaskIds(new Set())
      setIsDeleteMode(false)
      alert('일감이 삭제되었습니다.')
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error deleting tasks:', err)
      }
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류'
      alert(`일감 삭제에 실패했습니다: ${errorMessage}`)
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

      await fetchGmpRecords()
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error adding GMP record:', err)
      }
      alert('GMP Record 추가에 실패했습니다.')
      throw err
    }
  }

  const handleBatchDeleteGmpRecords = async () => {
    if (selectedTaskIds.size === 0) {
      alert('삭제할 GMP Record를 선택해주세요.')
      return
    }

    if (!confirm(`선택한 ${selectedTaskIds.size}개의 GMP Record를 삭제하시겠습니까?`)) {
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
      alert('GMP Record가 삭제되었습니다.')
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error deleting GMP records:', err)
      }
      alert('GMP Record 삭제에 실패했습니다.')
    }
  }

  const handleBatchDeleteChildren = async () => {
    if (selectedChildIds.size === 0) {
      alert('삭제할 하위 아이템을 선택해주세요.')
      return
    }

    if (!confirm(`선택한 ${selectedChildIds.size}개의 하위 아이템을 삭제하시겠습니까?`)) {
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
      alert('하위 아이템이 삭제되었습니다.')
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error deleting children:', err)
      }
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류'
      alert(`하위 아이템 삭제에 실패했습니다: ${errorMessage}`)
    }
  }

  const handleNewProject = async () => {
    const newProject = await buildNewProject()
    setSelectedProject(newProject)
    setEditMode('create')
    setIsEditing(true)
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

      await fetchIssues()
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error adding issue:', err)
      }
      alert('이슈 추가에 실패했습니다.')
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

      await fetchIssues()
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error updating issue:', err)
      }
      alert('이슈 수정에 실패했습니다.')
      throw err
    }
  }

  const handleBatchDeleteIssues = async () => {
    if (selectedIssueIds.size === 0) {
      alert('삭제할 이슈를 선택해주세요.')
      return
    }

    if (!confirm(`선택한 ${selectedIssueIds.size}개의 이슈를 삭제하시겠습니까?`)) {
      return
    }

    try {
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
      }

      await fetchIssues()
      setSelectedIssueIds(new Set())
      setIsDeleteMode(false)
      alert('이슈가 삭제되었습니다.')
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error deleting issues:', err)
      }
      alert('이슈 삭제에 실패했습니다.')
    }
  }

  const summary = useMemo(
    () => ({
      total: projects.length,
      inProgress: projects.filter((p) => p.status?.toLowerCase() === 'in progress' || p.status === 'In Progress').length,
      planning: projects.filter((p) => p.status === 'Planning').length,
      blocked: projects.filter((p) => p.status === 'Issued').length,
    }),
    [projects]
  )

  // 세션 로딩 중이면 표시하지 않음 (middleware에서 리다이렉트)
  if (isLoadingSession) {
    return (
      <main className="dashboard">
        <div className="placeholder" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <p>로딩 중...</p>
        </div>
      </main>
    )
  }

  // 로딩 상태일 때 전체 화면 표시
  if (loading && projects.length === 0) {
    return (
      <main className="dashboard">
        <div className="placeholder" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <p>데이터를 불러오는 중...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="dashboard">
      <header className="dashboard__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0, color: '#111827' }}>ITSM</h1>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>MES 그룹</p>
          </div>
          <div className="summary-cards">
            <div className="summary-card">
              <span>전체</span>
              <strong>{summary.total}</strong>
            </div>
            <div className="summary-card">
              <span>진행 중</span>
              <strong>{summary.inProgress}</strong>
            </div>
            <div className="summary-card">
              <span>계획</span>
              <strong>{summary.planning}</strong>
            </div>
            <div className="summary-card">
              <span>이슈</span>
              <strong>{summary.blocked}</strong>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: '#f1f5f9', borderRadius: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', color: '#475569' }}>{user.name}</span>
              {user.role === 'admin' && (
                <span style={{ fontSize: '0.75rem', color: '#667eea', fontWeight: 600, padding: '0.125rem 0.5rem', background: '#e0e7ff', borderRadius: '0.25rem' }}>Admin</span>
              )}
            </div>
          )}
          {user && user.role === 'admin' && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                  padding: '0.5rem',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '0.5rem',
                  transition: 'background-color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
                title="설정"
              >
                <SettingsIcon size={24} color="#475569" />
              </button>
              {isSettingsOpen && (
                <UserManagementModal
                  onClose={() => setIsSettingsOpen(false)}
                  currentUser={user}
                />
              )}
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#dc2626'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ef4444'
            }}
          >
            로그아웃
          </button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((tab: { key: TabKey; label: string }) => (
          <button
            key={tab.key}
            className={`tab ${activeTab === tab.key ? 'tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            {tab.key === 'search' ? (
              <SearchIcon size={16} color="currentColor" />
            ) : (
              tab.label
            )}
          </button>
        ))}
      </nav>

      <section className="panel">
        {activeTab === 'dashboard' ? (
          <DashboardView
            projects={projects}
            loading={loading}
            error={error}
            onRefresh={fetchProjects}
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
              title="GMP Record 목록"
              onRefresh={async () => {
                await fetchGmpRecords()
              }}
              onTaskClick={(task: ProjectChild, projectId: string | null, projectName: string) => {
                if (!isDeleteMode) {
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
            loading={loading}
            error={error}
            searchOwner={searchOwner}
            onSearchOwnerChange={setSearchOwner}
            onRefresh={async () => {
              await fetchProjects()
              await fetchGmpRecords()
              await fetchOrphanTasks()
            }}
            onTaskClick={(task: ProjectChild, projectId: string | null, projectName: string) => {
              setSelectedTask({
                task,
                projectId: (projectId === 'N/A' || !projectId) ? null : projectId,
                projectName: projectName || 'N/A',
              })
              setTaskEditMode('edit')
              setIsTaskEditing(true)
            }}
            onProjectClick={(project: Project) => {
              setSelectedProject(project)
              setEditMode('edit')
              setIsEditing(true)
            }}
            currentUser={user ? { name: user.name, username: user.username } : undefined}
          />
        ) : activeTab === 'gantt' ? (
          <GanttChartView
            projects={projects}
            loading={loading}
            error={error}
            onRefresh={fetchProjects}
          />
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
                  setSelectedIssue(issue)
                  setIssueEditMode('edit')
                  setIsIssueEditing(true)
                }
              }}
              onNewIssue={async () => {
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
              setSelectedProject(project)
              setEditMode('edit')
              setIsEditing(true)
            }}
            onTaskClick={(task: ProjectChild, projectId: string | null, projectName: string) => {
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
          />
        ) : (
          <Placeholder label={TABS.find((t: { key: TabKey; label: string }) => t.key === activeTab)?.label ?? ''} />
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
                  await fetchGmpRecords()
                  // 프로젝트 목록 탭이면 프로젝트 목록도 새로고침
                  if (activeTab === 'list') {
                    await fetchProjects()
                  }
                } else {
                  // 일반 일감 저장
                  if (taskEditMode === 'create') {
                    await handleAddTask(newProjectId, updatedTask)
                  } else {
                    const targetProjectId = newProjectId
                    const oldProjectId = selectedTask.projectId
                    
                    if (targetProjectId !== oldProjectId) {
                      if (oldProjectId) {
                        const response = await fetch('/api/projects', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            action: 'deleteChild',
                            projectId: oldProjectId,
                            childId: updatedTask.id,
                          }),
                        })
                        if (!response.ok) {
                          throw new Error('Failed to remove task from old project')
                        }
                      }
                      await handleAddTask(targetProjectId, updatedTask)
                    } else {
                      const response = await fetch('/api/projects', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          action: 'updateChild',
                          projectId: targetProjectId,
                          child: updatedTask,
                        }),
                      })
                      if (!response.ok) {
                        throw new Error('Failed to update task')
                      }
                    }
                  }
                  await fetchProjects()
                }
                setIsTaskEditing(false)
                setSelectedTask(null)
                setTaskEditMode('edit')
              } catch (err) {
                if (process.env.NODE_ENV === 'development') {
                  console.error('Error saving task:', err)
                }
                alert(activeTab === 'gmp-record' ? 'GMP Record 저장에 실패했습니다.' : '일감 저장에 실패했습니다.')
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
                alert('이슈 저장에 실패했습니다.')
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
                  const targetProjectId = newProjectId
                  const oldProjectId = selectedTask.projectId
                  
                  if (targetProjectId !== oldProjectId) {
                    if (oldProjectId) {
                      const response = await fetch('/api/projects', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          action: 'deleteChild',
                          projectId: oldProjectId,
                          childId: updatedTask.id,
                        }),
                      })
                      if (!response.ok) {
                        throw new Error('Failed to remove task from old project')
                      }
                    }
                    await handleAddTask(targetProjectId, updatedTask)
                  } else {
                    const response = await fetch('/api/projects', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        action: 'updateChild',
                        projectId: targetProjectId,
                        child: updatedTask,
                      }),
                    })
                    if (!response.ok) {
                      throw new Error('Failed to update task')
                    }
                  }
                }
                await fetchProjects()
                setIsTaskEditing(false)
                setSelectedTask(null)
                setTaskEditMode('edit')
              } catch (err) {
                if (process.env.NODE_ENV === 'development') {
                  console.error('Error saving task:', err)
                }
                alert('일감 저장에 실패했습니다.')
              }
            }}
          />
        )}
      </section>
    </main>
  )
}
