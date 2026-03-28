'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n'

type WorkloadCounts = {
  projectTasks: number
  gmpRecords: number
  issues: number
  tickets: number
  ganttTasks: number
  actionItems: number
  total: number
}

type UserRow = {
  userId: string
  name: string
  username: string
  departmentId: number | null
  departmentName: string | null
  counts: WorkloadCounts
}

type DeptRow = {
  departmentId: number | null
  departmentName: string
  userCount: number
  counts: WorkloadCounts
}

function deptKey(departmentId: number | null): string {
  return departmentId == null ? 'none' : String(departmentId)
}

function emptyCounts(): WorkloadCounts {
  return {
    projectTasks: 0,
    gmpRecords: 0,
    issues: 0,
    tickets: 0,
    ganttTasks: 0,
    actionItems: 0,
    total: 0,
  }
}

function sumCounts(c: WorkloadCounts): number {
  return (
    c.projectTasks +
    c.gmpRecords +
    c.issues +
    c.tickets +
    c.ganttTasks +
    c.actionItems
  )
}

function aggregateDeptFromUsers(users: UserRow[], noDeptLabel: string): DeptRow[] {
  const map = new Map<
    string,
    { departmentId: number | null; departmentName: string; userCount: number; counts: WorkloadCounts }
  >()
  for (const u of users) {
    const key = deptKey(u.departmentId)
    if (!map.has(key)) {
      const name =
        u.departmentId == null
          ? noDeptLabel
          : (u.departmentName && u.departmentName.trim()) || noDeptLabel
      map.set(key, {
        departmentId: u.departmentId,
        departmentName: name,
        userCount: 0,
        counts: emptyCounts(),
      })
    }
    const bucket = map.get(key)!
    bucket.userCount += 1
    const c = u.counts
    bucket.counts.projectTasks += c.projectTasks
    bucket.counts.gmpRecords += c.gmpRecords
    bucket.counts.issues += c.issues
    bucket.counts.tickets += c.tickets
    bucket.counts.ganttTasks += c.ganttTasks
    bucket.counts.actionItems += c.actionItems
  }
  for (const b of map.values()) {
    b.counts.total = sumCounts(b.counts)
  }
  return Array.from(map.values()).sort((a, b) => b.counts.total - a.counts.total)
}

export function WorkloadView() {
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [byUser, setByUser] = useState<UserRow[]>([])
  const [byDepartment, setByDepartment] = useState<DeptRow[]>([])

  /** null = 모든 부서 표시, Set = 해당 키만 표시 */
  const [visibleDeptKeys, setVisibleDeptKeys] = useState<Set<string> | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/workload/summary')
      if (!res.ok) {
        if (res.status === 401) {
          setError(t('workload.unauthorized'))
          return
        }
        throw new Error('fetch failed')
      }
      const data = await res.json()
      setByUser(data.byUser || [])
      setByDepartment(data.byDepartment || [])
    } catch {
      setError(t('workload.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const allDeptKeys = useMemo(
    () => byDepartment.map((d) => deptKey(d.departmentId)),
    [byDepartment]
  )

  const filteredUsers = useMemo(() => {
    let rows = byUser
    if (visibleDeptKeys !== null) {
      rows = rows.filter((u) => visibleDeptKeys.has(deptKey(u.departmentId)))
    }
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          (u.username && u.username.toLowerCase().includes(q))
      )
    }
    return rows
  }, [byUser, visibleDeptKeys, searchQuery])

  const noDeptLabel = t('workload.noDept')

  const filteredDepartments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let baseUsers = byUser
    if (visibleDeptKeys !== null) {
      baseUsers = baseUsers.filter((u) => visibleDeptKeys.has(deptKey(u.departmentId)))
    }
    if (q) {
      baseUsers = baseUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          (u.username && u.username.toLowerCase().includes(q))
      )
      return aggregateDeptFromUsers(baseUsers, noDeptLabel)
    }
    if (visibleDeptKeys === null) return byDepartment
    return byDepartment.filter((d) => visibleDeptKeys.has(deptKey(d.departmentId)))
  }, [byUser, byDepartment, visibleDeptKeys, searchQuery, noDeptLabel])

  const maxDeptTotal = useMemo(
    () => Math.max(1, ...filteredDepartments.map((d) => d.counts.total)),
    [filteredDepartments]
  )
  const maxUserTotal = useMemo(
    () => Math.max(1, ...filteredUsers.map((u) => u.counts.total)),
    [filteredUsers]
  )

  const toggleDeptKey = (key: string) => {
    setVisibleDeptKeys((prev) => {
      const all = allDeptKeys
      if (prev === null) {
        const next = new Set(all)
        next.delete(key)
        return next
      }
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      if (next.size === 0) return next
      if (next.size === all.length && all.every((k) => next.has(k))) return null
      return next
    })
  }

  const selectAllDepts = () => {
    setVisibleDeptKeys(null)
  }

  const clearFilters = () => {
    setVisibleDeptKeys(null)
    setSearchQuery('')
  }

  const isDeptChecked = (key: string) =>
    visibleDeptKeys === null || visibleDeptKeys.has(key)

  const hasActiveFilters =
    visibleDeptKeys !== null || searchQuery.trim().length > 0

  if (loading) {
    return (
      <div className="placeholder" style={{ padding: '2rem' }}>
        <p>{t('common.loading')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="placeholder" style={{ padding: '2rem', color: '#b91c1c' }}>
        <p>{error}</p>
        <button type="button" className="refresh-button" onClick={() => void load()}>
          {t('workload.retry')}
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>{t('workload.title')}</h2>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.875rem', color: '#64748b' }}>{t('workload.subtitle')}</p>
        </div>
        <button type="button" className="refresh-button" onClick={() => void load()}>
          {t('workload.refresh')}
        </button>
      </div>

      <section
        style={{
          marginBottom: '1.25rem',
          padding: '0.85rem 1rem',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
        }}
        aria-label={t('workload.filterTitle')}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', color: '#334155' }}>
              {t('workload.filterByDept')}
            </div>
            <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0 0 0.5rem' }}>{t('workload.filterDeptHint')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={visibleDeptKeys === null}
                  onChange={(e) => {
                    if (e.target.checked) selectAllDepts()
                    else setVisibleDeptKeys(new Set())
                  }}
                />
                {t('workload.filterDeptAll')}
              </label>
              {byDepartment.map((d) => {
                const k = deptKey(d.departmentId)
                return (
                  <label
                    key={k}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={isDeptChecked(k)}
                      onChange={() => toggleDeptKey(k)}
                    />
                    {d.departmentName}
                  </label>
                )
              })}
            </div>
          </div>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <label htmlFor="workload-filter-search" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem', color: '#334155' }}>
              {t('workload.filterSearchLabel')}
            </label>
            <input
              id="workload-filter-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              placeholder={t('workload.filterSearchPlaceholder')}
              autoComplete="off"
              style={{ width: '100%', maxWidth: '280px' }}
            />
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button type="button" className="btn" onClick={clearFilters} disabled={!hasActiveFilters} style={{ opacity: hasActiveFilters ? 1 : 0.5 }}>
              {t('workload.filterClear')}
            </button>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: 600 }}>{t('workload.byDepartment')}</h3>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>{t('workload.byDepartmentHint')}</p>
        {filteredDepartments.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{t('workload.filterNoResults')}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', minWidth: '640px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '0.6rem' }}>{t('workload.colDepartment')}</th>
                  <th style={{ padding: '0.6rem', width: '80px' }}>{t('workload.colHeadcount')}</th>
                  <th style={{ padding: '0.6rem', width: '90px' }}>{t('workload.colTotal')}</th>
                  <th style={{ padding: '0.6rem' }}>{t('workload.colBar')}</th>
                  <th style={{ padding: '0.6rem' }}>{t('workload.colBreakdown')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredDepartments.map((row) => (
                  <tr key={String(row.departmentId ?? 'none')} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.6rem', fontWeight: 500 }}>{row.departmentName}</td>
                    <td style={{ padding: '0.6rem' }}>{row.userCount}</td>
                    <td style={{ padding: '0.6rem' }}>{row.counts.total}</td>
                    <td style={{ padding: '0.6rem', minWidth: '120px' }}>
                      <div
                        style={{
                          height: 8,
                          borderRadius: 4,
                          background: '#e2e8f0',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${(row.counts.total / maxDeptTotal) * 100}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </td>
                    <td style={{ padding: '0.6rem', color: '#475569', fontSize: '0.8rem' }}>
                      {t('workload.breakdown', {
                        pt: row.counts.projectTasks,
                        gmp: row.counts.gmpRecords,
                        is: row.counts.issues,
                        tk: row.counts.tickets,
                        wbs: row.counts.ganttTasks,
                        ac: row.counts.actionItems,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: 600 }}>{t('workload.byPerson')}</h3>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>{t('workload.byPersonHint')}</p>
        {filteredUsers.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{t('workload.filterNoResults')}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '0.6rem' }}>{t('workload.colName')}</th>
                  <th style={{ padding: '0.6rem' }}>{t('workload.colDepartment')}</th>
                  <th style={{ padding: '0.6rem', width: '80px' }}>{t('workload.colTotal')}</th>
                  <th style={{ padding: '0.6rem' }}>{t('workload.colBar')}</th>
                  <th style={{ padding: '0.6rem' }}>{t('workload.colBreakdown')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers
                  .slice()
                  .sort((a, b) => b.counts.total - a.counts.total)
                  .map((row) => (
                    <tr key={row.userId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.6rem' }}>
                        {row.name}
                        {row.username ? (
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}> ({row.username})</span>
                        ) : null}
                      </td>
                      <td style={{ padding: '0.6rem', color: '#475569' }}>
                        {row.departmentName || t('workload.noDept')}
                      </td>
                      <td style={{ padding: '0.6rem' }}>{row.counts.total}</td>
                      <td style={{ padding: '0.6rem', minWidth: '120px' }}>
                        <div
                          style={{
                            height: 8,
                            borderRadius: 4,
                            background: '#e2e8f0',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${(row.counts.total / maxUserTotal) * 100}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #0ea5e9, #22c55e)',
                              borderRadius: 4,
                            }}
                          />
                        </div>
                      </td>
                      <td style={{ padding: '0.6rem', color: '#475569', fontSize: '0.8rem' }}>
                        {t('workload.breakdown', {
                          pt: row.counts.projectTasks,
                          gmp: row.counts.gmpRecords,
                          is: row.counts.issues,
                          tk: row.counts.tickets,
                          wbs: row.counts.ganttTasks,
                          ac: row.counts.actionItems,
                        })}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
