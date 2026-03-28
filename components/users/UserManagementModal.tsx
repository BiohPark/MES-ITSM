'use client'

import { useState, useEffect } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'

/** DB에 저장된 role 값 → comp.userMgmt.* 표시 키 */
const USER_ROLE_TO_I18N: Record<string, string> = {
  user: 'comp.userMgmt.roleUser',
  Viewonly: 'comp.userMgmt.roleViewonly',
  '그룹 매니저': 'comp.userMgmt.roleGroup',
  '파트 매니저': 'comp.userMgmt.rolePart',
  admin: 'comp.userMgmt.roleAdmin',
}

interface UserManagementModalProps {
  onClose: () => void
  currentUser?: { id: string; username: string; name: string; role: string; email?: string; isAdmin?: boolean } | null
  /** 설정 모달 내 패널로 삽입 시 true (오버레이 없음, 뒤로가기 버튼 표시) */
  embedInPanel?: boolean
  /** embedInPanel일 때 '설정 목록'으로 돌아가기 콜백 */
  onBack?: () => void
}

export function UserManagementModal({ onClose, currentUser, embedInPanel, onBack }: UserManagementModalProps) {
  const { t } = useI18n()

  const formatRoleForDisplay = (role: string | undefined) => {
    const r = role || 'user'
    const key = USER_ROLE_TO_I18N[r]
    return key ? t(key) : r
  }

  const [users, setUsers] = useState<Array<{ id: string; name: string; username?: string; email?: string; role?: string; is_admin?: boolean; can_edit_wbs?: boolean }>>([])
  const [loading, setLoading] = useState(true)
  const [newUserUsername, setNewUserUsername] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState<string>('user')
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false)
  const [editingUser, setEditingUser] = useState<{ id: string; username: string; name: string; email: string; role: string; is_admin?: boolean; can_edit_wbs?: boolean } | null>(null)
  const [editUsername, setEditUsername] = useState('')
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editRole, setEditRole] = useState<string>('user')
  const [editIsAdmin, setEditIsAdmin] = useState(false)
  const [editCanEditWbs, setEditCanEditWbs] = useState(false)
  const [addingUser, setAddingUser] = useState(false)
  
  const isAdmin = currentUser?.role === 'admin' || !!currentUser?.isAdmin

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async () => {
    if (!newUserUsername.trim()) {
      alert(t('comp.userMgmt.idRequired'))
      return
    }
    if (!newUserName.trim()) {
      alert(t('comp.userMgmt.nameRequired'))
      return
    }
    if (!newUserEmail.trim()) {
      alert(t('comp.userMgmt.emailRequired'))
      return
    }
    if (!newUserPassword.trim()) {
      alert(t('comp.userMgmt.passwordRequired'))
      return
    }
    if (newUserPassword.length < 8) {
      alert(t('comp.userMgmt.passwordLen'))
      return
    }
    
    // 비밀번호 강도 검증 (영문자와 숫자 포함)
    if (!/[A-Za-z]/.test(newUserPassword)) {
      alert(t('comp.userMgmt.passwordLetter'))
      return
    }
    if (!/[0-9]/.test(newUserPassword)) {
      alert(t('comp.userMgmt.passwordDigit'))
      return
    }

    setAddingUser(true)
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          user: {
            username: newUserUsername.trim(),
            name: newUserName.trim(),
            email: newUserEmail.trim(),
            password: newUserPassword,
            role: newUserRole,
            is_admin: newUserRole === 'Viewonly' ? false : newUserIsAdmin,
          },
        }),
      })

      const data = await response.json()
      
      if (response.ok) {
        alert(t('comp.userMgmt.addOk'))
        setNewUserUsername('')
        setNewUserName('')
        setNewUserEmail('')
        setNewUserPassword('')
        setNewUserRole('user')
        setNewUserIsAdmin(false)
        await fetchUsers()
      } else {
        alert(data.error || t('comp.userMgmt.addFail'))
      }
    } catch (error) {
      console.error('Error adding user:', error)
      alert(t('comp.userMgmt.addFailNetwork'))
    } finally {
      setAddingUser(false)
    }
  }

  const handleRowClick = (user: { id: string; name: string; username?: string; email?: string; role?: string; is_admin?: boolean; can_edit_wbs?: boolean }) => {
    if (!isAdmin) {
      alert(t('comp.userMgmt.adminEditOnly'))
      return
    }
    
    setEditingUser({
      id: user.id,
      username: user.username || '',
      name: user.name,
      email: user.email || '',
      role: user.role || 'user',
      is_admin: user.is_admin,
      can_edit_wbs: user.can_edit_wbs,
    })
    setEditUsername(user.username || '')
    setEditName(user.name)
    setEditEmail(user.email || '')
    setEditPassword('')
    setEditRole(user.role || 'user')
    setEditIsAdmin(!!user.is_admin || user.role === 'admin')
    setEditCanEditWbs(!!user.can_edit_wbs)
  }

  const handleCancelEdit = () => {
    setEditingUser(null)
    setEditUsername('')
    setEditName('')
    setEditEmail('')
    setEditPassword('')
    setEditRole('user')
    setEditIsAdmin(false)
    setEditCanEditWbs(false)
  }

  const handleUpdateUser = async () => {
    if (!editingUser) return

    if (!editUsername.trim()) {
      alert(t('comp.userMgmt.idRequired'))
      return
    }
    if (!editName.trim()) {
      alert(t('comp.userMgmt.nameRequired'))
      return
    }
    if (!editEmail.trim()) {
      alert(t('comp.userMgmt.emailRequired'))
      return
    }
    if (editPassword && editPassword.length < 8) {
      alert(t('comp.userMgmt.passwordLen'))
      return
    }

    try {
      const response = await fetch('/api/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update',
          userId: editingUser.id,
          user: {
            username: editUsername,
            name: editName,
            email: editEmail,
            password: editPassword || undefined, // 비밀번호가 입력된 경우에만 전송
            role: editRole,
            is_admin: editRole === 'Viewonly' ? false : editIsAdmin,
            can_edit_wbs: isAdmin ? editCanEditWbs : undefined,
          },
        }),
      })

      if (response.ok) {
        handleCancelEdit()
        await fetchUsers()
      } else {
        const data = await response.json()
        alert(data.error || t('comp.userMgmt.editFail'))
      }
    } catch (error) {
      console.error('Error updating user:', error)
      alert(t('comp.userMgmt.editFail'))
    }
  }

  const handleDeleteUser = async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation() // row 클릭 이벤트 방지
    
    if (!isAdmin) {
      alert(t('comp.userMgmt.adminDeleteOnly'))
      return
    }

    if (!confirm(t('comp.userMgmt.deleteConfirm'))) {
      return
    }

    try {
      const response = await fetch('/api/users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: userId,
        }),
      })

      if (response.ok) {
        await fetchUsers()
      } else {
        const data = await response.json()
        alert(data.error || t('comp.userMgmt.deleteFail'))
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      alert(t('comp.userMgmt.deleteFail'))
    }
  }

  const header = (
    <div className="modal-header" style={{ flexShrink: 0 }}>
      {embedInPanel && onBack ? (
        <button
          type="button"
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontSize: '0.875rem', padding: '0.25rem 0' }}
        >
          {t('comp.userMgmt.back')}
        </button>
      ) : null}
      <h2>{t('comp.userMgmt.title')}</h2>
      {!embedInPanel && (
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
      )}
    </div>
  )

  const content = (
    <div className="project-form" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <div className="form-group">
            <label htmlFor="new-user-username">{t('comp.userMgmt.idLabel')}</label>
            <input
              type="text"
              id="new-user-username"
              value={newUserUsername}
              onChange={(e) => setNewUserUsername(e.target.value)}
              className="form-input"
              placeholder={t('comp.userMgmt.idPh')}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="new-user-name">{t('comp.userMgmt.nameLabel')}</label>
            <input
              type="text"
              id="new-user-name"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              className="form-input"
              placeholder={t('comp.userMgmt.namePh')}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="new-user-email">{t('comp.userMgmt.emailLabel')}</label>
            <input
              type="email"
              id="new-user-email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="form-input"
              placeholder={t('comp.userMgmt.emailPh')}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="new-user-password">{t('comp.userMgmt.passwordLabel')}</label>
            <input
              type="password"
              id="new-user-password"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              className="form-input"
              placeholder={t('comp.userMgmt.passwordPh')}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="new-user-role">{t('comp.userMgmt.roleLabel')}</label>
            <select
              id="new-user-role"
              value={newUserRole}
              onChange={(e) => {
                const v = e.target.value
                setNewUserRole(v)
                if (v === 'Viewonly') setNewUserIsAdmin(false)
              }}
              className="form-input"
              required
            >
              <option value="user">{t('comp.userMgmt.roleUser')}</option>
              <option value="Viewonly">{t('comp.userMgmt.roleViewonly')}</option>
              <option value="그룹 매니저">{t('comp.userMgmt.roleGroup')}</option>
              <option value="파트 매니저">{t('comp.userMgmt.rolePart')}</option>
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="new-user-is-admin"
              checked={newUserRole !== 'Viewonly' && newUserIsAdmin}
              disabled={newUserRole === 'Viewonly'}
              onChange={(e) => setNewUserIsAdmin(e.target.checked)}
            />
            <label htmlFor="new-user-is-admin" style={{ marginBottom: 0 }}>
              {t('comp.userMgmt.adminGrant')}
            </label>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={handleAddUser}
              className="btn btn-primary"
              disabled={addingUser}
              style={{ opacity: addingUser ? 0.6 : 1, cursor: addingUser ? 'not-allowed' : 'pointer' }}
            >
              {addingUser ? t('comp.userMgmt.adding') : t('comp.userMgmt.addUser')}
            </button>
          </div>

          {editingUser && isAdmin && (
            <div style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem', background: '#f8fafc', padding: '1.5rem', borderRadius: '0.5rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>{t('comp.userMgmt.editUser')}</h3>
              
              <div className="form-group">
                <label htmlFor="edit-user-username">{t('comp.userMgmt.idLabel')}</label>
                <input
                  type="text"
                  id="edit-user-username"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="form-input"
                  placeholder={t('comp.userMgmt.idPh')}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-user-name">{t('comp.userMgmt.nameLabel')}</label>
                <input
                  type="text"
                  id="edit-user-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="form-input"
                  placeholder={t('comp.userMgmt.namePh')}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-user-email">{t('comp.userMgmt.emailLabel')}</label>
                <input
                  type="email"
                  id="edit-user-email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="form-input"
                  placeholder={t('comp.userMgmt.emailPh')}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-user-password">{t('comp.userMgmt.editPasswordHint')}</label>
                <input
                  type="password"
                  id="edit-user-password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="form-input"
                  placeholder={t('comp.userMgmt.passwordChangePh')}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-user-role">{t('comp.userMgmt.roleLabel')}</label>
                <select
                  id="edit-user-role"
                  value={editRole}
                  onChange={(e) => {
                    const v = e.target.value
                    setEditRole(v)
                    if (v === 'Viewonly') setEditIsAdmin(false)
                  }}
                  className="form-input"
                  required
                >
                  <option value="user">{t('comp.userMgmt.roleUser')}</option>
                  <option value="Viewonly">{t('comp.userMgmt.roleViewonly')}</option>
                  <option value="그룹 매니저">{t('comp.userMgmt.roleGroup')}</option>
                  <option value="파트 매니저">{t('comp.userMgmt.rolePart')}</option>
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="edit-user-is-admin"
                  checked={editRole !== 'Viewonly' && editIsAdmin}
                  disabled={editRole === 'Viewonly'}
                  onChange={(e) => setEditIsAdmin(e.target.checked)}
                />
                <label htmlFor="edit-user-is-admin" style={{ marginBottom: 0 }}>
                  {t('comp.userMgmt.adminGrant')}
                </label>
              </div>

              {isAdmin && (
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="edit-user-can-edit-wbs"
                    checked={editCanEditWbs}
                    onChange={(e) => setEditCanEditWbs(e.target.checked)}
                  />
                  <label htmlFor="edit-user-can-edit-wbs" style={{ marginBottom: 0 }}>{t('comp.userMgmt.wbsGrant')}</label>
                </div>
              )}

              <div className="form-actions">
                <button
                  type="button"
                  onClick={handleUpdateUser}
                  className="btn btn-primary"
                >
                  {t('comp.userMgmt.save')}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="btn"
                  style={{ marginLeft: '0.5rem' }}
                >
                  {t('comp.userMgmt.cancel')}
                </button>
              </div>
            </div>
          )}

          <div style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>{t('comp.userMgmt.listTitle')}</h3>
            {loading ? (
              <p>{t('comp.userMgmt.loading')}</p>
            ) : users.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>{t('comp.userMgmt.empty')}</p>
            ) : (
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>{t('comp.userMgmt.colAccountId')}</th>
                    <th>{t('comp.userMgmt.colLoginId')}</th>
                    <th>{t('comp.userMgmt.colName')}</th>
                    <th>{t('comp.userMgmt.colEmail')}</th>
                    <th>{t('comp.userMgmt.colRole')}</th>
                    {isAdmin && <th>{t('comp.userMgmt.colWbs')}</th>}
                    <th>{t('comp.userMgmt.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr 
                      key={user.id}
                      onClick={() => handleRowClick(user)}
                      style={{
                        cursor: isAdmin ? 'pointer' : 'default',
                        backgroundColor: editingUser?.id === user.id ? '#e0e7ff' : 'transparent',
                        transition: 'background-color 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (isAdmin) {
                          e.currentTarget.style.backgroundColor = editingUser?.id === user.id ? '#e0e7ff' : '#f1f5f9'
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = editingUser?.id === user.id ? '#e0e7ff' : 'transparent'
                      }}
                    >
                      <td>{user.id}</td>
                      <td>{user.username || '-'}</td>
                      <td>{user.name}</td>
                      <td>{user.email || '-'}</td>
                      <td>{formatRoleForDisplay(user.role)}</td>
                      {isAdmin && <td>{user.can_edit_wbs ? '✓' : '-'}</td>}
                      <td>
                        <button
                          onClick={(e) => handleDeleteUser(user.id, e)}
                          style={{
                            background: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                          }}
                        >
                          {t('comp.userMgmt.delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
    );
  return embedInPanel ? (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}>
      {header}
      {content}
    </div>
  ) : (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {header}
        {content}
      </div>
    </div>
  )
}

