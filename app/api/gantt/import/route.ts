import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { XMLParser } from 'fast-xml-parser'

// MS Project XML Import
// formData의 file(단일) + projectName(optional)을 받아 새 gantt_project와 gantt_tasks를 생성

interface ProjectXML {
  Project?: {
    Name?: string
    Tasks?: {
      Task?: TaskXML | TaskXML[]
    }
  }
}

interface TaskXML {
  UID?: number
  ID?: number
  Name?: string
  Start?: string
  Finish?: string
  Duration?: string
  OutlineLevel?: number
  WBS?: string
  PredecessorLink?: PredecessorLinkXML | PredecessorLinkXML[]
  ResourceLink?: ResourceLinkXML | ResourceLinkXML[]
}

interface PredecessorLinkXML {
  PredecessorUID?: number
  Type?: number
  LinkLag?: number
}

interface ResourceLinkXML {
  ResourceUID?: number
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const projectName =
      (formData.get('projectName') as string | null) ?? 'Imported Gantt Project'

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'XML file is required (field name: file)' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const text = buffer.toString('utf-8')

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: true,
      trimValues: true,
    })

    const parsed = parser.parse(text) as ProjectXML

    if (!parsed.Project) {
      return NextResponse.json(
        { error: 'Invalid Microsoft Project XML format' },
        { status: 400 }
      )
    }

    const projectNameFromXML = parsed.Project.Name || projectName
    const tasks = parsed.Project.Tasks?.Task
    const taskArray = Array.isArray(tasks) ? tasks : tasks ? [tasks] : []

    const pool = getPool()
    const conn = await pool.getConnection()

    try {
      await conn.beginTransaction()

      // 프로젝트 생성
      const [projResult] = await conn.query<any>(
        `INSERT INTO gantt_projects (name, description) VALUES (?, ?)`,
        [projectNameFromXML, 'Imported from MS Project XML']
      )
      const projectId = projResult.insertId as number

      // UID를 인덱스로 매핑
      const uidToIndex = new Map<number, number>()
      taskArray.forEach((task, idx) => {
        if (task.UID) {
          uidToIndex.set(task.UID, idx + 1)
        }
      })

      let sortOrder = 1

      for (const task of taskArray) {
        const name = task.Name || 'Unnamed Task'
        const outlineLevel = task.OutlineLevel || 1
        const wbsCode = task.WBS || null

        // 날짜 파싱
        let startDate: Date | null = null
        let finishDate: Date | null = null
        if (task.Start) {
          startDate = new Date(task.Start)
        }
        if (task.Finish) {
          finishDate = new Date(task.Finish)
        }

        // Duration 파싱 (PT4D, PT8H 형식 또는 숫자)
        let durationDays: number | null = null
        if (task.Duration) {
          // PT10D 형식 (일)
          const dayMatch = task.Duration.match(/PT(\d+)D/i)
          if (dayMatch) {
            durationDays = parseInt(dayMatch[1], 10) || null
          } else {
            // PT8H 형식 (시간) - 8시간 이상이면 1일로 처리
            const hourMatch = task.Duration.match(/PT(\d+)H/i)
            if (hourMatch) {
              const hours = parseInt(hourMatch[1], 10) || 0
              durationDays = Math.ceil(hours / 8) // 8시간 = 1일로 계산
            } else {
              // 숫자만 있는 경우
              const numMatch = task.Duration.match(/(\d+)/)
              if (numMatch) {
                durationDays = parseInt(numMatch[1], 10) || null
              }
            }
          }
        } else if (startDate && finishDate) {
          const diffTime = finishDate.getTime() - startDate.getTime()
          durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        }

        // Predecessor 파싱
        const predecessorLinks = Array.isArray(task.PredecessorLink)
          ? task.PredecessorLink
          : task.PredecessorLink
          ? [task.PredecessorLink]
          : []

        const predecessorStrings: string[] = []
        for (const link of predecessorLinks) {
          if (link.PredecessorUID) {
            const predIndex = uidToIndex.get(link.PredecessorUID)
            if (predIndex) {
              const type = link.Type === 0 ? 'FS' : link.Type === 1 ? 'SS' : link.Type === 2 ? 'FF' : 'SF'
              const lag = link.LinkLag ? Math.round(link.LinkLag / 1440) : 0 // 분을 일로 변환 (1440분 = 1일)
              const lagStr = lag === 0 ? '' : lag > 0 ? `+${lag}` : `${lag}`
              predecessorStrings.push(`${predIndex}${type}${lagStr}`)
            }
          }
        }
        const predecessors = predecessorStrings.join(', ') || null

        // Resource 파싱
        const resourceLinks = Array.isArray(task.ResourceLink)
          ? task.ResourceLink
          : task.ResourceLink
          ? [task.ResourceLink]
          : []
        const assignee = resourceLinks.length > 0 ? `Resource ${resourceLinks.map(r => r.ResourceUID).join(', ')}` : null

        await conn.query(
          `
          INSERT INTO gantt_tasks
            (project_id, wbs_code, outline_level, sort_order, name, start_date, finish_date, duration_days, predecessors, assignee, is_milestone)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            projectId,
            wbsCode,
            outlineLevel,
            sortOrder++,
            name,
            startDate,
            finishDate,
            durationDays,
            predecessors,
            assignee,
            0,
          ]
        )
      }

      await conn.commit()

      return NextResponse.json({
        success: true,
        projectId,
      })
    } catch (error: any) {
      await conn.rollback()
      throw error
    } finally {
      conn.release()
    }
  } catch (error: any) {
    console.error('[gantt/import][POST] 오류:', error)
    return NextResponse.json(
      { error: 'Failed to import MS Project XML', details: error.message },
      { status: 500 }
    )
  }
}


