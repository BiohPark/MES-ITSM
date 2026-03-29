'use client'

import type { HomeTabContentProps } from '@/components/home/home-tab-content.types'
import { DashboardHomePanel } from '@/components/home/panels/DashboardHomePanel'
import { ProjectListHomePanel } from '@/components/home/panels/ProjectListHomePanel'
import { GmpRecordHomePanel } from '@/components/home/panels/GmpRecordHomePanel'
import { ValPkgHomePanel } from '@/components/home/panels/ValPkgHomePanel'
import { TasksHomePanel } from '@/components/home/panels/TasksHomePanel'
import { PersonalHomePanel } from '@/components/home/panels/PersonalHomePanel'
import {
  WorkloadHomePanel,
  GanttHistoryHomePanel,
  ProjectDefectsHomePanel,
  GanttWorkspaceHomePanel,
} from '@/components/home/panels/ExecutionSimpleHomePanels'
import { TicketTypeHomePanel } from '@/components/home/panels/TicketTypeHomePanel'
import {
  ApprovalInboxHomePanel,
  NotificationsHomePanel,
  AuditLogHomePanel,
  PriorityPolicyHomePanel,
  SlaPolicyHomePanel,
} from '@/components/home/panels/ItsmSecondaryHomePanels'
import { IssuesHomePanel } from '@/components/home/panels/IssuesHomePanel'
import { SearchHomePanel } from '@/components/home/panels/SearchHomePanel'
import { VocHomePanel, BackupHomePanel } from '@/components/home/panels/VocBackupHomePanels'
import { TabFallbackHomePanel } from '@/components/home/panels/TabFallbackHomePanel'

export function HomeTabContent(p: HomeTabContentProps) {
  const { activeTab } = p

  const ticketTab =
    activeTab === 'request' || activeTab === 'incident' || activeTab === 'problem' || activeTab === 'change'
      ? activeTab
      : null

  return (
    <>
      {activeTab === 'dashboard' ? (
        <DashboardHomePanel p={p} />
      ) : activeTab === 'list' ? (
        <ProjectListHomePanel p={p} />
      ) : activeTab === 'gmp-record' ? (
        <GmpRecordHomePanel p={p} />
      ) : activeTab === 'val-pkg' ? (
        <ValPkgHomePanel p={p} />
      ) : activeTab === 'tasks' ? (
        <TasksHomePanel p={p} />
      ) : activeTab === 'personal' ? (
        <PersonalHomePanel p={p} />
      ) : activeTab === 'workload' ? (
        <WorkloadHomePanel />
      ) : activeTab === 'gantt-history' ? (
        <GanttHistoryHomePanel />
      ) : activeTab === 'project-defects' ? (
        <ProjectDefectsHomePanel p={p} />
      ) : activeTab === 'gantt' ? (
        <GanttWorkspaceHomePanel p={p} />
      ) : ticketTab ? (
        <TicketTypeHomePanel p={p} ticketTab={ticketTab} />
      ) : activeTab === 'approval-inbox' ? (
        <ApprovalInboxHomePanel p={p} />
      ) : activeTab === 'notifications' ? (
        <NotificationsHomePanel />
      ) : activeTab === 'audit-log' ? (
        <AuditLogHomePanel />
      ) : activeTab === 'priority-policy' ? (
        <PriorityPolicyHomePanel p={p} />
      ) : activeTab === 'sla-policy' ? (
        <SlaPolicyHomePanel p={p} />
      ) : activeTab === 'issues' ? (
        <IssuesHomePanel p={p} />
      ) : activeTab === 'search' ? (
        <SearchHomePanel p={p} />
      ) : activeTab === 'voc' ? (
        <VocHomePanel p={p} />
      ) : activeTab === 'backup' ? (
        <BackupHomePanel p={p} />
      ) : (
        <TabFallbackHomePanel p={p} />
      )}
    </>
  )
}
