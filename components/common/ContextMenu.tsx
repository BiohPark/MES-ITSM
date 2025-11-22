'use client'

import type { Project } from '@/types/project'

export function ContextMenu({
  x,
  y,
  projectName,
  onAddChild,
}: {
  x: number
  y: number
  projectName: string
  onAddChild: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '0.5rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        zIndex: 1000,
        minWidth: '180px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onAddChild}
        style={{
          width: '100%',
          padding: '0.75rem 1rem',
          textAlign: 'left',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          fontSize: '0.875rem',
          color: '#111827',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f1f5f9'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        하위 아이템 추가
      </button>
    </div>
  )
}

