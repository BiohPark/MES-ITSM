'use client'

import { useMemo, useState } from 'react'
import type { Project } from '@/types/project'

export function GanttChartView({
  projects,
  loading,
  error,
  onRefresh,
}: {
  projects: Project[]
  loading: boolean
  error: string | null
  onRefresh: () => void | Promise<void>
}) {
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => {
    const today = new Date()
    const start = new Date(today)
    start.setMonth(start.getMonth() - 1)
    const end = new Date(today)
    end.setMonth(end.getMonth() + 3)
    return { start, end }
  })

  const allItems = useMemo(() => {
    const items: Array<{
      id: string
      name: string
      start: Date
      end: Date
      type: 'project' | 'task'
      projectId?: string
      projectName?: string
    }> = []

    projects.forEach((project) => {
      if ((project as any).start && project.due) {
        items.push({
          id: project.id,
          name: project.name,
          start: new Date((project as any).start),
          end: new Date(project.due),
          type: 'project',
        })
      }

      project.children?.forEach((child) => {
        if ((child as any).start && child.due) {
          items.push({
            id: child.id,
            name: child.title,
            start: new Date((child as any).start),
            end: new Date(child.due),
            type: 'task',
            projectId: project.id,
            projectName: project.name,
          })
        }
      })
    })

    return items
  }, [projects])

  const days = useMemo(() => {
    const daysArray: Date[] = []
    const current = new Date(dateRange.start)
    while (current <= dateRange.end) {
      daysArray.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    return daysArray
  }, [dateRange])

  const getItemPosition = (item: typeof allItems[0]) => {
    const itemStart = item.start.getTime()
    const itemEnd = item.end.getTime()
    const rangeStart = dateRange.start.getTime()
    const rangeEnd = dateRange.end.getTime()

    if (itemEnd < rangeStart || itemStart > rangeEnd) {
      return null
    }

    const startOffset = Math.max(0, itemStart - rangeStart)
    const endOffset = Math.min(rangeEnd - rangeStart, itemEnd - rangeStart)
    const left = (startOffset / (rangeEnd - rangeStart)) * 100
    const width = ((endOffset - startOffset) / (rangeEnd - rangeStart)) * 100

    return { left, width }
  }

  if (loading) {
    return (
      <div className="table-wrapper">
        <div className="placeholder">
          <p>데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="table-wrapper">
        <div className="placeholder">
          <p>에러 발생: {error}</p>
          <button onClick={onRefresh} className="refresh-button">
            새로고침
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>Gantt Chart</h2>
        <div className="table-actions">
          <button onClick={onRefresh} className="refresh-button">
            새로고침
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', marginTop: '1.5rem' }}>
        <div style={{ minWidth: '100%', position: 'relative' }}>
          {/* 헤더 */}
          <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '1rem' }}>
            <div style={{ width: '200px', padding: '0.75rem', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>
              항목
            </div>
            <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
              {days.map((day, idx) => {
                if (idx % 7 === 0 || idx === 0) {
                  return (
                    <div
                      key={day.getTime()}
                      style={{
                        minWidth: `${100 / Math.ceil(days.length / 7)}%`,
                        padding: '0.75rem 0.5rem',
                        textAlign: 'center',
                        fontSize: '0.85rem',
                        borderRight: '1px solid #e2e8f0',
                      }}
                    >
                      {day.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </div>
                  )
                }
                return null
              })}
            </div>
          </div>

          {/* 프로젝트 및 일감 바 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {allItems.map((item) => {
              const position = getItemPosition(item)
              if (!position) return null

              return (
                <div key={item.id} style={{ display: 'flex', minHeight: '40px' }}>
                  <div
                    style={{
                      width: '200px',
                      padding: '0.75rem',
                      borderRight: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '0.9rem',
                    }}
                  >
                    <span style={{ marginRight: '0.5rem' }}>{item.type === 'project' ? '📁' : '└─'}</span>
                    <span>{item.name}</span>
                    {item.type === 'task' && item.projectName && (
                      <span style={{ marginLeft: '0.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                        ({item.projectName})
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1, position: 'relative', borderRight: '1px solid #e2e8f0' }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: `${position.left}%`,
                        width: `${position.width}%`,
                        height: '24px',
                        backgroundColor: item.type === 'project' ? '#3b82f6' : '#10b981',
                        borderRadius: '4px',
                        marginTop: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 0.5rem',
                        color: 'white',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                      title={`${item.name} (${item.start.toLocaleDateString('ko-KR')} ~ ${item.end.toLocaleDateString('ko-KR')})`}
                    >
                      {position.width > 5 && item.name}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {allItems.length === 0 && (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              <p>표시할 프로젝트나 일감이 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

