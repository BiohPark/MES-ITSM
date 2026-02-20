'use client'

import type { MeetingNote } from '@/types/meeting'

export function MeetingNoteTemplateModal({
  meetingNote,
  onClose,
}: {
  meetingNote: MeetingNote
  onClose: () => void
}) {
  const formatDate = (value?: string | null) => value || '-'

  const templateText = [
    `회의 제목: ${meetingNote.title || '-'}`,
    `회의 일시: ${formatDate(meetingNote.meeting_date)}`,
    `작성자: ${meetingNote.created_by || '-'}`,
    '',
    `참석자: ${
      meetingNote.attendees && meetingNote.attendees.length > 0
        ? meetingNote.attendees.join(', ')
        : '-'
    }`,
    '',
    '[안건]',
    ...(meetingNote.agenda && meetingNote.agenda.length > 0
      ? meetingNote.agenda.map((item, idx) => `  ${idx + 1}. ${item}`)
      : ['  -']),
    '',
    '[논의 내용]',
    meetingNote.discussion || '-',
    '',
    '[결정 사항]',
    meetingNote.decisions || '-',
    '',
    '[Action Items]',
    ...(meetingNote.action_items && meetingNote.action_items.length > 0
      ? meetingNote.action_items.map((item, idx) => {
          const due = item.due_date ? ` (Due: ${formatDate(item.due_date)})` : ''
          const status =
            item.status === 'completed'
              ? '완료'
              : item.status === 'in_progress'
                ? '진행 중'
                : '대기'
          return `  ${idx + 1}. ${item.description} - 담당자: ${item.assignee}${due} [${status}]`
        })
      : ['  -']),
  ].join('\n')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(templateText)
      alert('회의록 템플릿이 클립보드에 복사되었습니다.\n이메일 본문에 Ctrl+V로 붙여넣기 하세요.')
    } catch (error) {
      console.error('Failed to copy meeting template:', error)
      alert('클립보드 복사에 실패했습니다. 텍스트를 직접 선택해서 복사해 주세요.')
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
          <h2>회의록 템플릿 보기</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ margin: 0 }}
              onClick={handleCopy}
            >
              복사
            </button>
            <button className="modal-close" onClick={onClose}>
              ×
            </button>
          </div>
        </div>

        <div className="project-form">
          <div className="form-group">
            <label>이메일에 붙여넣을 회의록 템플릿</label>
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

