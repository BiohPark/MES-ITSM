'use client'

import { useState, useEffect } from 'react'

interface UserManagementModalProps {
  onClose: () => void
  currentUser?: { id: string; username: string; name: string; role: string; email?: string } | null
  /** 설정 모달 내 패널로 삽입 시 true (오버레이 없음, 뒤로가기 버튼 표시) */
  embedInPanel?: boolean
  /** embedInPanel일 때 '설정 목록'으로 돌아가기 콜백 */
  onBack?: () => void
}

export function UserManagementModal({ onClose, currentUser, embedInPanel, onBack }: UserManagementModalProps) {
  const [users, setUsers] = useState<Array<{ id: string; name: string; username?: string; email?: string; role?: string; can_edit_wbs?: boolean }>>([])
  const [loading, setLoading] = useState(true)
  const [newUserUsername, setNewUserUsername] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState<string>('user')
  const [editingUser, setEditingUser] = useState<{ id: string; username: string; name: string; email: string; role: string; can_edit_wbs?: boolean } | null>(null)
  const [editUsername, setEditUsername] = useState('')
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editRole, setEditRole] = useState<string>('user')
  const [editCanEditWbs, setEditCanEditWbs] = useState(false)
  const [addingUser, setAddingUser] = useState(false)
  
  const isAdmin = currentUser?.role === 'admin'

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
      alert('ID를 입력해주세요.')
      return
    }
    if (!newUserName.trim()) {
      alert('이름을 입력해주세요.')
      return
    }
    if (!newUserEmail.trim()) {
      alert('이메일을 입력해주세요.')
      return
    }
    if (!newUserPassword.trim()) {
      alert('비밀번호를 입력해주세요.')
      return
    }
    if (newUserPassword.length < 8) {
      alert('비밀번호는 최소 8자 이상이어야 합니다.')
      return
    }
    
    // 비밀번호 강도 검증 (영문자와 숫자 포함)
    if (!/[A-Za-z]/.test(newUserPassword)) {
      alert('비밀번호는 영문자를 포함해야 합니다.')
      return
    }
    if (!/[0-9]/.test(newUserPassword)) {
      alert('비밀번호는 숫자를 포함해야 합니다.')
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
          },
        }),
      })

      const data = await response.json()
      
      if (response.ok) {
        alert('사용자가 성공적으로 추가되었습니다.')
        setNewUserUsername('')
        setNewUserName('')
        setNewUserEmail('')
        setNewUserPassword('')
        setNewUserRole('user')
        await fetchUsers()
      } else {
        alert(data.error || '사용자 추가에 실패했습니다.')
      }
    } catch (error) {
      console.error('Error adding user:', error)
      alert('사용자 추가에 실패했습니다. 네트워크 오류가 발생했을 수 있습니다.')
    } finally {
      setAddingUser(false)
    }
  }

  const handleRowClick = (user: { id: string; name: string; username?: string; email?: string; role?: string; can_edit_wbs?: boolean }) => {
    if (!isAdmin) {
      alert('관리자만 사용자 정보를 수정할 수 있습니다.')
      return
    }
    
    setEditingUser({
      id: user.id,
      username: user.username || '',
      name: user.name,
      email: user.email || '',
      role: user.role || 'user',
      can_edit_wbs: user.can_edit_wbs,
    })
    setEditUsername(user.username || '')
    setEditName(user.name)
    setEditEmail(user.email || '')
    setEditPassword('')
    setEditRole(user.role || 'user')
    setEditCanEditWbs(!!user.can_edit_wbs)
  }

  const handleCancelEdit = () => {
    setEditingUser(null)
    setEditUsername('')
    setEditName('')
    setEditEmail('')
    setEditPassword('')
    setEditRole('user')
    setEditCanEditWbs(false)
  }

  const handleUpdateUser = async () => {
    if (!editingUser) return

    if (!editUsername.trim()) {
      alert('ID를 입력해주세요.')
      return
    }
    if (!editName.trim()) {
      alert('이름을 입력해주세요.')
      return
    }
    if (!editEmail.trim()) {
      alert('이메일을 입력해주세요.')
      return
    }
    if (editPassword && editPassword.length < 8) {
      alert('비밀번호는 최소 8자 이상이어야 합니다.')
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
            can_edit_wbs: isAdmin ? editCanEditWbs : undefined,
          },
        }),
      })

      if (response.ok) {
        handleCancelEdit()
        await fetchUsers()
      } else {
        const data = await response.json()
        alert(data.error || '사용자 수정에 실패했습니다.')
      }
    } catch (error) {
      console.error('Error updating user:', error)
      alert('사용자 수정에 실패했습니다.')
    }
  }

  const handleDeleteUser = async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation() // row 클릭 이벤트 방지
    
    if (!isAdmin) {
      alert('관리자만 사용자를 삭제할 수 있습니다.')
      return
    }

    if (!confirm('정말 이 사용자를 삭제하시겠습니까?')) {
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
        alert(data.error || '사용자 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('사용자 삭제에 실패했습니다.')
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
          ← 설정 목록
        </button>
      ) : null}
      <h2>사용자 관리</h2>
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
            <label htmlFor="new-user-username">ID *</label>
            <input
              type="text"
              id="new-user-username"
              value={newUserUsername}
              onChange={(e) => setNewUserUsername(e.target.value)}
              className="form-input"
              placeholder="ID를 입력하세요"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="new-user-name">이름 *</label>
            <input
              type="text"
              id="new-user-name"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              className="form-input"
              placeholder="이름을 입력하세요"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="new-user-email">이메일 *</label>
            <input
              type="email"
              id="new-user-email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="form-input"
              placeholder="이메일을 입력하세요"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="new-user-password">비밀번호 * (최소 8자, 영문자와 숫자 포함)</label>
            <input
              type="password"
              id="new-user-password"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              className="form-input"
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="new-user-role">권한 *</label>
            <select
              id="new-user-role"
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value)}
              className="form-input"
              required
            >
              <option value="user">일반 사용자</option>
              <option value="admin">관리자</option>
              <option value="Deviation 매니저">Deviation 매니저</option>
              <option value="개발 매니저">개발 매니저</option>
              <option value="PIM 매니저">PIM 매니저</option>
              <option value="총괄 매니저">총괄 매니저</option>
            </select>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={handleAddUser}
              className="btn btn-primary"
              disabled={addingUser}
              style={{ opacity: addingUser ? 0.6 : 1, cursor: addingUser ? 'not-allowed' : 'pointer' }}
            >
              {addingUser ? '추가 중...' : '사용자 추가'}
            </button>
          </div>

          {editingUser && isAdmin && (
            <div style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem', background: '#f8fafc', padding: '1.5rem', borderRadius: '0.5rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>사용자 수정</h3>
              
              <div className="form-group">
                <label htmlFor="edit-user-username">ID *</label>
                <input
                  type="text"
                  id="edit-user-username"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="form-input"
                  placeholder="ID를 입력하세요"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-user-name">이름 *</label>
                <input
                  type="text"
                  id="edit-user-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="form-input"
                  placeholder="이름을 입력하세요"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-user-email">이메일 *</label>
                <input
                  type="email"
                  id="edit-user-email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="form-input"
                  placeholder="이메일을 입력하세요"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-user-password">비밀번호 (변경 시에만 입력, 최소 8자)</label>
                <input
                  type="password"
                  id="edit-user-password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="form-input"
                  placeholder="비밀번호를 변경하려면 입력하세요"
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-user-role">권한 *</label>
                <select
                  id="edit-user-role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="form-input"
                  required
                >
                  <option value="user">일반 사용자</option>
                  <option value="admin">관리자</option>
                  <option value="Deviation 매니저">Deviation 매니저</option>
                  <option value="개발 매니저">개발 매니저</option>
                  <option value="PIM 매니저">PIM 매니저</option>
                  <option value="총괄 매니저">총괄 매니저</option>
                </select>
              </div>

              {isAdmin && (
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="edit-user-can-edit-wbs"
                    checked={editCanEditWbs}
                    onChange={(e) => setEditCanEditWbs(e.target.checked)}
                  />
                  <label htmlFor="edit-user-can-edit-wbs" style={{ marginBottom: 0 }}>WBS 수정 권한 부여 (간트 차트 WBS 편집 가능)</label>
                </div>
              )}

              <div className="form-actions">
                <button
                  type="button"
                  onClick={handleUpdateUser}
                  className="btn btn-primary"
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="btn"
                  style={{ marginLeft: '0.5rem' }}
                >
                  취소
                </button>
              </div>
            </div>
          )}

          <div style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>사용자 목록</h3>
            {loading ? (
              <p>로딩 중...</p>
            ) : users.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>등록된 사용자가 없습니다.</p>
            ) : (
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>계정 ID</th>
                    <th>로그인 ID</th>
                    <th>이름</th>
                    <th>이메일</th>
                    <th>권한</th>
                    {isAdmin && <th>WBS 수정</th>}
                    <th>작업</th>
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
                      <td>{user.role || 'user'}</td>
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
                          삭제
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

