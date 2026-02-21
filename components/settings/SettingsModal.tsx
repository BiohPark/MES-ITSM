'use client'

import { useState } from 'react'
import { UserManagementModal } from '@/components/users/UserManagementModal'
import { SystemSettingsPanel } from './SystemSettingsPanel'

type SettingsView = 'list' | 'users' | 'system'

interface SettingsModalProps {
  onClose: () => void
  currentUser: { id: string; username: string; name: string; role: string; email?: string } | null
}

export function SettingsModal({ onClose, currentUser }: SettingsModalProps) {
  const [view, setView] = useState<SettingsView>('list')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '900px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <h2>설정</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '1rem' }}>
          {view === 'list' && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={{ marginBottom: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem' }}
                  onClick={() => setView('users')}
                >
                  사용자 관리
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem' }}
                  onClick={() => setView('system')}
                >
                  시스템 설정
                </button>
              </li>
            </ul>
          )}

          {view === 'users' && (
            <UserManagementModal
              onClose={onClose}
              currentUser={currentUser}
              embedInPanel
              onBack={() => setView('list')}
            />
          )}

          {view === 'system' && (
            <SystemSettingsPanel onBack={() => setView('list')} />
          )}
        </div>
      </div>
    </div>
  )
}
