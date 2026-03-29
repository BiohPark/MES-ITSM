'use client'

import type { ProjectChild } from '@/types/project'
import { TasksTable } from '@/components/tasks/TasksTable'
import { buildNewChild } from '@/utils/project-utils'
import type { HomeTabContentProps } from '../home-tab-content.types'

export function TasksHomePanel({ p }: { p: HomeTabContentProps }) {
  const {
    projects,
    loading,
    error,
    fetchProjects,
    isDeleteMode,
    setIsDeleteMode,
    selectedTaskIds,
    setSelectedTaskIds,
    setIsEditing,
    setSelectedProject,
    setIsIssueEditing,
    setSelectedIssue,
    setIsValPackageEditing,
    setSelectedValPackage,
    setIsChildModalOpen,
    setChildTarget,
    setSelectedTask,
    setTaskEditMode,
    setIsTaskEditing,
    handleBatchDeleteTasks,
  } = p

  return (
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
          }
        }}
        onNewTask={async () => {
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
          if (newSet.has(taskId)) newSet.delete(taskId)
          else newSet.add(taskId)
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
  )
}
