'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TabKey } from '@/utils/constants'
import { useI18n, tabTranslationPath } from '@/lib/i18n'

interface SidebarProps {
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
  user?: { role: string; isAdmin?: boolean } | null
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

interface MenuItem {
  key: TabKey
}

interface MenuSection {
  id: string
  sectionLabelKey: string
  defaultTab: TabKey
  adminOnly?: boolean
  items: MenuItem[]
}

export function Sidebar({ activeTab, onTabChange, user, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const { t } = useI18n()
  const isAdmin = user?.role === 'admin' || !!user?.isAdmin
  const menuStructure = useMemo<MenuSection[]>(
    () => [
      {
        id: 'home',
        sectionLabelKey: 'sidebar.sections.home',
        defaultTab: 'dashboard',
        items: [{ key: 'dashboard' }, { key: 'personal' }, { key: 'search' }],
      },
      {
        id: 'project-execution',
        sectionLabelKey: 'sidebar.sections.projectExecution',
        defaultTab: 'list',
        items: [
          { key: 'list' },
          { key: 'tasks' },
          { key: 'gmp-record' },
          { key: 'val-pkg' },
          { key: 'gantt' },
          { key: 'gantt-history' },
        ],
      },
      {
        id: 'itsm-ops',
        sectionLabelKey: 'sidebar.sections.itsmOps',
        defaultTab: 'request',
        items: [
          { key: 'request' },
          { key: 'incident' },
          { key: 'problem' },
          { key: 'change' },
          { key: 'approval-inbox' },
          { key: 'notifications' },
          { key: 'issues' },
        ],
      },
      {
        id: 'collaboration',
        sectionLabelKey: 'sidebar.sections.collaboration',
        defaultTab: 'meetings',
        items: [{ key: 'meetings' }, { key: 'action-items' }, { key: 'voc' }],
      },
      {
        id: 'admin',
        sectionLabelKey: 'sidebar.sections.admin',
        defaultTab: 'priority-policy',
        adminOnly: true,
        items: [{ key: 'priority-policy' }, { key: 'sla-policy' }, { key: 'audit-log' }, { key: 'backup' }],
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
        {!isCollapsed && <h2 className="servicenow-sidebar__title">{t('sidebar.menuTitle')}</h2>}
        {onToggleCollapse && (
          <button
            className="servicenow-sidebar__toggle"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? t('sidebar.expandMenu') : t('sidebar.collapseMenu')}
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
                    title={isCollapsed ? t(section.sectionLabelKey) : undefined}
                    style={{ flex: 1, fontWeight: 600 }}
                  >
                    {!isCollapsed && <span className="servicenow-sidebar__menu-text">{t(section.sectionLabelKey)}</span>}
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
                            {t(tabTranslationPath(child.key))}
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


