/** In-project test / QA defects (distinct from post-go-live operational issues). */

export type ProjectDefectSeverity = 'Critical' | 'Major' | 'Minor' | 'Trivial'

export type ProjectDefectStatus = 'Open' | 'InProgress' | 'Resolved' | 'Closed' | 'Deferred'

/** DB/API 저장용 키 (표시는 i18n) */
export const PROJECT_DEFECT_TEST_PHASES = [
  'Unit',
  'Acceptance',
  'DryRun',
  'UT',
  'UAT',
  'PVT',
] as const

export type ProjectDefectTestPhase = (typeof PROJECT_DEFECT_TEST_PHASES)[number]

/** 구 스키마 → 신 Phase (Integration→UT, System→UAT, Regression→PVT, Other→DryRun; Unit·UAT 유지) */
const LEGACY_TEST_PHASE_MAP: Record<string, ProjectDefectTestPhase> = {
  Integration: 'UT',
  System: 'UAT',
  Regression: 'PVT',
  Other: 'DryRun',
}

const VALID_TEST_PHASE = new Set<string>([...PROJECT_DEFECT_TEST_PHASES])

export function normalizeProjectDefectTestPhase(
  raw: string | null | undefined
): ProjectDefectTestPhase {
  const s = String(raw ?? '').trim()
  if (VALID_TEST_PHASE.has(s)) return s as ProjectDefectTestPhase
  const mapped = LEGACY_TEST_PHASE_MAP[s]
  if (mapped) return mapped
  return 'UT'
}

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
