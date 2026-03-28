'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { BellIcon } from '../common/Icons'
import type { MyAssignmentItem, MyAssignmentsResponse } from '@/types/assignment'

function buildAssignmentSignature(item: MyAssignmentItem) {
  return [item.kind, item.id, item.status || '', item.dueDate || '', item.title, item.subtitle || ''].join('|')
}

export function AssignmentBell({
  user,
}: {
  user?: { name: string; username: string; role: string; isAdmin?: boolean } | null
}) {
  const { t } = useI18n()
  const [items, setItems] = useState<MyAssignmentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [seenSignatures, setSeenSignatures] = useState<Set<string>>(new Set())
  const panelRef = useRef<HTMLDivElement | null>(null)
  const inFlightRef = useRef<Promise<void> | null>(null)
  const lastLoadedAtRef = useRef(0)
  const storageKey = useMemo(() => {
    if (!user) return null
    return `itsm.assignment-bell.seen.${user.username || user.name}`
  }, [user])

  const signatures = useMemo(() => items.map(buildAssignmentSignature), [items])
  const unreadCount = useMemo(
    () => signatures.filter((signature) => !seenSignatures.has(signature)).length,
    [seenSignatures, signatures]
  )

  const persistSeenSignatures = useCallback((next: Set<string>) => {
    if (!storageKey) return
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(next)))
  }, [storageKey])

  const loadAssignments = useCallback(async (force = false) => {
    if (!user) {
      setItems([])
      return
    }
    const now = Date.now()
    if (!force && now - lastLoadedAtRef.current < 10_000) {
      return
    }
    if (inFlightRef.current) {
      await inFlightRef.current
      return
    }
    try {
      inFlightRef.current = (async () => {
        setLoading(true)
        const response = await fetch('/api/my-assignments', {
          cache: 'no-store',
          credentials: 'include',
        })
        if (!response.ok) {
          throw new Error(t('assignmentBell.loadFailed'))
        }
        const data = (await response.json()) as MyAssignmentsResponse
        setItems(data.items || [])
        lastLoadedAtRef.current = Date.now()
      })()
      await inFlightRef.current
    } catch {
      setItems([])
    } finally {
      inFlightRef.current = null
      setLoading(false)
    }
  }, [user, t])

  useEffect(() => {
    if (!storageKey) {
      setSeenSignatures(new Set())
      return
    }
    try {
      const raw = window.localStorage.getItem(storageKey)
      const parsed = raw ? JSON.parse(raw) : []
      setSeenSignatures(new Set(Array.isArray(parsed) ? parsed : []))
    } catch {
      setSeenSignatures(new Set())
    }
  }, [storageKey])

  useEffect(() => {
    void loadAssignments()
  }, [loadAssignments])

  useEffect(() => {
    if (!open || signatures.length === 0) return
    setSeenSignatures((prev) => {
      const next = new Set(prev)
      let changed = false
      signatures.forEach((signature) => {
        if (!next.has(signature)) {
          next.add(signature)
          changed = true
        }
      })
      if (changed) {
        persistSeenSignatures(next)
        return next
      }
      return prev
    })
  }, [open, persistSeenSignatures, signatures])

  useEffect(() => {
    if (!open) return
    const handleOutsideClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  if (!user) return null

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button
        className="servicenow-header__icon-button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={t('assignmentBell.ariaLabel')}
        title={t('assignmentBell.title')}
        style={{ position: 'relative' }}
      >
        <BellIcon size={20} color="#666" />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-0.2rem',
              right: '-0.2rem',
              minWidth: '1rem',
              height: '1rem',
              padding: '0 0.2rem',
              borderRadius: '999px',
              background: '#dc2626',
              color: '#fff',
              fontSize: '0.65rem',
              lineHeight: '1rem',
              fontWeight: 700,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.5rem)',
            right: 0,
            width: 'min(30rem, calc(100vw - 2rem))',
            maxHeight: '32rem',
            overflow: 'auto',
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.18)',
            zIndex: 50,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1rem',
              borderBottom: '1px solid #f1f5f9',
              position: 'sticky',
              top: 0,
              background: '#fff',
            }}
          >
            <div>
              <strong style={{ display: 'block', fontSize: '0.95rem' }}>{t('assignmentBell.panelTitle')}</strong>
              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                {t('assignmentBell.panelHint')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void loadAssignments(true)}
              className="servicenow-button servicenow-button--secondary servicenow-button--sm"
            >
              {t('assignmentBell.refresh')}
            </button>
          </div>
          {loading ? (
            <div style={{ padding: '1rem', color: '#64748b' }}>{t('assignmentBell.loading')}</div>
          ) : items.length === 0 ? (
            <div style={{ padding: '1rem', color: '#64748b' }}>{t('assignmentBell.empty')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {items.map((item) => (
                <a
                  key={`${item.kind}:${item.id}:${item.url}`}
                  href={item.url}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'block',
                    padding: '0.85rem 1rem',
                    borderBottom: '1px solid #f8fafc',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '3rem',
                        padding: '0.15rem 0.45rem',
                        borderRadius: 999,
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                      }}
                    >
                      {item.label}
                    </span>
                    {item.status && (
                      <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{item.status}</span>
                    )}
                    {item.dueDate && (
                      <span style={{ color: '#b45309', fontSize: '0.75rem' }}>{t('assignmentBell.duePrefix')} {item.dueDate}</span>
                    )}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.15rem' }}>{item.title}</div>
                  {item.subtitle && (
                    <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '0.25rem' }}>{item.subtitle}</div>
                  )}
                  <code style={{ color: '#2563eb', fontSize: '0.72rem' }}>{item.url}</code>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
