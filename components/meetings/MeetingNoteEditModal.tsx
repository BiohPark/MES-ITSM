'use client'

import { useState, useEffect } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { MeetingNote, ActionItem } from '@/types/meeting'
import { RichTextEditor } from './RichTextEditor'
import { useI18n } from '@/lib/i18n'

export type MeetingNoteSaveOptions = { autoSave?: boolean }

interface MeetingNoteEditModalProps {
  meetingNote: MeetingNote
  mode: 'create' | 'edit'
  onClose: () => void
  onSave: (meetingNote: MeetingNote, options?: MeetingNoteSaveOptions) => Promise<void> | void
}

export function MeetingNoteEditModal({
  meetingNote,
  mode,
  onClose,
  onSave,
}: MeetingNoteEditModalProps) {
  const { t } = useI18n()
  const [formData, setFormData] = useState<MeetingNote>({
    ...meetingNote,
    attendees: meetingNote.attendees || [],
    agenda: meetingNote.agenda || [],
    action_items: meetingNote.action_items || [],
    discussion: meetingNote.discussion || '',
    decisions: meetingNote.decisions || '',
    status: meetingNote.status ?? 'draft',
  })
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])
  const [newAttendee, setNewAttendee] = useState('')
  const [newAgendaItem, setNewAgendaItem] = useState('')
  const [newActionItem, setNewActionItem] = useState<Partial<ActionItem>>({
    description: '',
    assignee: '',
    due_date: '',
    status: 'pending',
  })

  useEffect(() => {
    const abortController = new AbortController()
    let isMounted = true

    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users', {
          signal: abortController.signal,
        })
        if (abortController.signal.aborted || !isMounted) return
        if (response.ok) {
          const data = await response.json()
          if (abortController.signal.aborted || !isMounted) return
          setUsers(data.users || [])
        }
      } catch (error) {
        if (abortController.signal.aborted) return
        console.error('Error fetching users:', error)
      }
    }

    fetchUsers()

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({
        ...formData,
        status: 'final',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAndClose = async () => {
    if (!formData.title?.trim()) {
      alert(t('comp.meetingEditModal.alertTitle'))
      return
    }
    if (!formData.meeting_date) {
      alert(t('comp.meetingEditModal.alertDate'))
      return
    }
    setSaving(true)
    try {
      await onSave({
        ...formData,
        status: 'final',
      })
      // 실제 모달 닫힘은 부모 onSave에서 처리 (성공 시에만 닫힘)
    } finally {
      setSaving(false)
    }
  }

  /** × 버튼: 새 회의이고 제목을 입력하지 않았으면 저장 검증 없이 닫기(취소) */
  const handleHeaderClose = () => {
    if (saving) return
    if (mode === 'create' && !formData.title?.trim()) {
      onClose()
      return
    }
    void handleSaveAndClose()
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const addAttendee = () => {
    if (newAttendee.trim()) {
      setFormData((prev) => ({
        ...prev,
        attendees: [...prev.attendees, newAttendee.trim()],
      }))
      setNewAttendee('')
    }
  }

  const removeAttendee = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attendees: prev.attendees.filter((_, i) => i !== index),
    }))
  }

  const addAgendaItem = () => {
    if (newAgendaItem.trim()) {
      setFormData((prev) => ({
        ...prev,
        agenda: [...prev.agenda, newAgendaItem.trim()],
      }))
      setNewAgendaItem('')
    }
  }

  const removeAgendaItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      agenda: prev.agenda.filter((_, i) => i !== index),
    }))
  }

  const addActionItem = () => {
    if (newActionItem.description?.trim() && newActionItem.assignee) {
      const actionItem: ActionItem = {
        id: `action-${Date.now()}`,
        description: newActionItem.description.trim(),
        assignee: newActionItem.assignee,
        due_date: newActionItem.due_date || null,
        status: newActionItem.status || 'pending',
      }
      setFormData((prev) => ({
        ...prev,
        action_items: [...prev.action_items, actionItem],
      }))
      setNewActionItem({
        description: '',
        assignee: '',
        due_date: '',
        status: 'pending',
      })
    }
  }

  const removeActionItem = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      action_items: prev.action_items.filter((item) => item.id !== id),
    }))
  }

  const updateActionItemStatus = (id: string, status: ActionItem['status']) => {
    setFormData((prev) => ({
      ...prev,
      action_items: prev.action_items.map((item) =>
        item.id === id ? { ...item, status } : item
      ),
    }))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>{mode === 'edit' ? t('comp.meetingEditModal.titleEdit') : t('comp.meetingEditModal.titleCreate')}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              disabled={saving}
              className="modal-close"
              aria-label={t('common.close')}
              onClick={handleHeaderClose}
            >
              ×
            </button>
          </div>
        </div>

        <form id="meeting-note-form" onSubmit={handleSubmit} className="project-form">
          <div className="form-group">
            <label htmlFor="id">{t('comp.meetingEditModal.noteId')}</label>
            <input
              type="text"
              id="id"
              name="id"
              value={formData.id}
              disabled={mode === 'edit'}
              className="form-input"
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="title">{t('comp.meetingEditModal.meetingTitle')}</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="form-input"
              placeholder={t('comp.meetingEditModal.titlePh')}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="meeting_date">{t('comp.meetingEditModal.meetingAt')}</label>
              <input
                type="date"
                id="meeting_date"
                name="meeting_date"
                value={formData.meeting_date}
                onChange={handleChange}
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="next_meeting_date">{t('comp.meetingEditModal.nextMeeting')}</label>
              <input
                type="date"
                id="next_meeting_date"
                name="next_meeting_date"
                value={formData.next_meeting_date || ''}
                onChange={handleChange}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label>{t('comp.meetingEditModal.attendees')}</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                value={newAttendee}
                onChange={(e) => setNewAttendee(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAttendee())}
                placeholder={t('comp.meetingEditModal.attendeePh')}
                className="form-input"
                style={{ flex: 1 }}
              />
              <button type="button" onClick={addAttendee} className="refresh-button">
                {t('comp.meetingEditModal.add')}
              </button>
            </div>
            {formData.attendees.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {formData.attendees.map((attendee, index) => (
                  <span
                    key={index}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#f0f0f0',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                    }}
                  >
                    {attendee}
                    <button
                      type="button"
                      onClick={() => removeAttendee(index)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#e74c3c',
                        fontSize: '1rem',
                        padding: 0,
                        marginLeft: '0.25rem',
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>{t('comp.meetingEditModal.agenda')}</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                value={newAgendaItem}
                onChange={(e) => setNewAgendaItem(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAgendaItem())}
                placeholder={t('comp.meetingEditModal.agendaPh')}
                className="form-input"
                style={{ flex: 1 }}
              />
              <button type="button" onClick={addAgendaItem} className="refresh-button">
                {t('comp.meetingEditModal.add')}
              </button>
            </div>
            {formData.agenda.length > 0 && (
              <ol style={{ margin: 0, paddingLeft: '1.5rem' }}>
                {formData.agenda.map((item, index) => (
                  <li key={index} style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ flex: 1 }}>{item}</span>
                    <button
                      type="button"
                      onClick={() => removeAgendaItem(index)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#e74c3c',
                        fontSize: '1rem',
                      }}
                    >
                      {t('comp.meetingEditModal.remove')}
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="discussion">{t('comp.meetingEditModal.discussion')}</label>
            <RichTextEditor
              value={formData.discussion}
              onChange={(html) =>
                setFormData((prev) => ({
                  ...prev,
                  discussion: html,
                }))
              }
              placeholder={t('comp.meetingEditModal.discussionPh')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="decisions">{t('comp.meetingEditModal.decisions')}</label>
            <textarea
              id="decisions"
              name="decisions"
              value={formData.decisions}
              onChange={handleChange}
              className="form-input"
              rows={6}
              placeholder={t('comp.meetingEditModal.decisionsPh')}
            />
          </div>

          <div className="form-group">
            <label>{t('comp.meetingEditModal.actionItems')}</label>
            <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  value={newActionItem.description || ''}
                  onChange={(e) => setNewActionItem((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder={t('comp.meetingEditModal.actionDescPh')}
                  className="form-input"
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    value={newActionItem.assignee || ''}
                    onChange={(e) => setNewActionItem((prev) => ({ ...prev, assignee: e.target.value }))}
                    className="form-input"
                    style={{ flex: 1 }}
                  >
                    <option value="">{t('comp.meetingEditModal.selectAssignee')}</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.name}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={newActionItem.due_date || ''}
                    onChange={(e) => setNewActionItem((prev) => ({ ...prev, due_date: e.target.value }))}
                    className="form-input"
                    style={{ flex: 1 }}
                    placeholder={t('comp.meetingEditModal.duePh')}
                  />
                  <button type="button" onClick={addActionItem} className="refresh-button">
                    {t('comp.meetingEditModal.add')}
                  </button>
                </div>
              </div>
            </div>
            {formData.action_items.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {formData.action_items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      padding: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{item.description}</div>
                        <div style={{ fontSize: '0.875rem', color: '#666' }}>
                          {t('comp.meetingEditModal.assigneeMeta', {
                            assignee: item.assignee,
                            due: item.due_date || t('comp.meetingEditModal.dueUnset'),
                          })}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select
                          value={item.status}
                          onChange={(e) => updateActionItemStatus(item.id, e.target.value as ActionItem['status'])}
                          style={{ fontSize: '0.875rem', padding: '0.25rem' }}
                        >
                          <option value="pending">{t('comp.meetingEditModal.stPending')}</option>
                          <option value="in_progress">{t('comp.meetingEditModal.stProgress')}</option>
                          <option value="completed">{t('comp.meetingEditModal.stDone')}</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeActionItem(item.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#e74c3c',
                            fontSize: '1rem',
                          }}
                        >
                          {t('comp.meetingEditModal.remove')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}


