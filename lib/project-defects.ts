import { getPool } from './db'
import {
  normalizeProjectDefectTestPhase,
  type ProjectDefect,
  type ProjectDefectAuditEntry,
  type ProjectDefectSeverity,
  type ProjectDefectStatus,
  type ProjectDefectTestPhase,
} from '@/types/project-defect'

function d(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v)
}

function dt(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

function mapDefect(row: Record<string, unknown>): ProjectDefect {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    severity: (row.severity as ProjectDefectSeverity) || 'Major',
    status: (row.status as ProjectDefectStatus) || 'Open',
    test_phase: normalizeProjectDefectTestPhase(row.test_phase as string),
    reporter_user_id: row.reporter_user_id != null ? String(row.reporter_user_id) : null,
    reporter_name: String(row.reporter_name ?? ''),
    assignee: String(row.assignee ?? ''),
    detected_at: d(row.detected_at),
    resolved_at: d(row.resolved_at),
    verified_at: d(row.verified_at),
    verified_by: String(row.verified_by ?? ''),
    root_cause: String(row.root_cause ?? ''),
    fix_summary: String(row.fix_summary ?? ''),
    linked_task_id: String(row.linked_task_id ?? ''),
    created_at: dt(row.created_at),
    updated_at: dt(row.updated_at),
  }
}

function mapAudit(row: Record<string, unknown>): ProjectDefectAuditEntry {
  return {
    id: Number(row.id),
    defect_id: String(row.defect_id),
    action: String(row.action ?? ''),
    actor_user_id: row.actor_user_id != null ? String(row.actor_user_id) : null,
    actor_name: String(row.actor_name ?? ''),
    summary: String(row.summary ?? ''),
    details_json: row.details_json != null ? String(row.details_json) : null,
    created_at: dt(row.created_at),
  }
}

export async function getNextProjectDefectId(): Promise<string> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    `SELECT id FROM project_defects WHERE id LIKE 'DEFECT-%' ORDER BY id DESC LIMIT 1`
  )
  if (!rows?.length) return 'DEFECT-00001'
  const last = String(rows[0].id)
  const m = last.match(/DEFECT-(\d+)/)
  if (m) {
    const n = parseInt(m[1], 10) + 1
    return `DEFECT-${String(n).padStart(5, '0')}`
  }
  return 'DEFECT-00001'
}

export type ListFilters = {
  projectId?: string
  status?: string
  severity?: string
}

export async function listProjectDefects(filters: ListFilters = {}): Promise<ProjectDefect[]> {
  const pool = getPool()
  const where: string[] = []
  const params: unknown[] = []
  if (filters.projectId) {
    where.push('project_id = ?')
    params.push(filters.projectId)
  }
  if (filters.status && filters.status !== 'all') {
    where.push('status = ?')
    params.push(filters.status)
  }
  if (filters.severity && filters.severity !== 'all') {
    where.push('severity = ?')
    params.push(filters.severity)
  }
  const sql =
    `SELECT * FROM project_defects ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY detected_at DESC, id DESC`
  const [rows] = await pool.query<any[]>(sql, params)
  return (rows || []).map((r) => mapDefect(r as Record<string, unknown>))
}

export async function getProjectDefectById(id: string): Promise<ProjectDefect | null> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>('SELECT * FROM project_defects WHERE id = ?', [id])
  if (!rows?.length) return null
  return mapDefect(rows[0] as Record<string, unknown>)
}

export async function listAuditForDefect(defectId: string): Promise<ProjectDefectAuditEntry[]> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>(
    `SELECT * FROM project_defect_audit WHERE defect_id = ? ORDER BY id ASC`,
    [defectId]
  )
  return (rows || []).map((r) => mapAudit(r as Record<string, unknown>))
}

async function appendAudit(
  defectId: string,
  action: string,
  actor: { userId: string | null; name: string },
  summary: string,
  details: Record<string, unknown> | null
): Promise<void> {
  const pool = getPool()
  await pool.query(
    `INSERT INTO project_defect_audit (defect_id, action, actor_user_id, actor_name, summary, details_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      defectId,
      action,
      actor.userId,
      actor.name,
      summary,
      details ? JSON.stringify(details) : null,
    ]
  )
}

export async function insertProjectDefect(
  row: Omit<ProjectDefect, 'id' | 'created_at' | 'updated_at'> & { id?: string },
  actor: { userId: string | null; name: string }
): Promise<string> {
  const pool = getPool()
  const id = row.id || (await getNextProjectDefectId())
  const phase = normalizeProjectDefectTestPhase(row.test_phase as string)
  await pool.query(
    `INSERT INTO project_defects (
      id, project_id, title, description, severity, status, test_phase,
      reporter_user_id, reporter_name, assignee, detected_at, resolved_at, verified_at, verified_by,
      root_cause, fix_summary, linked_task_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      row.project_id,
      row.title,
      row.description || null,
      row.severity,
      row.status,
      phase,
      row.reporter_user_id,
      row.reporter_name || '',
      row.assignee || null,
      row.detected_at || null,
      row.resolved_at || null,
      row.verified_at || null,
      row.verified_by || null,
      row.root_cause || null,
      row.fix_summary || null,
      row.linked_task_id || null,
    ]
  )
  await appendAudit(id, 'created', actor, 'Defect created', {
    project_id: row.project_id,
    title: row.title,
    severity: row.severity,
    status: row.status,
  })
  return id
}

function diffDefect(
  before: ProjectDefect,
  after: Partial<ProjectDefect>
): Record<string, { from: string; to: string }> {
  const keys: (keyof ProjectDefect)[] = [
    'title',
    'description',
    'severity',
    'status',
    'test_phase',
    'assignee',
    'detected_at',
    'resolved_at',
    'verified_at',
    'verified_by',
    'root_cause',
    'fix_summary',
    'linked_task_id',
  ]
  const out: Record<string, { from: string; to: string }> = {}
  for (const k of keys) {
    if (after[k] === undefined) continue
    const bv = String(before[k] ?? '')
    const av = String(after[k] ?? '')
    if (bv !== av) out[String(k)] = { from: bv, to: av }
  }
  return out
}

export async function updateProjectDefect(
  id: string,
  patch: Partial<ProjectDefect>,
  actor: { userId: string | null; name: string }
): Promise<void> {
  const before = await getProjectDefectById(id)
  if (!before) throw new Error('Defect not found')

  const patchNorm = { ...patch }
  if (patchNorm.test_phase !== undefined) {
    patchNorm.test_phase = normalizeProjectDefectTestPhase(String(patchNorm.test_phase))
  }
  const merged: ProjectDefect = { ...before, ...patchNorm }
  const pool = getPool()
  await pool.query(
    `UPDATE project_defects SET
      title = ?, description = ?, severity = ?, status = ?, test_phase = ?,
      assignee = ?, detected_at = ?, resolved_at = ?, verified_at = ?, verified_by = ?,
      root_cause = ?, fix_summary = ?, linked_task_id = ?
    WHERE id = ?`,
    [
      merged.title,
      merged.description || null,
      merged.severity,
      merged.status,
      merged.test_phase,
      merged.assignee || null,
      merged.detected_at || null,
      merged.resolved_at || null,
      merged.verified_at || null,
      merged.verified_by || null,
      merged.root_cause || null,
      merged.fix_summary || null,
      merged.linked_task_id || null,
      id,
    ]
  )
  const changes = diffDefect(before, patchNorm)
  if (Object.keys(changes).length > 0) {
    await appendAudit(id, 'updated', actor, 'Defect updated', { fields: changes })
  }
}

/** Log deletion before removing the defect row. Older audit rows stay in project_defect_audit (no FK cascade from audit to defect). */
export async function appendAuditBeforeDelete(
  defectId: string,
  actor: { userId: string | null; name: string }
): Promise<void> {
  await appendAudit(defectId, 'deleted', actor, 'Defect deleted', null)
}

export async function deleteProjectDefect(id: string): Promise<void> {
  const pool = getPool()
  await pool.query('DELETE FROM project_defects WHERE id = ?', [id])
}

export function defectsToCsv(
  rows: ProjectDefect[],
  projectNames: Map<string, string>
): string {
  const headers = [
    'id',
    'project_id',
    'project_name',
    'title',
    'severity',
    'status',
    'test_phase',
    'reporter_name',
    'assignee',
    'detected_at',
    'resolved_at',
    'verified_at',
    'verified_by',
    'root_cause',
    'fix_summary',
    'linked_task_id',
    'description',
    'created_at',
    'updated_at',
  ]
  const esc = (s: string) => {
    const t = String(s ?? '').replace(/"/g, '""')
    if (/[",\n\r]/.test(t)) return `"${t}"`
    return t
  }
  const lines = [headers.join(',')]
  for (const r of rows) {
    const pname = projectNames.get(r.project_id) || ''
    lines.push(
      [
        r.id,
        r.project_id,
        pname,
        r.title,
        r.severity,
        r.status,
        r.test_phase,
        r.reporter_name,
        r.assignee,
        r.detected_at,
        r.resolved_at,
        r.verified_at,
        r.verified_by,
        r.root_cause,
        r.fix_summary,
        r.linked_task_id,
        r.description,
        r.created_at,
        r.updated_at,
      ]
        .map(esc)
        .join(',')
    )
  }
  return lines.join('\r\n')
}

export type ProjectDefectAuditExportRow = {
  audit_id: number
  defect_id: string
  project_id: string | null
  defect_title: string | null
  action: string
  actor_user_id: string | null
  actor_name: string
  summary: string
  details_json: string | null
  created_at: string
}

/** Audit log rows for CSV; optional filters apply via join to current defect row (deleted defects omit status/severity match). */
export async function listProjectDefectAuditForExport(filters: ListFilters = {}): Promise<ProjectDefectAuditExportRow[]> {
  const pool = getPool()
  const where: string[] = []
  const params: unknown[] = []
  if (filters.projectId) {
    where.push('d.project_id = ?')
    params.push(filters.projectId)
  }
  if (filters.status && filters.status !== 'all') {
    where.push('d.status = ?')
    params.push(filters.status)
  }
  if (filters.severity && filters.severity !== 'all') {
    where.push('d.severity = ?')
    params.push(filters.severity)
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const sql = `
    SELECT a.id AS audit_id, a.defect_id, d.project_id, d.title AS defect_title,
           a.action, a.actor_user_id, a.actor_name, a.summary, a.details_json, a.created_at
    FROM project_defect_audit a
    LEFT JOIN project_defects d ON d.id = a.defect_id
    ${w}
    ORDER BY a.id ASC`
  const [rows] = await pool.query<any[]>(sql, params)
  return (rows || []).map((r) => ({
    audit_id: Number(r.audit_id),
    defect_id: String(r.defect_id ?? ''),
    project_id: r.project_id != null ? String(r.project_id) : null,
    defect_title: r.defect_title != null ? String(r.defect_title) : null,
    action: String(r.action ?? ''),
    actor_user_id: r.actor_user_id != null ? String(r.actor_user_id) : null,
    actor_name: String(r.actor_name ?? ''),
    summary: String(r.summary ?? ''),
    details_json: r.details_json != null ? String(r.details_json) : null,
    created_at: dt(r.created_at),
  }))
}

export function auditTrailToCsv(rows: ProjectDefectAuditExportRow[], projectNames: Map<string, string>): string {
  const headers = [
    'audit_id',
    'defect_id',
    'project_id',
    'project_name',
    'defect_title',
    'action',
    'actor_user_id',
    'actor_name',
    'summary',
    'details_json',
    'created_at',
  ]
  const esc = (s: string) => {
    const t = String(s ?? '').replace(/"/g, '""')
    if (/[",\n\r]/.test(t)) return `"${t}"`
    return t
  }
  const lines = [headers.join(',')]
  for (const r of rows) {
    const pname = r.project_id ? projectNames.get(r.project_id) || '' : ''
    lines.push(
      [
        String(r.audit_id),
        r.defect_id,
        r.project_id || '',
        pname,
        r.defect_title || '',
        r.action,
        r.actor_user_id || '',
        r.actor_name,
        r.summary,
        r.details_json || '',
        r.created_at,
      ]
        .map(esc)
        .join(',')
    )
  }
  return lines.join('\r\n')
}
