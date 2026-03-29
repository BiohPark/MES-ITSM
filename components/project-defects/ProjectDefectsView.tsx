'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Project } from '@/types/project'
import type {
  ProjectDefect,
  ProjectDefectAuditEntry,
  ProjectDefectSeverity,
  ProjectDefectStatus,
  ProjectDefectTestPhase,
} from '@/types/project-defect'
import { useI18n } from '@/lib/i18n'

const SEVERITIES: ProjectDefectSeverity[] = ['Critical', 'Major', 'Minor', 'Trivial']
const STATUSES: ProjectDefectStatus[] = ['Open', 'InProgress', 'Resolved', 'Closed', 'Deferred']
const PHASES: ProjectDefectTestPhase[] = ['Unit', 'Integration', 'System', 'UAT', 'Regression', 'Other']

type Props = {
  isAdmin?: boolean
}

function emptyForm(): Partial<ProjectDefect> & { project_id: string } {
  const today = new Date().toISOString().slice(0, 10)
  return {
    project_id: '',
    title: '',
    description: '',
    severity: 'Major',
    status: 'Open',
    test_phase: 'Other',
    assignee: '',
    detected_at: today,
    resolved_at: '',
    verified_at: '',
    verified_by: '',
    root_cause: '',
    fix_summary: '',
    linked_task_id: '',
  }
}

export function ProjectDefectsView({ isAdmin }: Props) {
  const { t } = useI18n()
  const [projects, setProjects] = useState<Project[]>([])
  const [defects, setDefects] = useState<ProjectDefect[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterProject, setFilterProject] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSeverity, setFilterSeverity] = useState('all')

  const [editorMode, setEditorMode] = useState<'create' | 'edit' | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [editingId, setEditingId] = useState<string | null>(null)

  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailDefect, setDetailDefect] = useState<ProjectDefect | null>(null)
  const [detailAudit, setDetailAudit] = useState<ProjectDefectAuditEntry[]>([])

  const projectNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of projects) m.set(p.id, p.name)
    return m
  }, [projects])

  const loadProjects = useCallback(async () => {
    const res = await fetch('/api/projects')
    if (!res.ok) return
    const data = await res.json()
    setProjects(Array.isArray(data) ? data : [])
  }, [])

  const loadDefects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams()
      if (filterProject) q.set('projectId', filterProject)
      if (filterStatus !== 'all') q.set('status', filterStatus)
      if (filterSeverity !== 'all') q.set('severity', filterSeverity)
      const res = await fetch(`/api/project-defects?${q}`, { credentials: 'include' })
      if (!res.ok) {
        if (res.status === 401) {
          setError(t('auth.login.sessionExpired'))
          return
        }
        throw new Error('load')
      }
      const data = await res.json()
      setDefects(data.defects || [])
    } catch {
      setError(t('defect.loadError'))
    } finally {
      setLoading(false)
    }
  }, [filterProject, filterStatus, filterSeverity, t])

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  useEffect(() => {
    void loadDefects()
  }, [loadDefects])

  const openCreate = () => {
    setForm(emptyForm())
    setEditingId(null)
    setEditorMode('create')
  }

  const openEdit = (d: ProjectDefect) => {
    setEditingId(d.id)
    setForm({
      project_id: d.project_id,
      title: d.title,
      description: d.description,
      severity: d.severity,
      status: d.status,
      test_phase: d.test_phase,
      assignee: d.assignee,
      detected_at: d.detected_at,
      resolved_at: d.resolved_at,
      verified_at: d.verified_at,
      verified_by: d.verified_by,
      root_cause: d.root_cause,
      fix_summary: d.fix_summary,
      linked_task_id: d.linked_task_id,
    })
    setEditorMode('edit')
  }

  const saveEditor = async () => {
    if (!form.project_id?.trim() || !form.title?.trim() || !form.detected_at?.trim()) return
    try {
      if (editorMode === 'create') {
        const res = await fetch('/api/project-defects', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: form.project_id,
            title: form.title,
            description: form.description || '',
            severity: form.severity,
            status: form.status,
            test_phase: form.test_phase,
            assignee: form.assignee || '',
            detected_at: form.detected_at,
            resolved_at: form.resolved_at || '',
            verified_at: form.verified_at || '',
            verified_by: form.verified_by || '',
            root_cause: form.root_cause || '',
            fix_summary: form.fix_summary || '',
            linked_task_id: form.linked_task_id || '',
          }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          alert(j.error || 'Error')
          return
        }
      } else if (editorMode === 'edit' && editingId) {
        const res = await fetch(`/api/project-defects/${encodeURIComponent(editingId)}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: form.title,
            description: form.description,
            severity: form.severity,
            status: form.status,
            test_phase: form.test_phase,
            assignee: form.assignee,
            detected_at: form.detected_at,
            resolved_at: form.resolved_at,
            verified_at: form.verified_at,
            verified_by: form.verified_by,
            root_cause: form.root_cause,
            fix_summary: form.fix_summary,
            linked_task_id: form.linked_task_id,
          }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          alert(j.error || 'Error')
          return
        }
      }
      setEditorMode(null)
      await loadDefects()
    } catch (e) {
      console.error(e)
    }
  }

  const openDetail = async (id: string) => {
    setDetailId(id)
    const res = await fetch(`/api/project-defects/${encodeURIComponent(id)}`, { credentials: 'include' })
    if (!res.ok) return
    const data = await res.json()
    setDetailDefect(data.defect)
    setDetailAudit(data.audit || [])
  }

  const removeDefect = async (id: string) => {
    if (!isAdmin) {
      alert(t('defect.adminDeleteOnly'))
      return
    }
    if (!confirm(t('defect.confirmDelete'))) return
    const res = await fetch(`/api/project-defects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error || 'Error')
      return
    }
    if (detailId === id) {
      setDetailId(null)
      setDetailDefect(null)
      setDetailAudit([])
    }
    await loadDefects()
  }

  const exportCsv = async () => {
    const q = new URLSearchParams()
    if (filterProject) q.set('projectId', filterProject)
    if (filterStatus !== 'all') q.set('status', filterStatus)
    if (filterSeverity !== 'all') q.set('severity', filterSeverity)
    const res = await fetch(`/api/project-defects/export?${q}`, { credentials: 'include' })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `project-defects-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportAuditCsv = async () => {
    const q = new URLSearchParams()
    if (filterProject) q.set('projectId', filterProject)
    if (filterStatus !== 'all') q.set('status', filterStatus)
    if (filterSeverity !== 'all') q.set('severity', filterSeverity)
    const res = await fetch(`/api/project-defects/export/audit?${q}`, { credentials: 'include' })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `project-defect-audit-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const phaseLabel = (p: ProjectDefectTestPhase) => {
    const map: Record<ProjectDefectTestPhase, string> = {
      Unit: t('defect.phUnit'),
      Integration: t('defect.phIntegration'),
      System: t('defect.phSystem'),
      UAT: t('defect.phUat'),
      Regression: t('defect.phRegression'),
      Other: t('defect.phOther'),
    }
    return map[p] || p
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '1280px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>{t('defect.title')}</h2>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.875rem', color: '#64748b' }}>{t('defect.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            {t('defect.new')}
          </button>
          <button type="button" className="btn" onClick={() => void exportCsv()}>
            {t('defect.exportCsv')}
          </button>
          <button type="button" className="btn" onClick={() => void exportAuditCsv()}>
            {t('defect.exportAuditCsv')}
          </button>
          <button type="button" className="refresh-button" onClick={() => void loadDefects()}>
            {t('defect.refresh')}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: '0.8rem' }}>{t('defect.filterProject')}</label>
          <select className="form-input" value={filterProject} onChange={(e) => setFilterProject(e.target.value)} style={{ minWidth: '200px' }}>
            <option value="">{t('defect.all')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: '0.8rem' }}>{t('defect.filterStatus')}</label>
          <select className="form-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">{t('defect.all')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: '0.8rem' }}>{t('defect.filterSeverity')}</label>
          <select className="form-input" value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
            <option value="all">{t('defect.all')}</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      {loading ? (
        <p>{t('common.loading')}</p>
      ) : defects.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>{t('defect.empty')}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>{t('defect.colId')}</th>
                <th style={{ padding: '0.5rem' }}>{t('defect.colProject')}</th>
                <th style={{ padding: '0.5rem' }}>{t('defect.colTitle')}</th>
                <th style={{ padding: '0.5rem' }}>{t('defect.colSeverity')}</th>
                <th style={{ padding: '0.5rem' }}>{t('defect.colStatus')}</th>
                <th style={{ padding: '0.5rem' }}>{t('defect.colPhase')}</th>
                <th style={{ padding: '0.5rem' }}>{t('defect.colReporter')}</th>
                <th style={{ padding: '0.5rem' }}>{t('defect.colDetected')}</th>
                <th style={{ padding: '0.5rem' }}>{t('defect.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {defects.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{d.id}</td>
                  <td style={{ padding: '0.5rem' }}>{projectNameById.get(d.project_id) || d.project_id}</td>
                  <td style={{ padding: '0.5rem' }}>{d.title}</td>
                  <td style={{ padding: '0.5rem' }}>{d.severity}</td>
                  <td style={{ padding: '0.5rem' }}>{d.status}</td>
                  <td style={{ padding: '0.5rem' }}>{phaseLabel(d.test_phase)}</td>
                  <td style={{ padding: '0.5rem' }}>{d.reporter_name}</td>
                  <td style={{ padding: '0.5rem' }}>{d.detected_at}</td>
                  <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn" style={{ padding: '0.25rem 0.5rem', marginRight: '0.25rem' }} onClick={() => void openDetail(d.id)}>
                      {t('defect.detail')}
                    </button>
                    <button type="button" className="btn" style={{ padding: '0.25rem 0.5rem', marginRight: '0.25rem' }} onClick={() => openEdit(d)}>
                      {t('defect.edit')}
                    </button>
                    {isAdmin && (
                      <button type="button" className="btn" style={{ padding: '0.25rem 0.5rem', color: '#b91c1c' }} onClick={() => void removeDefect(d.id)}>
                        {t('defect.delete')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editorMode && (
        <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={() => setEditorMode(null)}>
          <div className="modal-content project-form" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px', maxHeight: '90vh', overflow: 'auto' }}>
            <h3>{editorMode === 'create' ? t('defect.modalCreate') : t('defect.modalEdit')}</h3>
            <div className="form-group">
              <label>{t('defect.filterProject')} *</label>
              <select
                className="form-input"
                disabled={editorMode === 'edit'}
                value={form.project_id}
                onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
              >
                <option value="">{t('defect.filterProject')}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{t('defect.colTitle')} *</label>
              <input className="form-input" value={form.title || ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>{t('defect.fieldDescription')}</label>
              <textarea className="form-input" rows={3} value={form.description || ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label>{t('defect.filterSeverity')}</label>
                <select className="form-input" value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as ProjectDefectSeverity }))}>
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>{t('defect.filterStatus')}</label>
                <select className="form-input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProjectDefectStatus }))}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>{t('defect.colPhase')}</label>
              <select className="form-input" value={form.test_phase} onChange={(e) => setForm((f) => ({ ...f, test_phase: e.target.value as ProjectDefectTestPhase }))}>
                {PHASES.map((s) => (
                  <option key={s} value={s}>
                    {phaseLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{t('defect.fieldAssignee')}</label>
              <input className="form-input" value={form.assignee || ''} onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <div className="form-group">
                <label>{t('defect.fieldDetected')} *</label>
                <input type="date" className="form-input" value={form.detected_at?.slice(0, 10) || ''} onChange={(e) => setForm((f) => ({ ...f, detected_at: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>{t('defect.fieldResolved')}</label>
                <input type="date" className="form-input" value={form.resolved_at?.slice(0, 10) || ''} onChange={(e) => setForm((f) => ({ ...f, resolved_at: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>{t('defect.fieldVerified')}</label>
                <input type="date" className="form-input" value={form.verified_at?.slice(0, 10) || ''} onChange={(e) => setForm((f) => ({ ...f, verified_at: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>{t('defect.fieldVerifiedBy')}</label>
              <input className="form-input" value={form.verified_by || ''} onChange={(e) => setForm((f) => ({ ...f, verified_by: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>{t('defect.fieldRootCause')}</label>
              <textarea className="form-input" rows={2} value={form.root_cause || ''} onChange={(e) => setForm((f) => ({ ...f, root_cause: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>{t('defect.fieldFixSummary')}</label>
              <textarea className="form-input" rows={2} value={form.fix_summary || ''} onChange={(e) => setForm((f) => ({ ...f, fix_summary: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>{t('defect.fieldLinkedTask')}</label>
              <input className="form-input" value={form.linked_task_id || ''} onChange={(e) => setForm((f) => ({ ...f, linked_task_id: e.target.value }))} />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={() => void saveEditor()}>
                {t('defect.save')}
              </button>
              <button type="button" className="btn" style={{ marginLeft: '0.5rem' }} onClick={() => setEditorMode(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailId && detailDefect && (
        <div className="modal-overlay" style={{ zIndex: 1250 }} onClick={() => setDetailId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', maxHeight: '90vh', overflow: 'auto' }}>
            <h3>{detailDefect.id}</h3>
            <p style={{ fontWeight: 600 }}>{detailDefect.title}</p>
            <p style={{ fontSize: '0.875rem', color: '#64748b', whiteSpace: 'pre-wrap' }}>{detailDefect.description}</p>
            <hr style={{ margin: '1rem 0' }} />
            <p style={{ fontSize: '0.85rem' }}>
              <strong>{t('defect.colProject')}:</strong> {projectNameById.get(detailDefect.project_id) || detailDefect.project_id}
            </p>
            <p style={{ fontSize: '0.85rem' }}>
              <strong>{t('defect.auditTitle')}</strong>
            </p>
            <ul style={{ fontSize: '0.8rem', paddingLeft: '1.2rem', maxHeight: '240px', overflow: 'auto' }}>
              {detailAudit.map((a) => (
                <li key={a.id} style={{ marginBottom: '0.35rem' }}>
                  <span style={{ color: '#64748b' }}>{a.created_at}</span> — {a.action} — {a.actor_name}: {a.summary}
                  {a.details_json ? <pre style={{ fontSize: '0.7rem', margin: '0.25rem 0' }}>{a.details_json}</pre> : null}
                </li>
              ))}
            </ul>
            <button type="button" className="btn" onClick={() => setDetailId(null)}>
              {t('defect.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
