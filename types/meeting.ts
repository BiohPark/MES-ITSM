export interface MeetingNote {
  id: string
  title: string
  meeting_date: string
  attendees: string[] // 참석자 목록
  agenda: string[] // 안건 목록
  discussion: string // 논의 내용
  decisions: string // 결정 사항
  action_items: ActionItem[] // 액션 아이템
  next_meeting_date?: string | null // 다음 회의 일정
  created_by: string // 작성자
  created_at?: string
  updated_at?: string
  status?: 'draft' | 'final'
}

export interface ActionItem {
  id: string
  description: string
  assignee: string
  due_date?: string | null
  status: 'pending' | 'in_progress' | 'completed'
}


