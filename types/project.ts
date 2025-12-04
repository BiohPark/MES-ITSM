export interface TaskPhase {
  owner: string
  status: string
  progress: number
  start: string
  due: string
}

export interface ProjectChild {
  id: string
  title: string
  owner: string
  status: string
  progress?: number
  start?: string
  due: string
  description?: string
  phases?: {
    pi?: TaskPhase
    pm?: TaskPhase
    development?: TaskPhase
  }
  // GMP Record 전용 필드들 (일반 일감에는 사용되지 않을 수 있음)
  kind?: string
  number?: number
  kind_number?: string
  isGmpRecord?: boolean
  linked_task_id?: string | null
  linked_gmp_record_id?: string | null
}

export interface Project {
  id: string
  name: string
  owner: string
  members: number
  status: string
  progress: number
  start?: string
  due: string
  description?: string
  srb_ver?: string
  children: ProjectChild[]
}

