export interface Issue {
  id: string
  title: string
  description?: string
  status: string // 이슈 상태 (Open, In Progress, Resolved, Closed 등)
  owner: string // 담당자 (해결할 사람)
  occurred_date: string // 발생일
  due_date?: string // 마감일 (완료 예정일)
  resolved_date?: string // 해결일
  sw_version?: string // 발생한 S/W 버전
  resolved_sw_version?: string // 해결 S/W 버전
  cause?: string // 원인
  cause_category?: string // 원인 분류
  module?: string // 발생 모듈
  is_deviation: boolean // Deviation 판정 여부
  related_issue_id?: string // 관련 이슈 ID (재발 이슈 추적용)
  created_at?: string
  updated_at?: string
}

