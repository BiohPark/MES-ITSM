'use client'

import type { Project, ProjectChild } from '@/types/project'
import { SearchView } from '@/components/search/SearchView'
import type { HomeTabContentProps } from '../home-tab-content.types'

export function SearchHomePanel({ p }: { p: HomeTabContentProps }) {
  const {
    setActiveTab,
    setPendingGanttProjectId,
    setIsTaskEditing,
    setSelectedTask,
    setTaskEditMode,
    setIsIssueEditing,
    setSelectedIssue,
    setIsValPackageEditing,
    setSelectedValPackage,
    setIsChildModalOpen,
    setChildTarget,
    setIsEditing,
    setSelectedProject,
    setEditMode,
  } = p

  return (
    <SearchView
      onProjectClick={(project: Project) => {
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
          projectId,
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
  )
}
