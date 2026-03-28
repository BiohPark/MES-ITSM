'use client'

import { useI18n } from '@/lib/i18n'
import { useState, useEffect, useMemo, useCallback } from 'react'
import type { Project } from '@/types/project'

interface TaskSchedule {
  taskId: string
  taskIndex: number
  taskName: string
  durationDays: number
  startDate: string | null
  es: number
  ef: number
  ls: number
  lf: number
  totalFloat: number
  freeFloat: number
  isCritical: boolean
}

interface Predecessor {
  predecessor_id: number
  taskId: string
  predecessorTaskId: string
  dependencyType: string
  lagDays: number
  predecessorTaskIndex: number
  taskIndex?: number
}

interface ScheduleViewProps {
  project: Project
  onRefresh?: () => void | Promise<void>
}

export function ScheduleView({ project, onRefresh }: ScheduleViewProps) {
  const { t, locale } = useI18n()
  const dateLocale = locale.startsWith('en') ? 'en-US' : 'ko-KR'
  const [schedules, setSchedules] = useState<TaskSchedule[]>([])
  const [predecessors, setPredecessors] = useState<Map<string, Predecessor[]>>(new Map())
  const [predecessorStrings, setPredecessorStrings] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  // 일정 데이터 로드
  const loadSchedule = useCallback(async () => {
    if (!project.id) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/project/schedule/${project.id}`)
      if (!response.ok) {
        throw new Error('Failed to load schedule')
      }

      const data = await response.json()
      setSchedules(data.schedules || [])

      // 종속성 데이터 로드
      const predResponse = await fetch(`/api/project/predecessors?projectId=${project.id}`)
      if (predResponse.ok) {
        const predData = await predResponse.json()
        const predMap = new Map<string, Predecessor[]>()
        const predStringMap = new Map<string, string>()

        // 종속성을 작업별로 그룹화
        const predsByTask = new Map<string, Predecessor[]>()
        predData.predecessors?.forEach((pred: Predecessor) => {
          if (!predsByTask.has(pred.taskId)) {
            predsByTask.set(pred.taskId, [])
          }
          predsByTask.get(pred.taskId)!.push(pred)
        })

        // 각 작업의 종속성을 문자열로 변환
        predsByTask.forEach((preds, taskId) => {
          predMap.set(taskId, preds)
          const predString = preds
            .map(p => {
              const lagStr = p.lagDays === 0 ? '' : (p.lagDays > 0 ? `+${p.lagDays}` : `${p.lagDays}`)
              return `${p.predecessorTaskIndex}${p.dependencyType}${lagStr}`
            })
            .join(', ')
          predStringMap.set(taskId, predString)
        })

        setPredecessors(predMap)
        setPredecessorStrings(predStringMap)
      }
    } catch (err: any) {
      setError(err.message || t('comp.schedule.loadFail'))
      console.error('Error loading schedule:', err)
    } finally {
      setLoading(false)
    }
  }, [project.id, t])

  useEffect(() => {
    void loadSchedule()
  }, [loadSchedule])

  // 종속성 문자열 업데이트
  const handlePredecessorChange = async (taskId: string, value: string) => {
    setPredecessorStrings(prev => {
      const newMap = new Map(prev)
      newMap.set(taskId, value)
      return newMap
    })
  }

  // 종속성 저장
  const handleSavePredecessors = async (taskId: string) => {
    const predString = predecessorStrings.get(taskId) || ''

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/project/predecessors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId,
          projectId: project.id,
          predecessorString: predString,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('comp.schedule.saveFail'))
      }

      setEditingTaskId(null)
      await loadSchedule()
      if (onRefresh) {
        onRefresh()
      }
    } catch (err: any) {
      setError(err.message || t('comp.schedule.saveFail'))
      console.error('Error saving predecessors:', err)
    } finally {
      setLoading(false)
    }
  }

  // 작업 목록 (프로젝트의 children)
  const tasks = useMemo(() => {
    return project.children || []
  }, [project.children])

  if (loading && schedules.length === 0) {
    return (
      <div className="placeholder">
        <p>{t('comp.schedule.loading')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="placeholder">
        <p style={{ color: '#e74c3c' }}>
          {t('comp.ui.errorPrefix')} {error}
        </p>
        <button onClick={() => void loadSchedule()} className="refresh-button">
          {t('comp.ui.retry')}
        </button>
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>{t('comp.schedule.title')}</h2>
        <div className="table-actions">
          <button onClick={() => void loadSchedule()} className="refresh-button">
            {t('comp.ui.refresh')}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#F4F6F8', borderRadius: '4px' }}>
        <h3 style={{ marginTop: 0, fontSize: '0.875rem', fontWeight: 600, color: '#333' }}>{t('comp.schedule.usage')}</h3>
        <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', fontSize: '0.875rem', color: '#666' }}>
          <li>{t('comp.schedule.usageIndex')}</li>
          <li>{t('comp.schedule.usageB1')}</li>
          <li>{t('comp.schedule.usageB2')}</li>
          <li>{t('comp.schedule.usageB3')}</li>
          <li>{t('comp.schedule.usageB4')}</li>
        </ul>
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: '60px' }}>{t('comp.schedule.colIndex')}</th>
            <th>{t('comp.schedule.colName')}</th>
            <th style={{ width: '200px' }}>{t('comp.schedule.colPred')}</th>
            <th style={{ width: '80px' }}>{t('comp.schedule.colDuration')}</th>
            <th style={{ width: '100px' }}>{t('comp.schedule.colStart')}</th>
            <th style={{ width: '100px' }}>{t('comp.schedule.colEnd')}</th>
            <th style={{ width: '80px' }}>{t('comp.schedule.colFloat')}</th>
            <th style={{ width: '80px' }}>{t('comp.schedule.colCritical')}</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const schedule = schedules.find(s => s.taskId === task.id)
            const predString = predecessorStrings.get(task.id) || ''
            const isEditing = editingTaskId === task.id

            // task_index가 없으면 순서대로 할당
            const taskIndex = (task as any).task_index || tasks.indexOf(task) + 1

            return (
              <tr
                key={task.id}
                style={{
                  backgroundColor: schedule?.isCritical ? '#ffebee' : schedule?.totalFloat === 0 ? '#fff3e0' : undefined,
                }}
              >
                <td style={{ textAlign: 'center', fontWeight: 600, color: schedule?.isCritical ? '#c62828' : '#333' }}>
                  {taskIndex}
                </td>
                <td>
                  <strong>{task.title}</strong>
                  <br />
                  <span style={{ fontSize: '0.75rem', color: '#666' }}>{task.id}</span>
                </td>
                <td>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={predString}
                        onChange={(e) => handlePredecessorChange(task.id, e.target.value)}
                        placeholder={t('comp.schedule.predPh')}
                        style={{
                          flex: 1,
                          padding: '0.375rem 0.5rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSavePredecessors(task.id)
                          } else if (e.key === 'Escape') {
                            setEditingTaskId(null)
                            loadSchedule()
                          }
                        }}
                        autoFocus
                      />
                      <button
                        onClick={() => handleSavePredecessors(task.id)}
                        className="primary-button"
                        style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
                      >
                        {t('comp.schedule.save')}
                      </button>
                      <button
                        onClick={() => {
                          setEditingTaskId(null)
                          loadSchedule()
                        }}
                        className="refresh-button"
                        style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
                      >
                        {t('comp.ui.cancel')}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.875rem', color: predString ? '#333' : '#999' }}>
                        {predString || t('comp.schedule.none')}
                      </span>
                      <button
                        onClick={() => setEditingTaskId(task.id)}
                        className="refresh-button"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      >
                        {t('comp.schedule.edit')}
                      </button>
                    </div>
                  )}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {schedule ? t('comp.gantt.dayCount', { n: String(schedule.durationDays) }) : '-'}
                </td>
                <td style={{ textAlign: 'center', fontSize: '0.875rem' }}>
                  {schedule?.startDate || '-'}
                </td>
                <td style={{ textAlign: 'center', fontSize: '0.875rem' }}>
                  {schedule ? new Date(schedule.startDate || '').toLocaleDateString(dateLocale) : '-'}
                </td>
                <td style={{ textAlign: 'center', color: schedule?.totalFloat === 0 ? '#c62828' : '#333' }}>
                  {schedule ? t('comp.gantt.dayCount', { n: String(schedule.totalFloat) }) : '-'}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {schedule?.isCritical ? (
                    <span style={{ color: '#c62828', fontWeight: 600 }}>●</span>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

