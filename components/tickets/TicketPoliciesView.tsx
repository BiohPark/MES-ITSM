'use client'

import { useI18n } from '@/lib/i18n'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PriorityPolicy, SlaPolicy } from '@/types/ticket'

interface TicketPoliciesViewProps {
  mode: 'priority' | 'sla'
  isAdmin?: boolean
}

const EMPTY_PRIORITY: PriorityPolicy = {
  name: '',
  impact: 'Medium',
  urgency: 'Medium',
  priority: 'P3',
  is_active: true,
}

const EMPTY_SLA: SlaPolicy = {
  name: '',
  ticket_type: 'request',
  priority: 'P3',
  response_minutes: 60,
  resolution_minutes: 480,
  escalation_minutes: 120,
  is_active: true,
}

export function TicketPoliciesView({ mode, isAdmin = false }: TicketPoliciesViewProps) {
  const { t } = useI18n()
  const [priorityPolicies, setPriorityPolicies] = useState<PriorityPolicy[]>([])
  const [slaPolicies, setSlaPolicies] = useState<SlaPolicy[]>([])
  const [priorityForm, setPriorityForm] = useState<PriorityPolicy>(EMPTY_PRIORITY)
  const [slaForm, setSlaForm] = useState<SlaPolicy>(EMPTY_SLA)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/ticket-policies', { credentials: 'include' })
      const data = await response.json()
      setPriorityPolicies(data.priorityPolicies || [])
      setSlaPolicies(data.slaPolicies || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const isPriority = mode === 'priority'
  const title = isPriority ? '우선순위 정책' : 'SLA 정책'
  const description = isPriority
    ? 'Impact/Urgency 조합으로 우선순위를 자동 결정합니다.'
    : '티켓 유형과 우선순위에 따라 응답/해결 목표 시간을 정의합니다.'

  const rows = useMemo(() => (isPriority ? priorityPolicies : slaPolicies), [isPriority, priorityPolicies, slaPolicies])

  const post = async (body: any) => {
    const response = await fetch('/api/ticket-policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    if (response.ok) {
      await fetchData()
      setPriorityForm(EMPTY_PRIORITY)
      setSlaForm(EMPTY_SLA)
    }
  }

  const startEditPriority = (row: PriorityPolicy) => {
    setPriorityForm({
      id: row.id,
      name: row.name,
      impact: row.impact,
      urgency: row.urgency,
      priority: row.priority,
      is_active: row.is_active ?? true,
    })
  }
  const startEditSla = (row: SlaPolicy) => {
    setSlaForm({
      id: row.id,
      name: row.name,
      ticket_type: row.ticket_type,
      priority: row.priority,
      response_minutes: row.response_minutes,
      resolution_minutes: row.resolution_minutes,
      escalation_minutes: row.escalation_minutes,
      is_active: row.is_active ?? true,
    })
  }
  const cancelEdit = () => {
    setPriorityForm(EMPTY_PRIORITY)
    setSlaForm(EMPTY_SLA)
  }
  const isEditingPriority = !!priorityForm.id
  const isEditingSla = !!slaForm.id

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.92rem' }}>{description}</p>
        </div>
        <button className="servicenow-button servicenow-button--secondary" onClick={() => void fetchData()}>
          {t('comp.ui.refresh')}
        </button>
      </div>

      {isAdmin && (
        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: isPriority ? 'repeat(6, minmax(0, 1fr))' : 'repeat(8, minmax(0, 1fr))', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff' }}>
          {isPriority ? (
            <>
              <input className="servicenow-form-input" placeholder={t('comp.ticketPolicies.phName')} value={priorityForm.name} onChange={(e) => setPriorityForm((prev) => ({ ...prev, name: e.target.value }))} />
              <input className="servicenow-form-input" placeholder={t('comp.ticketPolicies.phImpact')} value={priorityForm.impact} onChange={(e) => setPriorityForm((prev) => ({ ...prev, impact: e.target.value }))} />
              <input className="servicenow-form-input" placeholder={t('comp.ticketPolicies.phUrgency')} value={priorityForm.urgency} onChange={(e) => setPriorityForm((prev) => ({ ...prev, urgency: e.target.value }))} />
              <input className="servicenow-form-input" placeholder={t('comp.ticketPolicies.phPriority')} value={priorityForm.priority} onChange={(e) => setPriorityForm((prev) => ({ ...prev, priority: e.target.value }))} />
              <button className="servicenow-button servicenow-button--primary" onClick={() => void post({ action: 'savePriority', policy: priorityForm })}>
                {isEditingPriority ? t('comp.ticketPolicies.edit') : t('comp.ticketPolicies.add')}
              </button>
              {isEditingPriority && (
                <button className="servicenow-button servicenow-button--secondary" onClick={cancelEdit}>
                  {t('comp.ui.cancel')}
                </button>
              )}
            </>
          ) : (
            <>
              <input className="servicenow-form-input" placeholder={t('comp.ticketPolicies.phName')} value={slaForm.name} onChange={(e) => setSlaForm((prev) => ({ ...prev, name: e.target.value }))} />
              <select className="servicenow-form-select" value={slaForm.ticket_type} onChange={(e) => setSlaForm((prev) => ({ ...prev, ticket_type: e.target.value as SlaPolicy['ticket_type'] }))}>
                <option value="request">Request</option>
                <option value="incident">Incident</option>
                <option value="problem">Problem</option>
                <option value="change">Change</option>
              </select>
              <input className="servicenow-form-input" placeholder={t('comp.ticketPolicies.phPriority')} value={slaForm.priority} onChange={(e) => setSlaForm((prev) => ({ ...prev, priority: e.target.value }))} />
              <input className="servicenow-form-input" type="number" placeholder={t('comp.ticketPolicies.colResponse')} value={slaForm.response_minutes} onChange={(e) => setSlaForm((prev) => ({ ...prev, response_minutes: Number(e.target.value) }))} />
              <input className="servicenow-form-input" type="number" placeholder={t('comp.ticketPolicies.colResolve')} value={slaForm.resolution_minutes} onChange={(e) => setSlaForm((prev) => ({ ...prev, resolution_minutes: Number(e.target.value) }))} />
              <input className="servicenow-form-input" type="number" placeholder={t('comp.ticketPolicies.colEscalation')} value={slaForm.escalation_minutes} onChange={(e) => setSlaForm((prev) => ({ ...prev, escalation_minutes: Number(e.target.value) }))} />
              <button className="servicenow-button servicenow-button--primary" onClick={() => void post({ action: 'saveSla', policy: slaForm })}>
                {isEditingSla ? t('comp.ticketPolicies.edit') : t('comp.ticketPolicies.add')}
              </button>
              {isEditingSla && (
                <button className="servicenow-button servicenow-button--secondary" onClick={cancelEdit}>
                  {t('comp.ui.cancel')}
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <table className="servicenow-table">
          <thead>
            {isPriority ? (
              <tr>
                <th>{t('comp.ticketPolicies.colName')}</th>
                <th>{t('comp.ticketPolicies.phImpact')}</th>
                <th>{t('comp.ticketPolicies.phUrgency')}</th>
                <th>{t('comp.ticketPolicies.phPriority')}</th>
                <th>{t('comp.ticketPolicies.active')}</th>
                {isAdmin && <th>{t('comp.ticketPolicies.edit')}</th>}
                {isAdmin && <th>{t('comp.ticketPolicies.delete')}</th>}
              </tr>
            ) : (
              <tr>
                <th>{t('comp.ticketPolicies.colName')}</th>
                <th>{t('comp.ticketPolicies.colType')}</th>
                <th>{t('comp.ticketPolicies.phPriority')}</th>
                <th>{t('comp.ticketPolicies.colResponse')}</th>
                <th>{t('comp.ticketPolicies.colResolve')}</th>
                <th>{t('comp.ticketPolicies.colEscalation')}</th>
                <th>{t('comp.ticketPolicies.active')}</th>
                {isAdmin && <th>{t('comp.ticketPolicies.edit')}</th>}
                {isAdmin && <th>{t('comp.ticketPolicies.delete')}</th>}
              </tr>
            )}
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isPriority ? (isAdmin ? 7 : 5) : (isAdmin ? 9 : 7)} style={{ textAlign: 'center' }}>{t('comp.ticketPolicies.loading')}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={isPriority ? (isAdmin ? 7 : 5) : (isAdmin ? 9 : 7)} style={{ textAlign: 'center', color: '#64748b' }}>{t('comp.ticketPolicies.empty')}</td></tr>
            ) : (
              rows.map((row: any) => (
                <tr key={`${mode}-${row.id}`}>
                  <td>{row.name}</td>
                  {isPriority ? (
                    <>
                      <td>{row.impact}</td>
                      <td>{row.urgency}</td>
                      <td>{row.priority}</td>
                      <td>{row.is_active ? 'Y' : 'N'}</td>
                      {isAdmin && (
                        <td>
                          <button className="servicenow-button servicenow-button--secondary servicenow-button--sm" onClick={() => startEditPriority(row)}>
                            {t('comp.ticketPolicies.edit')}
                          </button>
                        </td>
                      )}
                      {isAdmin && (
                        <td>
                          <button className="servicenow-button servicenow-button--danger servicenow-button--sm" onClick={() => void post({ action: 'deletePriority', id: row.id })}>
                            {t('comp.ticketPolicies.delete')}
                          </button>
                        </td>
                      )}
                    </>
                  ) : (
                    <>
                      <td>{row.ticket_type}</td>
                      <td>{row.priority}</td>
                      <td>{row.response_minutes}</td>
                      <td>{row.resolution_minutes}</td>
                      <td>{row.escalation_minutes}</td>
                      <td>{row.is_active ? 'Y' : 'N'}</td>
                      {isAdmin && (
                        <td>
                          <button className="servicenow-button servicenow-button--secondary servicenow-button--sm" onClick={() => startEditSla(row)}>
                            {t('comp.ticketPolicies.edit')}
                          </button>
                        </td>
                      )}
                      {isAdmin && (
                        <td>
                          <button className="servicenow-button servicenow-button--danger servicenow-button--sm" onClick={() => void post({ action: 'deleteSla', id: row.id })}>
                            {t('comp.ticketPolicies.delete')}
                          </button>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
