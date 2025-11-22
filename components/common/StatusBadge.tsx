'use client'

export function StatusBadge({ status }: { status: string }) {
  const tone =
    {
      'In Progress': 'badge--green',
      Planning: 'badge--blue',
      Issued: 'badge--red',
    }[status] || ''

  return <span className={`badge ${tone}`}>{status}</span>
}

