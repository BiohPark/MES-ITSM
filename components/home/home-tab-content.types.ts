import type { Dispatch, MouseEvent, SetStateAction } from 'react'
import type { TabKey } from '@/utils/constants'
import type { Project, ProjectChild } from '@/types/project'
import type { Issue } from '@/types/issue'
import type { Ticket, TicketType } from '@/types/ticket'
import type { GanttMyTaskItem } from '@/components/personal/PersonalTasksView'

export type HomeUser = {
  id: string
  username: string
  name: string
  role: 'admin' | 'user'
  email?: string
  isAdmin?: boolean
} | null

/** Props for the main tab body inside ServiceNowLayout (extracted from app/page.tsx). */
export type HomeTabContentProps = {
  activeTab: TabKey
  setActiveTab: Dispatch<SetStateAction<TabKey>>

  user: HomeUser

  projects: Project[]
  loading: boolean
  error: string | null
  fetchProjects: () => Promise<void>

  issues: Issue[]
  issuesLoading: boolean
  issuesError: string | null
  fetchIssues: () => Promise<void>

  orphanTasks: ProjectChild[]
  fetchOrphanTasks: () => Promise<void>
  fetchGanttMyTasks: () => Promise<void>

  gmpRecords: Array<ProjectChild & { projectId?: string | null; projectName?: string; kind_number?: string }>
  gmpRecordsLoading: boolean
  gmpRecordsError: string | null
  fetchGmpRecords: () => Promise<void>

  valPackages: Project[]
  valPackagesLoading: boolean
  valPackagesError: string | null
  fetchValPackages: () => Promise<void>

  ticketsByType: Record<TicketType, Ticket[]>
  ticketsLoading: boolean
  ticketsError: string | null
  fetchTickets: (type: TicketType) => Promise<void>
  handleCreateTicket: (type: TicketType) => Promise<void>
  handleOpenTicketDetail: (ticketId: string) => Promise<void>

  ganttMyTasks: GanttMyTaskItem[]
  searchOwner: string
  setSearchOwner: Dispatch<SetStateAction<string>>
  pendingGanttProjectId: number | null
  setPendingGanttProjectId: Dispatch<SetStateAction<number | null>>

  isDeleteMode: boolean
  setIsDeleteMode: Dispatch<SetStateAction<boolean>>
  selectedProjectIds: Set<string>
  setSelectedProjectIds: Dispatch<SetStateAction<Set<string>>>
  selectedChildIds: Set<string>
  setSelectedChildIds: Dispatch<SetStateAction<Set<string>>>
  selectedTaskIds: Set<string>
  setSelectedTaskIds: Dispatch<SetStateAction<Set<string>>>
  selectedValPackageIds: Set<string>
  setSelectedValPackageIds: Dispatch<SetStateAction<Set<string>>>
  selectedIssueIds: Set<string>
  setSelectedIssueIds: Dispatch<SetStateAction<Set<string>>>

  isEditing: boolean
  setIsEditing: Dispatch<SetStateAction<boolean>>
  selectedProject: Project | null
  setSelectedProject: Dispatch<SetStateAction<Project | null>>
  editMode: 'create' | 'edit'
  setEditMode: Dispatch<SetStateAction<'create' | 'edit'>>

  isTaskEditing: boolean
  setIsTaskEditing: Dispatch<SetStateAction<boolean>>
  selectedTask: { task: ProjectChild; projectId: string | null; projectName: string } | null
  setSelectedTask: Dispatch<SetStateAction<{ task: ProjectChild; projectId: string | null; projectName: string } | null>>
  taskEditMode: 'create' | 'edit'
  setTaskEditMode: Dispatch<SetStateAction<'create' | 'edit'>>

  isValPackageEditing: boolean
  setIsValPackageEditing: Dispatch<SetStateAction<boolean>>
  selectedValPackage: Project | null
  setSelectedValPackage: Dispatch<SetStateAction<Project | null>>
  valPackageEditMode: 'create' | 'edit'
  setValPackageEditMode: Dispatch<SetStateAction<'create' | 'edit'>>

  setIsIssueEditing: Dispatch<SetStateAction<boolean>>
  setSelectedIssue: Dispatch<SetStateAction<Issue | null>>
  setIssueEditMode: Dispatch<SetStateAction<'create' | 'edit'>>

  isChildModalOpen: boolean
  setIsChildModalOpen: Dispatch<SetStateAction<boolean>>
  childTarget: Project | null
  setChildTarget: Dispatch<SetStateAction<Project | null>>

  contextMenu: { x: number; y: number; project: Project } | null
  setContextMenu: Dispatch<SetStateAction<{ x: number; y: number; project: Project } | null>>

  handleNewProject: () => Promise<void>
  handleProjectContextMenu: (e: MouseEvent, project: Project) => void
  handleBatchDeleteProjects: () => Promise<void>
  handleBatchDeleteChildren: () => Promise<void>
  handleAddChild: (projectId: string, child: ProjectChild) => Promise<void>
  handleProjectSave: (updatedProject: Project, mode: 'create' | 'edit') => Promise<void>

  handleBatchDeleteGmpRecords: () => Promise<void>
  handleBatchDeleteTasks: () => Promise<void>
  handleValPackageSave: (updatedValPackage: Project, mode: 'create' | 'edit') => Promise<void>
  handleNewValPackage: () => Promise<void>
  handleBatchDeleteValPackages: () => Promise<void>
  handleBatchDeleteIssues: () => Promise<void>
}
