'use client'

import { useMemo } from 'react'
import type { MeetingNote } from '@/types/meeting'
import { useI18n } from '@/lib/i18n'

export function MeetingNoteTemplateModal({
  meetingNote,
  onClose,
}: {
  meetingNote: MeetingNote
  onClose: () => void
}) {
  const { t } = useI18n()

  const formatDate = (value?: string | null) => value || '-'

  const templateText = useMemo(() => {
    return [
      t('comp.meetingTemplate.lineTitle', { v: meetingNote.title || '-' }),
      t('comp.meetingTemplate.lineDate', { v: formatDate(meetingNote.meeting_date) }),
      t('comp.meetingTemplate.lineAuthor', { v: meetingNote.created_by || '-' }),
      '',
      `${t('comp.meetingTemplate.attendees')} ${
        meetingNote.attendees && meetingNote.attendees.length > 0
          ? meetingNote.attendees.join(', ')
          : '-'
      }`,
      '',
      t('comp.meetingTemplate.sectionAgenda'),
      ...(meetingNote.agenda && meetingNote.agenda.length > 0
        ? meetingNote.agenda.map((item, idx) => `  ${idx + 1}. ${item}`)
        : ['  -']),
      '',
      t('comp.meetingTemplate.sectionDiscussion'),
      meetingNote.discussion || '-',
      '',
      t('comp.meetingTemplate.sectionDecisions'),
      meetingNote.decisions || '-',
      '',
      t('comp.meetingTemplate.sectionActions'),
      ...(meetingNote.action_items && meetingNote.action_items.length > 0
        ? meetingNote.action_items.map((item, idx) => {
            const due = item.due_date
              ? t('comp.meetingTemplate.dueSuffix', { v: formatDate(item.due_date) })
              : ''
            const status =
              item.status === 'completed'
                ? t('comp.meetingTemplate.stDone')
                : item.status === 'in_progress'
                  ? t('comp.meetingTemplate.stProgress')
                  : t('comp.meetingTemplate.stPending')
            return t('comp.meetingTemplate.actionLine', {
              n: idx + 1,
              desc: item.description,
              assignee: item.assignee,
              due,
              status,
            })
          })
        : ['  -']),
    ].join('\n')
  }, [meetingNote, t])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(templateText)
      alert(t('comp.meetingTemplate.copyOk'))
    } catch (error) {
      console.error('Failed to copy meeting template:', error)
      alert(t('comp.meetingTemplate.copyFail'))
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '1024px', maxHeight: '95vh', overflowY: 'auto' }}
      >
        <div className="modal-header">
          <h2>{t('comp.meetingTemplate.title')}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ margin: 0 }}
              onClick={handleCopy}
            >
              {t('comp.meetingTemplate.copyBtn')}
            </button>
            <button className="modal-close" onClick={onClose}>
              ×
            </button>
          </div>
        </div>

        <div className="project-form">
          <div className="form-group">
            <label>{t('comp.meetingTemplate.label')}</label>
            <textarea
              readOnly
              value={templateText}
              style={{
                width: '100%',
                minHeight: '480px',
                fontFamily: 'monospace',
                whiteSpace: 'pre',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
