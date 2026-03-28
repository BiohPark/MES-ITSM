'use client'

import { useEffect, useMemo, useState } from 'react'
import { AttachmentSection } from '@/components/attachments/AttachmentSection'
import { CommentsSection } from '@/components/common/CommentsSection'
import type { Ticket, TicketLink, TicketType } from '@/types/ticket'
import { useI18n } from '@/lib/i18n'

interface TicketEditModalProps {
  ticket: Ticket
  mode: 'create' | 'edit'
  currentUser?: { id: string; name: string; username: string; role: string; isAdmin?: boolean } | null
  onClose: () => void
  onSave: (ticket: Ticket) => Promise<void> | void
}

const TYPE_LABEL: Record<TicketType, string> = {
  request: 'Service Request',
  incident: 'Incident',
  problem: 'Problem',
  change: 'Change',
}

const contentMaxWidth = '1180px'

function buildDetailFields(t: (key: string) => string): Record<TicketType, Array<{ key: string; label: string; placeholder: string }>> {
  return {
    request: [
      { key: 'requested_service', label: t('comp.ticketModal.reqService'), placeholder: t('comp.ticketModal.reqServicePh') },
      { key: 'business_reason', label: t('comp.ticketModal.businessReason'), placeholder: t('comp.ticketModal.businessReasonPh') },
    ],
    incident: [
      { key: 'affected_service', label: t('comp.ticketModal.affectedService'), placeholder: t('comp.ticketModal.affectedServicePh') },
      { key: 'symptom', label: t('comp.ticketModal.symptom'), placeholder: t('comp.ticketModal.symptomPh') },
    ],
    problem: [
      { key: 'root_cause_hypothesis', label: t('comp.ticketModal.rootCauseHyp'), placeholder: t('comp.ticketModal.rootCauseHypPh') },
      { key: 'recurrence_pattern', label: t('comp.ticketModal.recurrence'), placeholder: t('comp.ticketModal.recurrencePh') },
    ],
    change: [
      { key: 'change_scope', label: t('comp.ticketModal.changeScope'), placeholder: t('comp.ticketModal.changeScopePh') },
      { key: 'rollback_plan', label: t('comp.ticketModal.rollbackPlan'), placeholder: t('comp.ticketModal.rollbackPlanPh') },
    ],
  }
}

function toInputDateTime(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const adjusted = new Date(date.getTime() - offset * 60000)
  return adjusted.toISOString().slice(0, 16)
}

export function TicketEditModal({ ticket, mode, currentUser, onClose, onSave }: TicketEditModalProps) {
  const { t, locale } = useI18n()
  const dateLocale = locale.startsWith('en') ? 'en-US' : 'ko-KR'
  const [formData, setFormData] = useState<Ticket>(ticket)
  const [saving, setSaving] = useState(false)
  const [linkForm, setLinkForm] = useState<Omit<TicketLink, 'id' | 'ticket_id' | 'created_at'>>({
    link_type: 'related',
    linked_entity_type: 'task',
    linked_entity_id: '',
    linked_entity_label: '',
  })

  useEffect(() => {
    setFormData(ticket)
  }, [ticket])

  const detailFieldsMap = useMemo(() => buildDetailFields(t), [t])
  const detailFieldDefs = detailFieldsMap[formData.ticket_type]
  const supportsApproval = formData.ticket_type === 'change' || formData.ticket_type === 'request'
  const sectionContainerStyle = {
    maxWidth: contentMaxWidth,
    margin: '1rem auto 0',
  } as const

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const handleDetailChange = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      detail_fields: {
        ...(prev.detail_fields || {}),
        [key]: value,
      },
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({
        ...formData,
        approver_name: supportsApproval ? formData.approver_name : '',
        approval_required: supportsApproval ? !!formData.approval_required : false,
        approval_status: supportsApproval ? formData.approval_status : '',
      })
    } finally {
      setSaving(false)
    }
  }

  const requestApproval = async () => {
    if (!supportsApproval || !formData.id || !formData.approver_name?.trim()) {
      alert(t('comp.ticketModal.alertApproverName'))
      return
    }
    const response = await fetch('/api/ticket-approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        action: 'request',
        ticketId: formData.id,
        approverName: formData.approver_name,
      }),
    })
    if (!response.ok) {
      alert(t('comp.ticketModal.alertApprovalFail'))
      return
    }
    setFormData((prev) => ({
      ...prev,
      approval_required: true,
      approval_status: 'Requested',
    }))
  }

  const addLink = async () => {
    if (!formData.id || !linkForm.linked_entity_id.trim()) return
    const response = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        action: 'link-add',
        ticketId: formData.id,
        link: linkForm,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (response.ok && data.ticket) {
      setFormData(data.ticket)
      setLinkForm({
        link_type: 'related',
        linked_entity_type: 'task',
        linked_entity_id: '',
        linked_entity_label: '',
      })
    }
  }

  const deleteLink = async (linkId: number) => {
    const response = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        action: 'link-delete',
        linkId,
      }),
    })
    if (response.ok) {
      setFormData((prev) => ({
        ...prev,
        links: (prev.links || []).filter((link) => link.id !== linkId),
      }))
    }
  }

  const formContainerStyle = useMemo(
    () =>
      ({
        maxWidth: contentMaxWidth,
        margin: '0 auto',
      }) as const,
    []
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1440px', width: 'min(1440px, calc(100vw - 2rem))', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>
            {mode === 'edit'
              ? t('comp.ticketModal.titleDetail', { type: TYPE_LABEL[formData.ticket_type] })
              : t('comp.ticketModal.titleCreate', { type: TYPE_LABEL[formData.ticket_type] })}
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="submit" form="ticket-form" className="btn btn-primary" disabled={saving}>
              {saving ? t('comp.ticketModal.saving') : t('comp.ticketModal.save')}
            </button>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>

        <form id="ticket-form" onSubmit={handleSubmit} className="project-form" style={formContainerStyle}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ticket_no">{t('comp.ticketModal.colNo')}</label>
              <input id="ticket_no" name="ticket_no" value={formData.ticket_no} className="form-input" disabled />
            </div>
            <div className="form-group">
              <label htmlFor="ticket_type">{t('comp.ticketModal.colType')}</label>
              <input id="ticket_type" name="ticket_type" value={TYPE_LABEL[formData.ticket_type]} className="form-input" disabled />
            </div>
            {supportsApproval && (
              <div className="form-group">
                <label htmlFor="approver_name">{t('comp.ticketModal.approver')}</label>
                <input id="approver_name" name="approver_name" value={formData.approver_name || ''} onChange={handleChange} className="form-input" placeholder={t('comp.ticketModal.approverPh')} />
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="title">{t('comp.ticketModal.title')}</label>
            <input id="title" name="title" value={formData.title} onChange={handleChange} className="form-input" required />
          </div>

          <div className="form-group">
            <label htmlFor="description">{t('comp.ticketModal.description')}</label>
            <textarea id="description" name="description" value={formData.description || ''} onChange={handleChange} className="form-input" rows={5} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="status">{t('comp.ticketModal.status')}</label>
              <select id="status" name="status" value={formData.status} onChange={handleChange} className="form-input">
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Pending">Pending</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="priority">{t('comp.ticketModal.priority')}</label>
              <select id="priority" name="priority" value={formData.priority} onChange={handleChange} className="form-input">
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="P3">P3</option>
                <option value="P4">P4</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="impact">Impact</label>
              <select id="impact" name="impact" value={formData.impact} onChange={handleChange} className="form-input">
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="urgency">Urgency</label>
              <select id="urgency" name="urgency" value={formData.urgency} onChange={handleChange} className="form-input">
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="requester_name">{t('comp.ticketModal.requester')}</label>
              <input id="requester_name" name="requester_name" value={formData.requester_name || ''} onChange={handleChange} className="form-input" />
            </div>
            <div className="form-group">
              <label htmlFor="requester_dept">{t('comp.ticketModal.requesterDept')}</label>
              <input id="requester_dept" name="requester_dept" value={formData.requester_dept || ''} onChange={handleChange} className="form-input" />
            </div>
            <div className="form-group">
              <label htmlFor="assignee_name">{t('comp.ticketModal.assignee')}</label>
              <input id="assignee_name" name="assignee_name" value={formData.assignee_name || ''} onChange={handleChange} className="form-input" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="related_project_id">{t('comp.ticketModal.relatedProject')}</label>
              <input id="related_project_id" name="related_project_id" value={formData.related_project_id || ''} onChange={handleChange} className="form-input" />
            </div>
            <div className="form-group">
              <label htmlFor="related_task_id">{t('comp.ticketModal.relatedTask')}</label>
              <input id="related_task_id" name="related_task_id" value={formData.related_task_id || ''} onChange={handleChange} className="form-input" />
            </div>
            <div className="form-group">
              <label htmlFor="related_issue_id">{t('comp.ticketModal.relatedIssue')}</label>
              <input id="related_issue_id" name="related_issue_id" value={formData.related_issue_id || ''} onChange={handleChange} className="form-input" />
            </div>
            <div className="form-group">
              <label htmlFor="catalog_item_id">{t('comp.ticketModal.catalogId')}</label>
              <input id="catalog_item_id" name="catalog_item_id" value={formData.catalog_item_id || ''} onChange={handleChange} className="form-input" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t('comp.ticketModal.sla')}</label>
              <input value={`${formData.sla_status || '-'} / ${formData.sla_due_at ? new Date(formData.sla_due_at).toLocaleString(dateLocale) : '-'}`} className="form-input" disabled />
            </div>
            <div className="form-group">
              <label>{t('comp.ticketModal.approvalStatus')}</label>
              <input value={supportsApproval ? formData.approval_status || 'N/A' : t('comp.ticketModal.approvalUnused')} className="form-input" disabled />
            </div>
            <div className="form-group">
              <label htmlFor="opened_at">{t('comp.ticketModal.openedAt')}</label>
              <input id="opened_at" name="opened_at" type="datetime-local" value={toInputDateTime(formData.opened_at)} onChange={handleChange} className="form-input" />
            </div>
          </div>

          <div className="form-row">
            {detailFieldDefs.map((field) => (
              <div className="form-group" key={field.key}>
                <label htmlFor={field.key}>{field.label}</label>
                <input
                  id={field.key}
                  value={formData.detail_fields?.[field.key] || ''}
                  onChange={(e) => handleDetailChange(field.key, e.target.value)}
                  className="form-input"
                  placeholder={field.placeholder}
                />
              </div>
            ))}
          </div>
        </form>

        <section style={sectionContainerStyle}>
          <h3 style={{ marginBottom: '0.75rem' }}>{t('comp.ticketModal.policySection')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
            <div className="form-input">Priority Policy ID: {formData.priority_policy_id || '-'}</div>
            <div className="form-input">SLA Policy ID: {formData.sla_policy_id || '-'}</div>
            <div className="form-input">Approval Required: {supportsApproval ? String(!!formData.approval_required) : 'false'}</div>
            <div className="form-input">Catalog ID: {formData.catalog_item_id || '-'}</div>
          </div>
          {supportsApproval && formData.approval_required && formData.approval_status !== 'Requested' && formData.approval_status !== 'Approved' && (
            <div style={{ marginTop: '0.75rem' }}>
              <button type="button" className="btn btn-primary" onClick={() => void requestApproval()}>{t('comp.ticketModal.requestApproval')}</button>
            </div>
          )}
        </section>

        <section style={sectionContainerStyle}>
          <h3 style={{ marginBottom: '0.75rem' }}>{t('comp.ticketModal.linksSection')}</h3>
          {formData.id && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <input className="form-input" style={{ flex: '0 0 140px' }} value={linkForm.link_type} onChange={(e) => setLinkForm((prev) => ({ ...prev, link_type: e.target.value }))} placeholder={t('comp.ticketModal.linkTypePh')} />
              <input className="form-input" style={{ flex: '0 0 140px' }} value={linkForm.linked_entity_type} onChange={(e) => setLinkForm((prev) => ({ ...prev, linked_entity_type: e.target.value }))} placeholder={t('comp.ticketModal.entityTypePh')} />
              <input className="form-input" style={{ flex: '1 1 220px', minWidth: 0 }} value={linkForm.linked_entity_id} onChange={(e) => setLinkForm((prev) => ({ ...prev, linked_entity_id: e.target.value }))} placeholder={t('comp.ticketModal.entityIdPh')} />
              <input className="form-input" style={{ flex: '1 1 260px', minWidth: 0 }} value={linkForm.linked_entity_label || ''} onChange={(e) => setLinkForm((prev) => ({ ...prev, linked_entity_label: e.target.value }))} placeholder={t('comp.ticketModal.displayLabelPh')} />
              <button type="button" className="btn btn-secondary" onClick={() => void addLink()}>{t('comp.ticketModal.add')}</button>
            </div>
          )}
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {(formData.links || []).length === 0 ? (
              <div style={{ color: '#64748b' }}>{t('comp.ticketModal.noLinks')}</div>
            ) : (
              (formData.links || []).map((link) => (
                <div key={link.id} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: 8, display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                    <strong>{link.link_type}</strong> / {link.linked_entity_type} / {link.linked_entity_id}
                    {link.linked_entity_label ? ` / ${link.linked_entity_label}` : ''}
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={() => void deleteLink(link.id)}>{t('comp.ui.delete')}</button>
                </div>
              ))
            )}
          </div>
        </section>

        <section style={sectionContainerStyle}>
          <h3 style={{ marginBottom: '0.75rem' }}>{t('comp.ticketModal.activitySection')}</h3>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {(formData.activity_logs || []).length === 0 ? (
              <div style={{ color: '#64748b' }}>{t('comp.ticketModal.noActivity')}</div>
            ) : (
              (formData.activity_logs || []).map((log) => (
                <div key={log.id} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: 8, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  <strong>{log.action}</strong> {log.message}
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.35rem' }}>
                    {log.actor_name || '-'} / {log.created_at ? new Date(log.created_at).toLocaleString(dateLocale) : '-'}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section style={sectionContainerStyle}>
          <h3 style={{ marginBottom: '0.75rem' }}>{t('comp.ticketModal.approvalsSection')}</h3>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {(formData.approvals || []).length === 0 ? (
              <div style={{ color: '#64748b' }}>{t('comp.ticketModal.noApprovals')}</div>
            ) : (
              (formData.approvals || []).map((approval) => (
                <div key={approval.id} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: 8, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  <strong>{approval.status}</strong> / {approval.approver_name}
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.35rem' }}>
                    {approval.comments || '-'}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section style={sectionContainerStyle}>
          <h3 style={{ marginBottom: '0.75rem' }}>{t('comp.ticketModal.escalationSection')}</h3>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {(formData.escalations || []).length === 0 ? (
              <div style={{ color: '#64748b' }}>{t('comp.ticketModal.noEscalations')}</div>
            ) : (
              (formData.escalations || []).map((item) => (
                <div key={item.id} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: 8, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  <strong>{item.rule_name}</strong> / {item.status}
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.35rem' }}>{item.message}</div>
                </div>
              ))
            )}
          </div>
        </section>

        <section style={sectionContainerStyle}>
          <h3 style={{ marginBottom: '0.75rem' }}>{t('comp.ticketModal.auditSection')}</h3>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {(formData.audit_logs || []).length === 0 ? (
              <div style={{ color: '#64748b' }}>{t('comp.ticketModal.noAudit')}</div>
            ) : (
              (formData.audit_logs || []).map((item) => (
                <div key={item.id} style={{ padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: 8, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  <strong>{item.action}</strong> / {item.message}
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.35rem' }}>
                    {item.actor_name || '-'} / {item.created_at ? new Date(item.created_at).toLocaleString(dateLocale) : '-'}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {formData.id && currentUser && (
          <div style={sectionContainerStyle}>
            <AttachmentSection
              recordId={formData.id}
              recordType="ticket"
              currentUser={{ id: currentUser.id, name: currentUser.name, role: currentUser.role, isAdmin: currentUser.isAdmin }}
              titleHint={t('comp.ticketModal.attachmentHint')}
            />
          </div>
        )}

        {formData.id && currentUser && (
          <div style={sectionContainerStyle}>
            <CommentsSection entityType="ticket" entityId={formData.id} currentUser={{ name: currentUser.name, username: currentUser.username }} />
          </div>
        )}
      </div>
    </div>
  )
}
