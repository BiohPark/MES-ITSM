'use client'

import { useState, useEffect, useCallback } from 'react'

interface Transition {
  id: number
  name: string
  to_status_id: number
  to_status_name: string
  description?: string
}

interface TaskTransitionsResponse {
  task_id: string
  current_status: string | null
  available_transitions: Transition[]
}

interface TaskStatusActionsProps {
  taskId: string
  currentStatus?: string
  onStatusChange?: (newStatus: string) => void
  userRole?: string
  userId?: string
}

export function TaskStatusActions({
  taskId,
  currentStatus,
  onStatusChange,
  userRole,
  userId,
}: TaskStatusActionsProps) {
  const [transitions, setTransitions] = useState<Transition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [executing, setExecuting] = useState<number | null>(null)
  const [currentTaskStatus, setCurrentTaskStatus] = useState<string | null>(currentStatus || null)

  const fetchTransitions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // 쿼리 파라미터 구성
      const params = new URLSearchParams()
      if (userRole) params.append('user_role', userRole)
      if (userId) params.append('user_id', userId)

      const url = `/api/tasks/${taskId}/transitions${params.toString() ? `?${params.toString()}` : ''}`
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '전환 목록을 가져오는데 실패했습니다.' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data: TaskTransitionsResponse = await response.json()
      setTransitions(data.available_transitions || [])
      setCurrentTaskStatus(data.current_status || null)
    } catch (err) {
      console.error('Error fetching transitions:', err)
      setError(err instanceof Error ? err.message : '전환 목록을 불러오는데 실패했습니다.')
      setTransitions([])
    } finally {
      setLoading(false)
    }
  }, [taskId, userRole, userId])

  // 사용 가능한 전환 목록 가져오기
  useEffect(() => {
    fetchTransitions()
  }, [fetchTransitions])

  // 전환 실행
  const handleTransition = async (transitionId: number, transitionName: string) => {
    if (executing !== null) {
      return // 이미 실행 중
    }

    try {
      setExecuting(transitionId)
      setError(null)

      const response = await fetch(`/api/tasks/${taskId}/transition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          transition_id: transitionId,
          user_role: userRole,
          user_id: userId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '상태 전환에 실패했습니다.' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      
      // 성공 시 전환 목록 새로고침
      await fetchTransitions()
      
      // 콜백 호출
      if (onStatusChange && data.new_status) {
        onStatusChange(data.new_status)
      }

      // 성공 메시지 표시 (선택사항)
      console.log('Status changed:', data.message)
    } catch (err) {
      console.error('Error executing transition:', err)
      setError(err instanceof Error ? err.message : '상태 전환에 실패했습니다.')
    } finally {
      setExecuting(null)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '0.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
        전환 목록 로딩 중...
      </div>
    )
  }

  if (error && transitions.length === 0) {
    return (
      <div style={{ 
        padding: '0.75rem', 
        background: '#fee2e2', 
        border: '1px solid #fecaca', 
        borderRadius: '0.5rem',
        color: '#991b1b',
        fontSize: '0.875rem'
      }}>
        {error}
      </div>
    )
  }

  if (transitions.length === 0) {
    return (
      <div style={{ padding: '0.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
        {currentTaskStatus ? `현재 상태: ${currentTaskStatus}` : '사용 가능한 전환이 없습니다.'}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {currentTaskStatus && (
        <div style={{ 
          padding: '0.5rem', 
          fontSize: '0.875rem', 
          color: '#374151',
          fontWeight: 500
        }}>
          현재 상태: <span style={{ color: '#059669' }}>{currentTaskStatus}</span>
        </div>
      )}

      {error && (
        <div style={{ 
          padding: '0.75rem', 
          background: '#fee2e2', 
          border: '1px solid #fecaca', 
          borderRadius: '0.5rem',
          color: '#991b1b',
          fontSize: '0.875rem'
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {transitions.map((transition) => (
          <button
            key={transition.id}
            onClick={() => handleTransition(transition.id, transition.name)}
            disabled={executing === transition.id}
            style={{
              padding: '0.5rem 1rem',
              background: executing === transition.id ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: executing === transition.id ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
              transition: 'background-color 0.2s ease',
              opacity: executing === transition.id ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (executing !== transition.id) {
                e.currentTarget.style.background = '#2563eb'
              }
            }}
            onMouseLeave={(e) => {
              if (executing !== transition.id) {
                e.currentTarget.style.background = '#3b82f6'
              }
            }}
            title={transition.description || transition.name}
          >
            {executing === transition.id ? '처리 중...' : transition.name}
            {transition.to_status_name && (
              <span style={{ marginLeft: '0.5rem', opacity: 0.9 }}>
                → {transition.to_status_name}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

