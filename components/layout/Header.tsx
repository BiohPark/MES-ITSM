'use client'

import { useState } from 'react'
import { SearchIcon, SettingsIcon } from '../common/Icons'

interface HeaderProps {
  onSearch?: (query: string) => void
  onSettingsClick?: () => void
  user?: { name: string; username: string; role: string; isAdmin?: boolean } | null
  onLogout?: () => void
}

export function Header({ onSearch, onSettingsClick, user, onLogout }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (onSearch && searchQuery.trim()) {
      onSearch(searchQuery.trim())
    }
  }

  return (
    <header className="servicenow-header">
      <div className="servicenow-header__content">
        {/* Logo/App Name */}
        <div className="servicenow-header__logo">
          <h1 className="servicenow-header__app-name">MES ITSM</h1>
        </div>

        {/* Global Search */}
        <div className="servicenow-header__search">
          <form onSubmit={handleSearch} style={{ width: '100%', display: 'flex' }}>
            <input
              type="text"
              placeholder="검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="servicenow-search-input"
            />
            <button
              type="submit"
              className="servicenow-search-button"
              aria-label="검색"
            >
              <SearchIcon size={20} color="#666" />
            </button>
          </form>
        </div>

        {/* User Profile/Settings */}
        <div className="servicenow-header__actions">
          {user && (
            <div className="servicenow-header__user-info">
              <span className="servicenow-header__user-name">{user.name}</span>
              <span className="servicenow-header__user-role">{user.role}</span>
            </div>
          )}
          {onSettingsClick && (
            <button
              className="servicenow-header__icon-button"
              onClick={onSettingsClick}
              aria-label="설정"
              title="설정"
            >
              <SettingsIcon size={20} color="#666" />
            </button>
          )}
          {onLogout && (
            <button
              className="servicenow-header__logout-button"
              onClick={onLogout}
              aria-label="로그아웃"
            >
              로그아웃
            </button>
          )}
        </div>
      </div>
    </header>
  )
}


