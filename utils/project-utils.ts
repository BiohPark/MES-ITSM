'use client'

import type { Project, ProjectChild } from '@/types/project'
import type { Issue } from '@/types/issue'

export const buildNewProject = async (): Promise<Project> => {
  const response = await fetch('/api/projects?type=project')
  const data = await response.json()
  const project: any = {
    id: data.nextId || 'PJT-00001',
    name: '',
    owner: '',
    members: 1,
    status: 'Planning',
    progress: 0,
    start: new Date().toISOString().slice(0, 10),
    due: new Date().toISOString().slice(0, 10),
    children: [],
  }
  project.description = ''
  return project as Project
}

export const buildNewChild = async (): Promise<ProjectChild> => {
  const response = await fetch('/api/projects?type=task')
  const data = await response.json()
  const child: any = {
    id: data.nextId || 'TASK-00001',
    title: '',
    owner: '',
    status: 'Planning',
    progress: 0,
    start: new Date().toISOString().slice(0, 10),
    due: new Date().toISOString().slice(0, 10),
  }
  child.description = ''
  return child as ProjectChild
}

export const buildNewGmpRecord = async (): Promise<ProjectChild> => {
  const response = await fetch('/api/gmp-records?type=record')
  const data = await response.json()
  const record: any = {
    id: data.nextId || 'GMP-00001',
    title: '',
    owner: '',
    status: 'Planning',
    progress: 0,
    start: new Date().toISOString().slice(0, 10),
    due: new Date().toISOString().slice(0, 10),
    kind: 'CC',
    number: 0,
  }
  record.description = ''
  return record as ProjectChild
}

export const buildNewIssue = async (): Promise<Issue> => {
  const response = await fetch('/api/issues?type=issue')
  const data = await response.json()
  const issue: Issue = {
    id: data.nextId || 'ISSUE-00001',
    title: '',
    description: '',
    status: 'Open',
    owner: '',
    occurred_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    resolved_date: '',
    sw_version: '',
    resolved_sw_version: '',
    cause: '',
    cause_category: '',
    module: '',
    is_deviation: false,
    related_issue_id: '',
  }
  return issue
}

export const buildNewValPackage = async (): Promise<Project> => {
  const response = await fetch('/api/val-packages?type=val-package')
  const data = await response.json()
  const valPackage: any = {
    id: data.nextId || 'Val-00001',
    name: '',
    owner: '',
    members: 1,
    status: 'Planning',
    progress: 0,
    start: new Date().toISOString().slice(0, 10),
    due: new Date().toISOString().slice(0, 10),
    children: [],
  }
  valPackage.description = ''
  return valPackage as Project
}

