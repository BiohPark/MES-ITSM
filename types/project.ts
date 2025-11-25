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

