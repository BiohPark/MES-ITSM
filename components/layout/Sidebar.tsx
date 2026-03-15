'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TabKey } from '@/utils/constants'

interface SidebarProps {
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
  user?: { role: string; isAdmin?: boolean } | null
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

interface MenuItem {
  key: TabKey
  label: string
}

interface MenuSection {
  id: string
  label: string
  defaultTab: TabKey
  adminOnly?: boolean
  items: MenuItem[]
}

export function Sidebar({ activeTab, onTabChange, user, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const isAdmin = user?.role === 'admin' || !!user?.isAdmin
  const menuStructure = useMemo<MenuSection[]>(
    () => [
      {
        id: 'home',
        label: '홈',
        defaultTab: 'dashboard',
        items: [
          { key: 'dashboard', label: '대시보드' },
          { key: 'personal', label: '내 일감' },
          { key: 'search', label: '검색' },
        ],
      },
      {
        id: 'project-execution',
        label: '프로젝트 실행',
        defaultTab: 'list',
        items: [
          { key: 'list', label: '프로젝트' },
          { key: 'tasks', label: '일감' },
          { key: 'gmp-record', label: 'GMP Record' },
          { key: 'val-pkg', label: 'VAL Pkg' },
          { key: 'gantt', label: 'WBS 관리' },
          { key: 'gantt-history', label: 'WBS 변경 이력' },
        ],
      },
      {
        id: 'itsm-ops',
        label: 'ITSM 운영',
        defaultTab: 'request',
        items: [
          { key: 'request', label: 'Service Request' },
          { key: 'incident', label: 'Incident' },
          { key: 'problem', label: 'Problem' },
          { key: 'change', label: 'Change' },
          { key: 'approval-inbox', label: '승인 Inbox' },
          { key: 'notifications', label: '알림' },
          { key: 'issues', label: '이슈' },
        ],
      },
      {
        id: 'collaboration',
        label: '협업',
        defaultTab: 'meetings',
        items: [
          { key: 'meetings', label: '회의록' },
          { key: 'action-items', label: '액션 아이템' },
          { key: 'voc', label: 'VOC 관리' },
        ],
      },
      {
        id: 'admin',
        label: '관리자',
        defaultTab: 'priority-policy',
        adminOnly: true,
        items: [
          { key: 'priority-policy', label: '우선순위 정책' },
          { key: 'sla-policy', label: 'SLA 정책' },
          { key: 'audit-log', label: '감사 로그' },
          { key: 'backup', label: '백업' },
        ],
      },
    ],
    []
  )
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['home', 'project-execution', 'itsm-ops']))
  const [lastVisitedBySection, setLastVisitedBySection] = useState<Record<string, TabKey>>({})

  const getSectionForTab = useCallback(
    (tab: TabKey) => menuStructure.find((section) => section.items.some((item) => item.key === tab)),
    [menuStructure]
  )

  useEffect(() => {
    const section = getSectionForTab(activeTab)
    if (!section) return
    setExpandedSections((prev) => new Set(prev).add(section.id))
    setLastVisitedBySection((prev) => ({ ...prev, [section.id]: activeTab }))
  }, [activeTab, getSectionForTab])

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

  const handleSectionClick = (section: MenuSection) => {
    const targetTab = lastVisitedBySection[section.id] || section.defaultTab
    onTabChange(targetTab)
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
          {menuStructure.map((section) => {
            if (section.adminOnly && !isAdmin) {
              return null
            }
            const isExpanded = expandedSections.has(section.id)
            const isSectionActive = section.items.some((item) => item.key === activeTab)

            return (
              <li key={section.id} className="servicenow-sidebar__menu-item">
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <button
                    className={`servicenow-sidebar__menu-link ${isSectionActive ? 'servicenow-sidebar__menu-link--active' : ''}`}
                    onClick={() => handleSectionClick(section)}
                    title={isCollapsed ? section.label : undefined}
                    style={{ flex: 1, fontWeight: 600 }}
                  >
                    {!isCollapsed && <span className="servicenow-sidebar__menu-text">{section.label}</span>}
                  </button>
                  {!isCollapsed && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSection(section.id)
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.5rem',
                        fontSize: '0.75rem',
                        color: '#666',
                      }}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                  )}
                </div>
                {isExpanded && !isCollapsed && (
                  <ul style={{ paddingLeft: '1.5rem', marginTop: '0.25rem' }}>
                    {section.items.map((child) => {
                      const isChildActive = activeTab === child.key
                      return (
                        <li key={child.key} style={{ marginBottom: '0.25rem' }}>
                          <button
                            className={`servicenow-sidebar__menu-link ${isChildActive ? 'servicenow-sidebar__menu-link--active' : ''}`}
                            onClick={() => handleMenuClick(child.key)}
                            style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', width: '100%', textAlign: 'left' }}
                          >
                            {child.label}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}


