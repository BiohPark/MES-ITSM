'use client'

import { useState } from 'react'
import type { TabKey } from '@/utils/constants'
import { TABS } from '@/utils/constants'

interface SidebarProps {
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
  user?: { role: string } | null
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

interface MenuItem {
  key: TabKey
  label: string
  icon?: React.ReactNode
  children?: MenuItem[]
}

export function Sidebar({ activeTab, onTabChange, user, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['main']))

  // 메뉴 구조 정의 (ServiceNow 스타일 계층 구조)
  const menuStructure: MenuItem[] = [
    {
      key: 'dashboard',
      label: '대시보드',
    },
    {
      key: 'list',
      label: '프로젝트',
    },
    {
      key: 'tasks',
      label: '일감',
    },
    {
      key: 'gmp-record',
      label: 'GMP Record',
    },
    {
      key: 'val-pkg',
      label: 'VAL Package',
    },
    {
      key: 'issues',
      label: '이슈',
    },
    {
      key: 'voc',
      label: 'VOC 관리',
    },
    ...(user?.role === 'admin' ? [{ key: 'backup' as TabKey, label: '백업' }] : []),
    {
      key: 'personal',
      label: '내 일감',
    },
    {
      key: 'gantt',
      label: '간트 차트',
    },
    {
      key: 'search',
      label: '검색',
    },
  ]

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  const handleMenuClick = (key: TabKey) => {
    onTabChange(key)
  }

  return (
    <aside className={`servicenow-sidebar ${isCollapsed ? 'servicenow-sidebar--collapsed' : ''}`}>
      <div className="servicenow-sidebar__header">
        {!isCollapsed && <h2 className="servicenow-sidebar__title">메뉴</h2>}
        {onToggleCollapse && (
          <button
            className="servicenow-sidebar__toggle"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? '메뉴 확장' : '메뉴 접기'}
          >
            {isCollapsed ? '→' : '←'}
          </button>
        )}
      </div>

      <nav className="servicenow-sidebar__nav">
        <ul className="servicenow-sidebar__menu">
          {menuStructure.map((item) => {
            // Admin만 백업 탭 보기
            if (item.key === 'backup' && (!user || user.role !== 'admin')) {
              return null
            }

            const isActive = activeTab === item.key

            return (
              <li key={item.key} className="servicenow-sidebar__menu-item">
                <button
                  className={`servicenow-sidebar__menu-link ${isActive ? 'servicenow-sidebar__menu-link--active' : ''}`}
                  onClick={() => handleMenuClick(item.key)}
                  title={isCollapsed ? item.label : undefined}
                >
                  {item.icon && <span className="servicenow-sidebar__menu-icon">{item.icon}</span>}
                  {!isCollapsed && <span className="servicenow-sidebar__menu-text">{item.label}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}


