'use client'

import { useState } from 'react'
import type { TabKey } from '@/utils/constants'
import { tabTranslationPath } from '@/lib/i18n'
import { useI18n } from '@/lib/i18n'
import { HelpCircleIcon, SearchIcon, SettingsIcon } from '../common/Icons'
import { AssignmentBell } from './AssignmentBell'
import { LanguageSwitcher } from './LanguageSwitcher'

interface HeaderProps {
  onSearch?: (query: string) => void
  onSettingsClick?: () => void
  user?: { name: string; username: string; role: string; isAdmin?: boolean } | null
  onLogout?: () => void
  activeTab: TabKey
  onGuideClick?: () => void
}

export function Header({ onSearch, onSettingsClick, user, onLogout, activeTab, onGuideClick }: HeaderProps) {
  const { t } = useI18n()
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
          <h1 className="servicenow-header__app-name">{t('app.title')}</h1>
        </div>

        {/* Global Search */}
        <div className="servicenow-header__search">
          <form onSubmit={handleSearch} style={{ width: '100%', display: 'flex' }}>
            <input
              type="text"
              placeholder={t('header.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="servicenow-search-input"
            />
            <button
              type="submit"
              className="servicenow-search-button"
              aria-label={t('header.searchAria')}
            >
              <SearchIcon size={20} color="#666" />
            </button>
          </form>
        </div>

        {/* User Profile/Settings */}
        <div className="servicenow-header__actions">
          <LanguageSwitcher />
          {user && (
            <div className="servicenow-header__user-info">
              <span className="servicenow-header__user-name">{user.name}</span>
              <span className="servicenow-header__user-role">{user.role}</span>
            </div>
          )}
          {onGuideClick && (
            <button
              className="servicenow-header__icon-button"
              onClick={onGuideClick}
              aria-label={t('header.guideAria')}
              title={`${t('header.guideTitle')}: ${t(tabTranslationPath(activeTab))}`}
            >
              <HelpCircleIcon size={20} color="#666" />
            </button>
          )}
          <AssignmentBell user={user} />
          {onSettingsClick && (
            <button
              className="servicenow-header__icon-button"
              onClick={onSettingsClick}
              aria-label={t('header.settingsAria')}
              title={t('header.settings')}
            >
              <SettingsIcon size={20} color="#666" />
            </button>
          )}
          {onLogout && (
            <button
              className="servicenow-header__logout-button"
              onClick={onLogout}
              aria-label={t('header.logoutAria')}
            >
              {t('header.logout')}
            </button>
          )}
        </div>
      </div>
    </header>
  )
}


