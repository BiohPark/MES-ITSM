/** In-project test / QA defects (distinct from post-go-live operational issues). */

export type ProjectDefectSeverity = 'Critical' | 'Major' | 'Minor' | 'Trivial'

export type ProjectDefectStatus = 'Open' | 'InProgress' | 'Resolved' | 'Closed' | 'Deferred'

export type ProjectDefectTestPhase =
  | 'Unit'
  | 'Integration'
  | 'System'
  | 'UAT'
  | 'Regression'
  | 'Other'

export type ProjectDefect = {
  id: string
  project_id: string
  title: string
  description: string
  severity: ProjectDefectSeverity
  status: ProjectDefectStatus
  test_phase: ProjectDefectTestPhase
  reporter_user_id: string | null
  reporter_name: string
  assignee: string
  detected_at: string
  resolved_at: string
  verified_at: string
  verified_by: string
  root_cause: string
  fix_summary: string
  linked_task_id: string
  created_at: string
  updated_at: string
}

export type ProjectDefectAuditEntry = {
  id: number
  defect_id: string
  action: string
  actor_user_id: string | null
  actor_name: string
  summary: string
  details_json: string | null
  created_at: string
}
