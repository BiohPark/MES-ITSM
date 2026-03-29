'use client'

import type { ProjectChild } from '@/types/project'
import { PersonalTasksView } from '@/components/personal/PersonalTasksView'
import type { HomeTabContentProps } from '../home-tab-content.types'

export function PersonalHomePanel({ p }: { p: HomeTabContentProps }) {
  const {
    user,
    projects,
    loading,
    error,
    gmpRecords,
    orphanTasks,
    ganttMyTasks,
    searchOwner,
    setSearchOwner,
    fetchProjects,
    fetchGmpRecords,
    fetchOrphanTasks,
    fetchGanttMyTasks,
    setActiveTab,
    setPendingGanttProjectId,
    setIsEditing,
    setSelectedProject,
    setIsTaskEditing,
    setSelectedTask,
    setTaskEditMode,
    setIsIssueEditing,
    setSelectedIssue,
    setIsValPackageEditing,
    setSelectedValPackage,
    setIsChildModalOpen,
    setChildTarget,
    setEditMode,
  } = p

  return (
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
        await Promise.all([fetchProjects(), fetchGmpRecords(), fetchOrphanTasks(), fetchGanttMyTasks()])
      }}
      onGanttTaskClick={(projectId, _projectName) => {
        setPendingGanttProjectId(projectId)
        setActiveTab('gantt')
      }}
      onTaskClick={(task: ProjectChild, projectId: string | null, projectName: string) => {
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
          projectId: projectId === 'N/A' || !projectId ? null : projectId,
          projectName: projectName || 'N/A',
        })
        setTaskEditMode('edit')
        setIsTaskEditing(true)
      }}
      onProjectClick={(project) => {
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
  )
}
