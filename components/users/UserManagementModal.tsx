'use client'

import { useState, useEffect } from 'react'

interface UserManagementModalProps {
  onClose: () => void
  currentUser?: { id: string; username: string; name: string; role: 'admin' | 'user'; email?: string } | null
}

export function UserManagementModal({ onClose, currentUser }: UserManagementModalProps) {
  const [users, setUsers] = useState<Array<{ id: string; name: string; username?: string; email?: string; role?: string }>>([])
  const [loading, setLoading] = useState(true)
  const [newUserUsername, setNewUserUsername] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user')
  const [editingUser, setEditingUser] = useState<{ id: string; username: string; name: string; email: string; role: string } | null>(null)
  const [editUsername, setEditUsername] = useState('')
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user')
  
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

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          user: {
            username: newUserUsername,
            name: newUserName,
            email: newUserEmail,
            password: newUserPassword,
            role: newUserRole,
          },
        }),
      })

      if (response.ok) {
        setNewUserUsername('')
        setNewUserName('')
        setNewUserEmail('')
        setNewUserPassword('')
        setNewUserRole('user')
        await fetchUsers()
      } else {
        const data = await response.json()
        alert(data.error || '사용자 추가에 실패했습니다.')
      }
    } catch (error) {
      console.error('Error adding user:', error)
      alert('사용자 추가에 실패했습니다.')
    }
  }

  const handleRowClick = (user: { id: string; name: string; username?: string; email?: string; role?: string }) => {
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
    })
    setEditUsername(user.username || '')
    setEditName(user.name)
    setEditEmail(user.email || '')
    setEditPassword('')
    setEditRole((user.role as 'admin' | 'user') || 'user')
  }

  const handleCancelEdit = () => {
    setEditingUser(null)
    setEditUsername('')
    setEditName('')
    setEditEmail('')
    setEditPassword('')
    setEditRole('user')
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>사용자 관리</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="project-form">
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
              onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'user')}
              className="form-input"
              required
            >
              <option value="user">사용자</option>
              <option value="admin">관리자</option>
            </select>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={handleAddUser}
              className="btn btn-primary"
            >
              사용자 추가
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
                  onChange={(e) => setEditRole(e.target.value as 'admin' | 'user')}
                  className="form-input"
                  required
                >
                  <option value="user">사용자</option>
                  <option value="admin">관리자</option>
                </select>
              </div>

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
      </div>
    </div>
  )
}

