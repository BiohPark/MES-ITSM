'use client'

import { useState, useMemo } from 'react'
import type { Project } from '@/types/project'
import { StatusBadge } from '../common/StatusBadge'
import { Progress } from '../common/Progress'

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

  if (valPackages.length === 0) {
    return (
      <div className="table-wrapper">
        <div className="table-header">
          <h2>VAL Pkg 목록</h2>
          <div className="table-actions">
            <button onClick={onRefresh} className="refresh-button">
              새로고침
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
              </>
            )}
          </div>
        </div>
        <div className="placeholder">
          <p>등록된 VAL Pkg가 없습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>VAL Pkg 목록 {filteredValPackages.length > 0 && <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: '#64748b' }}>({filteredValPackages.length}개)</span>}</h2>
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
              <option value="">전체 상태</option>
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
              <option value="">전체 담당 리더</option>
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
                필터 초기화
              </button>
            )}
          </div>
          <button onClick={onRefresh} className="refresh-button">
            새로고침
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
              {selectedValPackageIds.size > 0 && (
                <button
                  onClick={onBatchDelete}
                  className="primary-button"
                  style={{ backgroundColor: '#e74c3c' }}
                >
                  VAL Pkg 삭제 ({selectedValPackageIds.size})
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {filteredValPackages.length === 0 ? (
        <div className="placeholder">
          <p>필터 조건에 맞는 VAL Pkg가 없습니다.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              {isDeleteMode && <th style={{ width: '40px' }}></th>}
              <th>VAL Pkg</th>
              <th>담당 리더</th>
              <th>인원</th>
              <th>상태</th>
              <th>진척도(계획/실적)</th>
              <th>SRB Ver.</th>
              <th>시작일</th>
              <th>마감일</th>
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
                <td>{valPackage.members}명</td>
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

