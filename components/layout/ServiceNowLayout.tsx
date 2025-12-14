'use client'

import { ReactNode, useState } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import type { TabKey } from '@/utils/constants'

interface ServiceNowLayoutProps {
  children: ReactNode
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
  onSearch?: (query: string) => void
  onSettingsClick?: () => void
  onLogout?: () => void
  user?: { name: string; username: string; role: string } | null
}

export function ServiceNowLayout({
  children,
  activeTab,
  onTabChange,
  onSearch,
  onSettingsClick,
  onLogout,
  user,
}: ServiceNowLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <div className="servicenow-layout">
      <Header
        onSearch={onSearch}
        onSettingsClick={onSettingsClick}
        onLogout={onLogout}
        user={user}
      />
      <div className="servicenow-layout__body">
        <Sidebar
          activeTab={activeTab}
          onTabChange={onTabChange}
          user={user}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        <main className="servicenow-layout__content">
          {children}
        </main>
      </div>
    </div>
  )
}

