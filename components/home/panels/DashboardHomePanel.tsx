'use client'

import { DashboardView } from '@/components/dashboard/DashboardView'
import type { HomeTabContentProps } from '../home-tab-content.types'

export function DashboardHomePanel({ p }: { p: HomeTabContentProps }) {
  const { projects, issues, orphanTasks, loading, error, fetchProjects, fetchIssues, fetchOrphanTasks } = p
  return (
    <DashboardView
      projects={projects}
      issues={issues}
      orphanTasks={orphanTasks}
      loading={loading}
      error={error}
      onRefresh={async () => {
        await Promise.all([fetchProjects(), fetchIssues(), fetchOrphanTasks()])
      }}
    />
  )
}
