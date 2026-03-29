'use client'

import type { ProjectChild } from '@/types/project'
import { TasksTable } from '@/components/tasks/TasksTable'
import { buildNewGmpRecord } from '@/utils/project-utils'
import { useI18n } from '@/lib/i18n'
import type { HomeTabContentProps } from '../home-tab-content.types'

export function GmpRecordHomePanel({ p }: { p: HomeTabContentProps }) {
  const { t } = useI18n()
  const {
    isDeleteMode,
    setIsDeleteMode,
    gmpRecords,
    gmpRecordsLoading,
    gmpRecordsError,
    fetchGmpRecords,
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
    handleBatchDeleteGmpRecords,
  } = p

  return (
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
        onBatchDelete={handleBatchDeleteGmpRecords}
      />
    </>
  )
}
