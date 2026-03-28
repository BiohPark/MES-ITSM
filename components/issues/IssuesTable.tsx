'use client'

import type { Issue } from '@/types/issue'
import { StatusBadge } from '../common/StatusBadge'
import { useI18n } from '@/lib/i18n'

export function IssuesTable({
  issues,
  loading,
  error,
  onRefresh,
  onIssueClick,
  onNewIssue,
  isDeleteMode,
  selectedIssueIds,
  onToggleIssueSelection,
  onDeleteModeChange,
  onBatchDelete,
}: {
  issues: Issue[]
  loading: boolean
  error: string | null
  onRefresh: () => void | Promise<void>
  onIssueClick: (issue: Issue) => void
  onNewIssue: () => void
  isDeleteMode: boolean
  selectedIssueIds: Set<string>
  onToggleIssueSelection: (issueId: string) => void
  onDeleteModeChange: (enabled: boolean) => void
  onBatchDelete: () => void
}) {
  const { t } = useI18n()
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

  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>{t('comp.issuesTable.title')}</h2>
        <div className="table-actions">
          <button onClick={onRefresh} className="refresh-button">
            {t('comp.ui.refresh')}
          </button>
          {!isDeleteMode ? (
            <>
              <button onClick={onNewIssue} className="primary-button">
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
              {selectedIssueIds.size > 0 && (
                <button
                  onClick={onBatchDelete}
                  className="primary-button"
                  style={{ backgroundColor: '#e74c3c' }}
                >
                  {t('comp.issuesTable.batchDelete', { n: selectedIssueIds.size })}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {issues.length === 0 ? (
        <div className="placeholder">
          <p>{t('comp.issuesTable.noIssues')}</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              {isDeleteMode && <th style={{ width: '40px' }}></th>}
              <th>{t('comp.issuesTable.colId')}</th>
              <th>{t('comp.issuesTable.colTitle')}</th>
              <th>{t('comp.issuesTable.colStatus')}</th>
              <th>{t('comp.issuesTable.colOwner')}</th>
              <th>{t('comp.issuesTable.colOccurred')}</th>
              <th>{t('comp.issuesTable.colDue')}</th>
              <th>{t('comp.issuesTable.colSwShort')}</th>
              <th>{t('comp.issuesTable.colCause')}</th>
              <th>{t('comp.issuesTable.colModule')}</th>
              <th>{t('comp.issuesTable.colDeviation')}</th>
              <th>{t('comp.issuesTable.colRelated')}</th>
              <th>{t('comp.issuesTable.colResolved')}</th>
              <th>{t('comp.issuesTable.colSw')}</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue) => (
              <tr
                key={issue.id}
                className="project-row"
                onClick={() => !isDeleteMode && onIssueClick(issue)}
                style={{ cursor: isDeleteMode ? 'default' : 'pointer' }}
              >
                {isDeleteMode && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIssueIds.has(issue.id)}
                      onChange={() => onToggleIssueSelection(issue.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                )}
                <td>
                  <span className="project-id">{issue.id}</span>
                </td>
                <td>
                  <p className="project-name">{issue.title}</p>
                </td>
                <td>
                  <StatusBadge status={issue.status} />
                </td>
                <td>{issue.owner}</td>
                <td>{issue.occurred_date || '-'}</td>
                <td>{issue.due_date || '-'}</td>
                <td>{issue.sw_version || '-'}</td>
                <td>{issue.cause_category || '-'}</td>
                <td>{issue.module || '-'}</td>
                <td>{issue.is_deviation ? 'Yes' : 'No'}</td>
                <td>{issue.related_issue_id ? issue.related_issue_id : '-'}</td>
                <td>{issue.resolved_date || '-'}</td>
                <td>{issue.resolved_sw_version || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

