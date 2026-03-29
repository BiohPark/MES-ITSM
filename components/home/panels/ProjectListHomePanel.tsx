'use client'

import type { Project, ProjectChild } from '@/types/project'
import { ProjectsTable } from '@/components/projects/ProjectsTable'
import { ProjectEditModal } from '@/components/projects/ProjectEditModal'
import { ChildItemModal } from '@/components/tasks/ChildItemModal'
import { ContextMenu } from '@/components/common/ContextMenu'
import type { HomeTabContentProps } from '../home-tab-content.types'

export function ProjectListHomePanel({ p }: { p: HomeTabContentProps }) {
  const {
    user,
    projects,
    loading,
    error,
    fetchProjects,
    isDeleteMode,
    setIsDeleteMode,
    selectedProjectIds,
    setSelectedProjectIds,
    selectedChildIds,
    setSelectedChildIds,
    isEditing,
    setIsEditing,
    selectedProject,
    setSelectedProject,
    editMode,
    setEditMode,
    setIsTaskEditing,
    setSelectedTask,
    setTaskEditMode,
    setIsIssueEditing,
    setSelectedIssue,
    setIsValPackageEditing,
    setSelectedValPackage,
    isChildModalOpen,
    setIsChildModalOpen,
    childTarget,
    setChildTarget,
    contextMenu,
    setContextMenu,
    handleNewProject,
    handleProjectContextMenu,
    handleBatchDeleteProjects,
    handleBatchDeleteChildren,
    handleAddChild,
    handleProjectSave,
  } = p

  return (
    <>
      <ProjectsTable
        projects={projects}
        loading={loading}
        error={error}
        onRefresh={fetchProjects}
        onProjectClick={(project: Project) => {
          if (!isDeleteMode) {
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
          if (newSet.has(projectId)) newSet.delete(projectId)
          else newSet.add(projectId)
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
          if (newSet.has(childId)) newSet.delete(childId)
          else newSet.add(childId)
          setSelectedChildIds(newSet)
        }}
        onBatchDeleteChildren={handleBatchDeleteChildren}
        onChildClick={(child: ProjectChild, projectId: string, projectName: string) => {
          setIsEditing(false)
          setSelectedProject(null)
          setIsIssueEditing(false)
          setSelectedIssue(null)
          setIsValPackageEditing(false)
          setSelectedValPackage(null)
          setIsChildModalOpen(false)
          setChildTarget(null)

          setSelectedTask({
            task: child,
            projectId,
            projectName,
          })
          setTaskEditMode('edit')
          setIsTaskEditing(true)
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
  )
}
