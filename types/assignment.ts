export type AssignmentKind =
  | 'project-task'
  | 'gmp-record'
  | 'issue'
  | 'ticket'
  | 'gantt-task'
  | 'action-item'

export interface MyAssignmentItem {
  id: string
  kind: AssignmentKind
  label: string
  title: string
  subtitle?: string
  status?: string
  dueDate?: string | null
  url: string
}

export interface MyAssignmentsResponse {
  items: MyAssignmentItem[]
}
