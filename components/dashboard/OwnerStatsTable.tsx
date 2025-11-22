'use client'

export function OwnerStatsTable({ data }: { data: Array<{ owner: string; projects: number; tasks: number; avgProgress: number }> }) {
  if (data.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        <p>데이터가 없습니다.</p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>
              담당자
            </th>
            <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>
              프로젝트
            </th>
            <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>
              일감
            </th>
            <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>
              평균 진행률
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.owner} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#111827' }}>{item.owner}</td>
              <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', color: '#475569' }}>
                {item.projects}
              </td>
              <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', color: '#475569' }}>
                {item.tasks}
              </td>
              <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', color: '#475569' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <div
                    style={{
                      width: '60px',
                      height: '8px',
                      backgroundColor: '#f1f5f9',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${item.avgProgress}%`,
                        height: '100%',
                        backgroundColor: item.avgProgress >= 80 ? '#22c55e' : item.avgProgress >= 50 ? '#3b82f6' : '#ef4444',
                      }}
                    />
                  </div>
                  <span style={{ fontWeight: 500, color: '#111827' }}>{item.avgProgress}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

