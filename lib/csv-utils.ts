import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import fs from 'fs'
import path from 'path'
import type { Project, ProjectChild } from '@/types/project'

const DATA_DIR = path.join(process.cwd(), 'data')
const CSV_FILE = path.join(DATA_DIR, 'projects.csv')

function parseChildren(value?: string): ProjectChild[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.map((child) => ({
        id: child.id || `CH-${Date.now()}`,
        title: child.title || '',
        owner: child.owner || '',
        status: child.status || 'Planning',
        due: child.due || '',
      }))
    }
  } catch (error) {
    console.warn('Failed to parse children column, fallback to empty array.', error)
  }

  return []
}

export function readProjects(): Project[] {
  try {
    if (!fs.existsSync(CSV_FILE)) {
      // CSV 파일이 없으면 빈 배열 반환
      return []
    }

    const fileContent = fs.readFileSync(CSV_FILE, 'utf-8')
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as any[]

    return records.map((record) => ({
      id: record.id,
      name: record.name,
      owner: record.owner,
      members: parseInt(record.members, 10),
      status: record.status,
      progress: parseInt(record.progress, 10),
      due: record.due,
      children: parseChildren(record.children),
    }))
  } catch (error) {
    console.error('Error reading CSV file:', error)
    return []
  }
}

export function writeProjects(projects: Project[]): boolean {
  try {
    // data 디렉토리가 없으면 생성
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }

    const csv = stringify(
      projects.map((project) => ({
        ...project,
        children: JSON.stringify(project.children ?? []),
      })),
      {
      header: true,
        columns: [
          'id',
          'name',
          'owner',
          'members',
          'status',
          'progress',
          'due',
          'children',
        ],
      }
    )

    fs.writeFileSync(CSV_FILE, csv, 'utf-8')
    return true
  } catch (error) {
    console.error('Error writing CSV file:', error)
    return false
  }
}

