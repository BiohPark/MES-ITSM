'use client'

import type { Issue } from '@/types/issue'
import { IssuesTable } from '@/components/issues/IssuesTable'
import { buildNewIssue } from '@/utils/project-utils'
import type { HomeTabContentProps } from '../home-tab-content.types'

export function IssuesHomePanel({ p }: { p: HomeTabContentProps }) {
  const {
    isDeleteMode,
    setIsDeleteMode,
    issues,
    issuesLoading,
    issuesError,
    fetchIssues,
    selectedIssueIds,
    setSelectedIssueIds,
    setIsEditing,
    setSelectedProject,
    setIsTaskEditing,
    setSelectedTask,
    setIsValPackageEditing,
    setSelectedValPackage,
    setIsChildModalOpen,
    setChildTarget,
    setSelectedIssue,
    setIssueEditMode,
    setIsIssueEditing,
    handleBatchDeleteIssues,
  } = p

  return (
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
          if (newSet.has(issueId)) newSet.delete(issueId)
          else newSet.add(issueId)
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
  )
}
