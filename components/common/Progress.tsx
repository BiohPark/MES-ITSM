'use client'

import { useMemo } from 'react'

export function Progress({ value, start, due }: { value: number; start?: string; due?: string }) {
  // 계획 진행률 계산
  const calculatePlannedProgress = (): number => {
    if (!start || !due) return 0
    
    const startDate = new Date(start)
    const dueDate = new Date(due)
    const today = new Date()
    
    // 날짜를 자정으로 설정하여 일 단위 계산
    startDate.setHours(0, 0, 0, 0)
    dueDate.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    
    const totalDays = Math.ceil((dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const elapsedDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (totalDays <= 0) return 0
    if (elapsedDays < 0) return 0
    if (elapsedDays > totalDays) return 100
    
    return Math.round((elapsedDays / totalDays) * 100)
  }
  
  const plannedProgress = start && due ? calculatePlannedProgress() : null
  
  return (
    <div style={{ fontSize: '0.9rem', color: '#475569' }}>
      {plannedProgress !== null ? (
        <span>{plannedProgress}% / {value}%</span>
      ) : (
        <span>{value}%</span>
      )}
    </div>
  )
}

