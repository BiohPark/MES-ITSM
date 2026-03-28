'use client'

import { useState, useMemo } from 'react'
import type { Project } from '@/types/project'
import { StatusBadge } from '../common/StatusBadge'
import { Progress } from '../common/Progress'
import { useI18n } from '@/lib/i18n'

export function ValPackagesTable({
  valPackages,
  loading,
  error,
  onRefresh,
  onValPackageClick,
  onNewValPackage,
  isDeleteMode,
  selectedValPackageIds,
  onToggleValPackageSelection,
  onDeleteModeChange,
  onBatchDelete,
}: {
  valPackages: Project[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onValPackageClick: (valPackage: Project) => void
  onNewValPackage: () => void
  isDeleteMode: boolean
  selectedValPackageIds: Set<string>
  onToggleValPackageSelection: (valPackageId: string) => void
  onDeleteModeChange: (enabled: boolean) => void
  onBatchDelete: () => void
}) {
  const { t } = useI18n()
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterOwner, setFilterOwner] = useState<string>('')

  // 고유한 상태 및 담당 리더 목록 추출
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>()
    valPackages.forEach((valPackage) => {
      if (valPackage.status) statuses.add(valPackage.status)
    })
    return Array.from(statuses).sort()
  }, [valPackages])

  const uniqueOwners = useMemo(() => {
    const owners = new Set<string>()
    valPackages.forEach((valPackage) => {
      if (valPackage.owner) owners.add(valPackage.owner)
    })
    return Array.from(owners).sort()
  }, [valPackages])

  // 필터링된 VAL Pkg 목록
  const filteredValPackages = useMemo(() => {
    return valPackages.filter((valPackage) => {
      if (filterStatus && valPackage.status !== filterStatus) return false
      if (filterOwner && valPackage.owner !== filterOwner) return false
      return true
    })
  }, [valPackages, filterStatus, filterOwner])

  if (loading) {
    return (
      <div className="placeholder">
        <p>{t('comp.ui.loading')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="placeholder">
        <p style={{ color: '#e74c3c' }}>{t('comp.ui.errorPrefix')} {error}</p>
        <button onClick={onRefresh} className="refresh-button">
          {t('comp.ui.retry')}
        </button>
      </div>
    )
  }

  if (valPackages.length === 0) {
    return (
      <div className="table-wrapper">
        <div className="table-header">
          <h2>{t('comp.valTable.title')}</h2>
          <div className="table-actions">
            <button onClick={onRefresh} className="refresh-button">
              {t('comp.ui.refresh')}
            </button>
            {!isDeleteMode ? (
              <>
                <button onClick={onNewValPackage} className="primary-button">
                  New
                </button>
                <button
                  onClick={() => onDeleteModeChange(true)}
                  className="primary-button"
                  style={{ backgroundColor: '#e74c3c' }}
                >
                  {t('comp.ui.delete')}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    onDeleteModeChange(false)
                  }}
                  className="refresh-button"
                >
                  {t('comp.ui.cancel')}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="placeholder">
          <p>{t('comp.valTable.noVal')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>
          {t('comp.valTable.title')}
          {filteredValPackages.length > 0 && (
            <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: '#64748b' }}>
              {t('comp.valTable.listCount', { n: filteredValPackages.length })}
            </span>
          )}
        </h2>
        <div className="table-actions">
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginRight: '0.75rem' }}>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              <option value="">{t('comp.valTable.filterAllStatus')}</option>
              {uniqueStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
              style={{
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              <option value="">{t('comp.valTable.filterAllLeaders')}</option>
              {uniqueOwners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
            {(filterStatus || filterOwner) && (
              <button
                onClick={() => {
                  setFilterStatus('')
                  setFilterOwner('')
                }}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: '#f1f5f9',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                {t('comp.tasks.resetFilters')}
              </button>
            )}
          </div>
          <button onClick={onRefresh} className="refresh-button">
            {t('comp.ui.refresh')}
          </button>
          {!isDeleteMode ? (
            <>
              <button onClick={onNewValPackage} className="primary-button">
                New
              </button>
              <button
                onClick={() => onDeleteModeChange(true)}
                className="primary-button"
                style={{ backgroundColor: '#e74c3c' }}
              >
                {t('comp.ui.delete')}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  onDeleteModeChange(false)
                }}
                className="refresh-button"
              >
                {t('comp.ui.cancel')}
              </button>
              {selectedValPackageIds.size > 0 && (
                <button
                  onClick={onBatchDelete}
                  className="primary-button"
                  style={{ backgroundColor: '#e74c3c' }}
                >
                  {t('comp.valTable.deleteVal')} ({selectedValPackageIds.size})
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {filteredValPackages.length === 0 ? (
        <div className="placeholder">
          <p>{t('comp.valTable.noMatch')}</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              {isDeleteMode && <th style={{ width: '40px' }}></th>}
              <th>{t('comp.valTable.colVal')}</th>
              <th>{t('comp.valTable.colLeader')}</th>
              <th>{t('comp.valTable.colHeadcount')}</th>
              <th>{t('comp.valTable.colStatus')}</th>
              <th>{t('comp.valTable.colProgress')}</th>
              <th>{t('comp.valTable.colSrb')}</th>
              <th>{t('comp.valTable.colStart')}</th>
              <th>{t('comp.valTable.colDue')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredValPackages.flatMap((valPackage) => [
              <tr
                key={valPackage.id}
                className="project-row"
                onClick={() => !isDeleteMode && onValPackageClick(valPackage)}
                style={{ cursor: isDeleteMode ? 'default' : 'pointer' }}
              >
                {isDeleteMode && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedValPackageIds.has(valPackage.id)}
                      onChange={() => onToggleValPackageSelection(valPackage.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                )}
                <td>
                  <p className="project-name">
                    {valPackage.name}
                  </p>
                  <span className="project-id">{valPackage.id}</span>
                </td>
                <td>{valPackage.owner}</td>
                <td>
                  {valPackage.members}
                  {t('comp.ui.name')}
                </td>
                <td>
                  <StatusBadge status={valPackage.status} />
                </td>
                <td>
                  <Progress 
                    value={valPackage.progress} 
                    start={(valPackage as any).start}
                    due={valPackage.due}
                  />
                </td>
                <td>{(valPackage as any).srb_ver || '-'}</td>
                <td>{(valPackage as any).start || '-'}</td>
                <td>{valPackage.due}</td>
              </tr>,
              ...(valPackage.children && valPackage.children.length > 0
                ? valPackage.children.map((child) => (
                    <tr
                      key={`${valPackage.id}-${child.id}`}
                      className="child-row"
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                      style={{ cursor: 'default' }}
                    >
                      {isDeleteMode && <td></td>}
                      <td className="child-cell">
                        <span className="child-indicator">└─</span>
                        <div className="child-content">
                          <p className="child-title">{child.title}</p>
                          <span className="child-id">{child.id}</span>
                        </div>
                      </td>
                      <td>{child.owner}</td>
                      <td>-</td>
                      <td>
                        <StatusBadge status={child.status} />
                      </td>
                      <td>
                        <Progress 
                          value={(child as any).progress || 0} 
                          start={(child as any).start}
                          due={child.due}
                        />
                      </td>
                      <td>-</td>
                      <td>{(child as any).start || '-'}</td>
                      <td>{child.due || '-'}</td>
                    </tr>
                  ))
                : [])
            ])}
          </tbody>
        </table>
      )}
    </div>
  )
}

