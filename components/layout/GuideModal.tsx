'use client'

import type { TabKey } from '@/utils/constants'
import { getGuideForTab } from '@/utils/guide-content'

interface GuideModalProps {
  activeTab: TabKey
  onClose: () => void
}

export function GuideModal({ activeTab, onClose }: GuideModalProps) {
  const guide = getGuideForTab(activeTab)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1120px', width: 'min(1120px, calc(100vw - 2rem))' }}>
        <div className="modal-header">
          <h2>{guide.title}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <section>
            <div style={{ fontSize: '0.92rem', color: '#64748b', marginBottom: '0.5rem' }}>{guide.summary}</div>
            <div style={{ padding: '0.85rem 1rem', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f8fafc' }}>
              <strong>목적</strong>
              <div style={{ marginTop: '0.35rem' }}>{guide.purpose}</div>
            </div>
          </section>
          {guide.sections.map((section) => (
            <section key={section.title} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
              <h3 style={{ margin: 0, marginBottom: '0.75rem', fontSize: '1rem' }}>{section.title}</h3>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'grid', gap: '0.45rem' }}>
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
