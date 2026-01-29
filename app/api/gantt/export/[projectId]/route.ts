import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { XMLBuilder } from 'fast-xml-parser'

// MS Project XML Export

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const pool = getPool()

    const [[project]] = await pool.query<any[]>(
      `SELECT id, name FROM gantt_projects WHERE id = ?`,
      [params.projectId]
    )

    if (!project) {
      return NextResponse.json(
        { error: 'Gantt project not found' },
        { status: 404 }
      )
    }

    const [tasks] = await pool.query<any[]>(
      `
      SELECT 
        id,
        wbs_code,
        outline_level,
        name,
        start_date,
        finish_date,
        duration_days,
        predecessors,
        assignee,
        is_milestone
      FROM gantt_tasks
      WHERE project_id = ?
      ORDER BY sort_order ASC, id ASC
      `,
      [params.projectId]
    )

    // Predecessor 문자열 파싱을 위한 헬퍼
    // Predecessor 문자열은 "2FS+5" 형식으로, 숫자는 행 인덱스(1부터 시작)를 의미
    const parsePredecessorString = (predStr: string | null, indexToUidMap: Map<number, number>): any[] => {
      if (!predStr) return []
      const links: any[] = []
      const parts = predStr.split(',').map(s => s.trim())
      for (const part of parts) {
        const match = part.match(/(\d+)(FS|SS|FF|SF)([+-]?\d+)?/)
        if (match) {
          const [, indexStr, type, lagStr] = match
          const index = parseInt(indexStr, 10)
          const uid = indexToUidMap.get(index)
          if (uid) {
            const typeNum = type === 'FS' ? 0 : type === 'SS' ? 1 : type === 'FF' ? 2 : 3
            const lag = lagStr ? parseInt(lagStr, 10) * 1440 : 0 // 일을 분으로 변환 (1440분 = 1일)
            links.push({
              PredecessorUID: uid,
              Type: typeNum,
              LinkLag: lag,
            })
          }
        }
      }
      return links
    }

    // 행 인덱스(1부터 시작)를 UID로 매핑
    const indexToUidMap = new Map<number, number>()
    ;(tasks as any[]).forEach((task, idx) => {
      indexToUidMap.set(idx + 1, idx + 1) // UID는 행 인덱스와 동일하게 사용
    })

    const xmlTasks = (tasks as any[]).map((task, idx) => {
      const uid = idx + 1
      const predecessorLinks = parsePredecessorString(task.predecessors, indexToUidMap)

      const taskObj: any = {
        UID: uid,
        ID: uid,
        Name: task.name || '',
        OutlineLevel: task.outline_level || 1,
      }

      if (task.wbs_code) {
        taskObj.WBS = task.wbs_code
      }

      if (task.start_date) {
        taskObj.Start = new Date(task.start_date).toISOString()
      }

      if (task.finish_date) {
        taskObj.Finish = new Date(task.finish_date).toISOString()
      }

      if (task.duration_days != null) {
        taskObj.Duration = `PT${task.duration_days}D`
      }

      if (predecessorLinks.length > 0) {
        taskObj.PredecessorLink = predecessorLinks.length === 1 ? predecessorLinks[0] : predecessorLinks
      }

      if (task.assignee) {
        taskObj.ResourceLink = {
          ResourceUID: 1, // 기본값, 실제로는 리소스 매핑이 필요
        }
      }

      if (task.is_milestone) {
        taskObj.Type = 0 // Milestone
      }

      return taskObj
    })

    const projectXml = {
      Project: {
        '@_xmlns': 'http://schemas.microsoft.com/project',
        Name: project.name || 'Gantt Project',
        Tasks: {
          Task: xmlTasks.length === 1 ? xmlTasks[0] : xmlTasks,
        },
      },
    }

    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
      indentBy: '  ',
    })

    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${builder.build(projectXml)}`

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="gantt_project_${project.id}.xml"`,
      },
    })
  } catch (error: any) {
    console.error('[gantt/export][GET] 오류:', error)
    return NextResponse.json(
      { error: 'Failed to export MS Project XML', details: error.message },
      { status: 500 }
    )
  }
}


