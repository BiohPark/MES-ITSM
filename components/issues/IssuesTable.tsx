'use client'

import { useState } from 'react'
import type { Issue } from '@/types/issue'
import { StatusBadge } from '../common/StatusBadge'

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
  if (loading) {
    return (
      <div className="placeholder">
        <p>데이터를 불러오는 중...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="placeholder">
        <p style={{ color: '#e74c3c' }}>오류: {error}</p>
        <button onClick={onRefresh} className="refresh-button">
          다시 시도
        </button>
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>이슈 목록</h2>
        <div className="table-actions">
          <button onClick={onRefresh} className="refresh-button">
            새로고침
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
                삭제
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
                취소
              </button>
              {selectedIssueIds.size > 0 && (
                <button
                  onClick={onBatchDelete}
                  className="primary-button"
                  style={{ backgroundColor: '#e74c3c' }}
                >
                  선택 삭제 ({selectedIssueIds.size})
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {issues.length === 0 ? (
        <div className="placeholder">
          <p>등록된 이슈가 없습니다.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              {isDeleteMode && <th style={{ width: '40px' }}></th>}
              <th>이슈 ID</th>
              <th>제목</th>
              <th>상태</th>
              <th>담당자</th>
              <th>발생일</th>
              <th>마감일</th>
              <th>S/W 버전</th>
              <th>원인 분류</th>
              <th>모듈</th>
              <th>Deviation</th>
              <th>관련 이슈</th>
              <th>해결일</th>
              <th>해결 S/W 버전</th>
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

