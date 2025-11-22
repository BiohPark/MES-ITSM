export interface ProjectChild {
  id: string
  title: string
  owner: string
  status: string
  progress?: number
  start?: string
  due: string
  description?: string
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

