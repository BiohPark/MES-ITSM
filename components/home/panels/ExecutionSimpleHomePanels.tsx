'use client'

import { WorkloadView } from '@/components/workload/WorkloadView'
import { GanttHistoryView } from '@/components/gantt/GanttHistoryView'
import { ProjectDefectsView } from '@/components/project-defects/ProjectDefectsView'
import { GanttWorkspace } from '@/components/gantt/GanttWorkspace'
import type { HomeTabContentProps } from '../home-tab-content.types'

export function WorkloadHomePanel() {
  return <WorkloadView />
}

export function GanttHistoryHomePanel() {
  return <GanttHistoryView />
}

export function ProjectDefectsHomePanel({ p }: { p: HomeTabContentProps }) {
  const { user } = p
  return <ProjectDefectsView isAdmin={!!(user?.role === 'admin' || user?.isAdmin)} />
}

export function GanttWorkspaceHomePanel({ p }: { p: HomeTabContentProps }) {
  const { pendingGanttProjectId, setPendingGanttProjectId } = p
  return (
    <GanttWorkspace
      initialProjectId={pendingGanttProjectId ?? undefined}
      onInitialProjectIdConsumed={() => setPendingGanttProjectId(null)}
    />
  )
}
