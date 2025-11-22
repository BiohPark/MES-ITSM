import { parse } from 'csv-parse/sync'
import fs from 'fs'
import path from 'path'
import { initializeDatabase, createProject } from '../lib/db'
import type { Project, ProjectChild } from '@/types/project'

function parseChildren(value?: string): ProjectChild[] {
  if (!value || value === '[]') return []

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

async function main() {
  try {
    console.log('데이터베이스 초기화 중...')
    await initializeDatabase()
    console.log('데이터베이스 초기화 완료!')

    const csvPath = path.join(process.cwd(), 'data', 'projects.csv')
    if (!fs.existsSync(csvPath)) {
      console.log('CSV 파일을 찾을 수 없습니다:', csvPath)
      return
    }

    console.log('CSV 파일 읽는 중...')
    const fileContent = fs.readFileSync(csvPath, 'utf-8')
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as any[]

    console.log(`${records.length}개의 프로젝트를 마이그레이션 중...`)

    for (const record of records) {
      const project: Project = {
        id: record.id,
        name: record.name,
        owner: record.owner,
        members: parseInt(record.members, 10),
        status: record.status,
        progress: parseInt(record.progress, 10),
        due: record.due,
        children: parseChildren(record.children),
      }

      try {
        await createProject(project)
        console.log(`✓ ${project.id}: ${project.name}`)
      } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`- ${project.id}: ${project.name} (이미 존재함)`)
        } else {
          console.error(`✗ ${project.id}: ${project.name}`, error.message)
        }
      }
    }

    console.log('마이그레이션 완료!')
    process.exit(0)
  } catch (error) {
    console.error('마이그레이션 실패:', error)
    process.exit(1)
  }
}

main()

