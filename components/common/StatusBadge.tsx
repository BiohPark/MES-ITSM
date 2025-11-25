'use client'

import { memo } from 'react'

export const StatusBadge = memo(function StatusBadge({ status }: { status: string }) {
  // 상태를 정규화 (대소문자 구분 없이 처리)
  const normalizedStatus = status?.trim() || ''
  
  // 상태별 배경색 클래스 결정
  let tone = ''
  if (normalizedStatus.toLowerCase() === 'in progress' || normalizedStatus === 'In Progress') {
    tone = 'badge--green'
  } else if (normalizedStatus === 'Planning') {
    tone = 'badge--blue'
  } else if (normalizedStatus === 'Issued') {
    tone = 'badge--red'
  } else if (normalizedStatus === 'Completed') {
    tone = 'badge--yellow'
  } else if (normalizedStatus === 'Open') {
    tone = 'badge--blue'
  } else if (normalizedStatus === 'Closed' || normalizedStatus === 'Resolved') {
    tone = 'badge--gray'
  }

  return <span className={`badge ${tone}`}>{status}</span>
})

