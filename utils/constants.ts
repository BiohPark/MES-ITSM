export type TabKey = 'dashboard' | 'gmp-record' | 'list' | 'tasks' | 'personal' | 'gantt' | 'issues' | 'search'

export const TABS: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'gmp-record', label: 'GMP Record' },
  { key: 'tasks', label: '개발 일감' },
  { key: 'list', label: '프로젝트' },
  { key: 'personal', label: '개인별 일감' },
  { key: 'gantt', label: 'Gantt Chart' },
  { key: 'issues', label: '이슈 관리' },
  { key: 'search', label: 'search' },
]

