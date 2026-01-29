export type TabKey = 'dashboard' | 'gmp-record' | 'list' | 'val-pkg' | 'tasks' | 'personal' | 'gantt' | 'issues' | 'search' | 'voc' | 'backup' | 'meetings' | 'action-items'

export const TABS: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'gmp-record', label: 'GMP Record' },
  { key: 'tasks', label: '개발 일감' },
  { key: 'list', label: '프로젝트' },
  { key: 'val-pkg', label: 'VAL Pkg' },
  { key: 'personal', label: '개인별 일감' },
  { key: 'gantt', label: 'Gantt Chart' },
  { key: 'issues', label: '이슈 관리' },
  { key: 'meetings', label: '회의록' },
  { key: 'voc', label: 'VOC 관리' },
  { key: 'backup', label: '백업' },
  { key: 'search', label: 'search' },
]

/**
 * 소프트웨어 릴리즈 버전 정보
 * 형식: Major.Minor.Patch[-Build]
 * 
 * 버전 변경 규칙:
 * - Major: 주요 기능 변경 또는 하위 호환성 없는 변경
 * - Minor: 새로운 기능 추가 (하위 호환성 유지)
 * - Patch: 버그 수정 (하위 호환성 유지)
 * - Build: 빌드 번호 또는 날짜 (선택사항)
 */
export const APP_VERSION = {
  /** 전체 버전 문자열 (예: "1.0.0" 또는 "1.0.0-20241213") */
  version: '1.0.0',
  
  /** Major 버전 번호 */
  major: 1,
  
  /** Minor 버전 번호 */
  minor: 0,
  
  /** Patch 버전 번호 */
  patch: 0,
  
  /** 빌드 번호 또는 날짜 (선택사항) */
  build: undefined as string | undefined,
  
  /** 릴리즈 날짜 (YYYY-MM-DD 형식) */
  releaseDate: '2025-12-15',
  
  /** 버전 전체 문자열 반환 */
  getFullVersion(): string {
    return this.build ? `${this.version}-${this.build}` : this.version
  },
  
  /** 버전 정보 객체 반환 */
  getVersionInfo() {
    return {
      version: this.getFullVersion(),
      major: this.major,
      minor: this.minor,
      patch: this.patch,
      build: this.build,
      releaseDate: this.releaseDate,
    }
  },
}

