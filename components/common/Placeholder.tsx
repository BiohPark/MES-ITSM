'use client'

export function Placeholder({ label }: { label: string }) {
  return (
    <div className="placeholder">
      <p>{label} 화면은 곧 제공될 예정입니다.</p>
    </div>
  )
}

