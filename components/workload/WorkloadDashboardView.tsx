'use client'

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'

type DeptRow = {
  departmentId: number | null
  departmentName: string | null
  memberCount: number
  totalAssignments: number
}

type UserRow = {
  userId: string
  name: string
  username: string
  departmentId: number | null
  departmentName: string | null
  projectTasks: number
  gmpRecords: number
  issues: number
  tickets: number
  ganttTasks: number
  actionItems: number
  total: number
}

export function WorkloadDashboardView() {
  const { t } = useI18n()
  const [departments, setDepartments] = useState<DeptRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/workload/summary')
      if (!res.ok) {
        throw new Error(await res.text())
      }
      const data = await res.json()
      setDepartments(data.departments || [])
      setUsers(data.users || [])
    } catch (e) {
      setError(t('comp.workload.loadFail'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const maxDept = Math.max(1, ...departments.map((d) => d.totalAssignments))
  const maxUser = Math.max(1, ...users.map((u) => u.total))

  const deptLabel = (d: DeptRow) =>
    d.departmentId == null ? t('comp.workload.unassigned') : d.departmentName || '—'

  return (
    <div className="table-wrapper" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>{t('comp.workload.title')}</h2>
        <button type="button" className="refresh-button" onClick={() => void load()}>
          {t('comp.workload.refresh')}
        </button>
      </div>
      <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.5rem' }}>{t('comp.workload.subtitle')}</p>

      {loading ? (
        <p>{t('common.loading')}</p>
      ) : error ? (
        <p style={{ color: '#dc2626' }}>{error}</p>
      ) : (
        <>
          <section style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>{t('comp.workload.byDepartment')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {departments.map((d) => (
                <div key={d.departmentId ?? 'none'} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '8rem', flexShrink: 0, fontSize: '0.875rem' }}>{deptLabel(d)}</div>
                  <div style={{ flex: 1, height: '1.25rem', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${(d.totalAssignments / maxDept) * 100}%`,
                        background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
                        borderRadius: '4px',
                        minWidth: d.totalAssignments > 0 ? '4px' : 0,
                      }}
                    />
                  </div>
                  <div style={{ width: '5rem', textAlign: 'right', fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }}>
                    {d.totalAssignments}
                    <span style={{ color: '#94a3b8', marginLeft: '0.25rem' }}>({d.memberCount})</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>{t('comp.workload.byPerson')}</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem' }}>{t('comp.workload.colName')}</th>
                    <th style={{ padding: '0.5rem' }}>{t('comp.workload.colDept')}</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>{t('comp.workload.colTotal')}</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>일감</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>GMP</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>{t('comp.workload.colIssues')}</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>{t('comp.workload.colTickets')}</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>WBS</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>{t('comp.workload.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users
                    .slice()
                    .sort((a, b) => b.total - a.total)
                    .map((u) => (
                      <tr key={u.userId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.5rem' }}>
                          <div style={{ fontWeight: 500 }}>{u.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{u.username}</div>
                        </td>
                        <td style={{ padding: '0.5rem' }}>{u.departmentName || t('comp.workload.unassigned')}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                            <span>{u.total}</span>
                            <div
                              style={{
                                width: '3rem',
                                height: '6px',
                                background: '#f1f5f9',
                                borderRadius: '3px',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${(u.total / maxUser) * 100}%`,
                                  height: '100%',
                                  background: '#10b981',
                                  borderRadius: '3px',
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{u.projectTasks}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{u.gmpRecords}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{u.issues}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{u.tickets}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{u.ganttTasks}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{u.actionItems}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
