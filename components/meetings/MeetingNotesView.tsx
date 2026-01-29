'use client'

import { useState } from 'react'
import type { MeetingNote } from '@/types/meeting'
import { StatusBadge } from '../common/StatusBadge'

export function MeetingNotesView({
  meetingNotes,
  loading,
  error,
  onRefresh,
  onMeetingNoteClick,
  onNewMeetingNote,
  isDeleteMode,
  selectedMeetingNoteIds,
  onToggleMeetingNoteSelection,
  onDeleteModeChange,
  onBatchDelete,
  searchKeyword,
  onSearchChange,
}: {
  meetingNotes: MeetingNote[]
  loading: boolean
  error: string | null
  onRefresh: () => void | Promise<void>
  onMeetingNoteClick: (meetingNote: MeetingNote) => void
  onNewMeetingNote: () => void
  isDeleteMode: boolean
  selectedMeetingNoteIds: Set<string>
  onToggleMeetingNoteSelection: (meetingNoteId: string) => void
  onDeleteModeChange: (enabled: boolean) => void
  onBatchDelete: () => void
  searchKeyword: string
  onSearchChange: (keyword: string) => void
}) {
  if (loading) {
    return (
      <div className="placeholder">
        <p>데이터를 불러오는 중...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="placeholder">
        <p style={{ color: '#e74c3c' }}>오류: {error}</p>
        <button onClick={onRefresh} className="refresh-button">
          다시 시도
        </button>
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <div className="table-header">
        <h2>회의록 목록</h2>
        <div className="table-actions">
          <input
            type="text"
            placeholder="제목, 내용 검색..."
            value={searchKeyword}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #ddd',
              borderRadius: '2px',
              fontSize: '0.875rem',
              width: '250px',
            }}
          />
          <button onClick={onRefresh} className="refresh-button">
            새로고침
          </button>
          {!isDeleteMode ? (
            <>
              <button onClick={onNewMeetingNote} className="primary-button">
                New
              </button>
              <button
                onClick={() => onDeleteModeChange(true)}
                className="primary-button"
                style={{ backgroundColor: '#e74c3c' }}
              >
                삭제
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  onDeleteModeChange(false)
                }}
                className="refresh-button"
              >
                취소
              </button>
              {selectedMeetingNoteIds.size > 0 && (
                <button
                  onClick={onBatchDelete}
                  className="primary-button"
                  style={{ backgroundColor: '#e74c3c' }}
                >
                  선택 삭제 ({selectedMeetingNoteIds.size})
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {meetingNotes.length === 0 ? (
        <div className="placeholder">
          <p>등록된 회의록이 없습니다.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              {isDeleteMode && <th style={{ width: '50px' }}>선택</th>}
              <th style={{ width: '120px' }}>회의 일시</th>
              <th>제목</th>
              <th style={{ width: '150px' }}>참석자</th>
              <th style={{ width: '120px' }}>작성자</th>
              <th style={{ width: '120px' }}>작성일</th>
            </tr>
          </thead>
          <tbody>
            {meetingNotes.map((meetingNote) => (
              <tr
                key={meetingNote.id}
                onClick={() => !isDeleteMode && onMeetingNoteClick(meetingNote)}
                style={{ cursor: isDeleteMode ? 'default' : 'pointer' }}
              >
                {isDeleteMode && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedMeetingNoteIds.has(meetingNote.id)}
                      onChange={() => onToggleMeetingNoteSelection(meetingNote.id)}
                    />
                  </td>
                )}
                <td>{meetingNote.meeting_date}</td>
                <td style={{ fontWeight: 500 }}>{meetingNote.title}</td>
                <td>
                  {meetingNote.attendees && meetingNote.attendees.length > 0
                    ? meetingNote.attendees.slice(0, 3).join(', ') + (meetingNote.attendees.length > 3 ? '...' : '')
                    : '-'}
                </td>
                <td>{meetingNote.created_by}</td>
                <td>
                  {meetingNote.created_at
                    ? new Date(meetingNote.created_at).toLocaleDateString('ko-KR')
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

