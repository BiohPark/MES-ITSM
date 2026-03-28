'use client'

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'

type Dept = { id: number; name: string; sort_order: number }

export function DepartmentSettingsPanel({
  onBack,
}: {
  onBack?: () => void
}) {
  const { t } = useI18n()
  const [list, setList] = useState<Dept[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/departments')
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setList(data.departments || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleAdd = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      alert(t('comp.departments.nameRequired'))
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || t('comp.departments.addFail'))
        return
      }
      setList(data.departments || [])
      setName('')
    } catch {
      alert(t('comp.departments.addFail'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('comp.departments.deleteConfirm'))) return
    try {
      const res = await fetch(`/api/departments?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || t('comp.departments.deleteFail'))
        return
      }
      setList(data.departments || [])
    } catch {
      alert(t('comp.departments.deleteFail'))
    }
  }

  return (
    <div style={{ padding: '0.25rem 0' }}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#3b82f6',
            fontSize: '0.875rem',
            marginBottom: '1rem',
            padding: 0,
          }}
        >
          {t('comp.userMgmt.back')}
        </button>
      )}
      <h3 style={{ marginBottom: '0.75rem', fontSize: '1.1rem', fontWeight: 600 }}>
        {t('comp.departments.title')}
      </h3>
      <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
        {t('comp.departments.hint')}
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="form-input"
          placeholder={t('comp.departments.namePh')}
          style={{ flex: '1 1 200px', minWidth: 0 }}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void handleAdd())}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving}
          onClick={() => void handleAdd()}
        >
          {t('comp.departments.add')}
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>{t('common.loading')}</p>
      ) : list.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>{t('comp.departments.empty')}</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem 0' }}>{t('comp.departments.colName')}</th>
              <th style={{ padding: '0.5rem 0', width: '100px' }}>{t('comp.departments.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.5rem 0' }}>{d.name}</td>
                <td style={{ padding: '0.5rem 0' }}>
                  <button
                    type="button"
                    className="btn"
                    style={{
                      background: '#fee2e2',
                      color: '#b91c1c',
                      border: 'none',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '0.35rem',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                    onClick={() => void handleDelete(d.id)}
                  >
                    {t('comp.departments.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
