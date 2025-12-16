import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { parse } from 'csv-parse/sync'

// MS Project에서 Export한 CSV Import (1차 단순 버전)
// formData의 file(단일) + projectName(optional)을 받아 새 gantt_project와 gantt_tasks를 생성

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const projectName =
      (formData.get('projectName') as string | null) ?? 'Imported Gantt Project'

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'CSV file is required (field name: file)' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const text = buffer.toString('utf-8')

    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
    }) as Array<Record<string, string>>

    const pool = getPool()
    const conn = await pool.getConnection()

    try {
      await conn.beginTransaction()

      // 프로젝트 생성
      const [projResult] = await conn.query<any>(
        `INSERT INTO gantt_projects (name, description) VALUES (?, ?)`,
        [projectName, 'Imported from MS Project CSV']
      )
      const projectId = projResult.insertId as number

      let sortOrder = 1

      for (const r of records) {
        const name =
          r['Task Name'] || r['Name'] || r['TaskName'] || 'Unnamed Task'
        const outlineLevelStr =
          r['Outline Level'] || r['OutlineLevel'] || r['Level'] || '1'
        const outlineLevel = parseInt(outlineLevelStr || '1', 10) || 1

        const startRaw = r['Start'] || r['Start Date'] || ''
        const finishRaw = r['Finish'] || r['Finish Date'] || ''
        const durationRaw = r['Duration'] || ''

        let durationDays: number | null = null
        const durationMatch = durationRaw.match(/(\d+)/)
        if (durationMatch) {
          durationDays = parseInt(durationMatch[1], 10) || null
        }

        const predecessors =
          r['Predecessors'] || r['Predecessor'] || r['Predecessor Tasks'] || ''
        const assignee =
          r['Resource Names'] || r['Resources'] || r['Owner'] || ''

        await conn.query(
          `
          INSERT INTO gantt_tasks
            (project_id, wbs_code, outline_level, sort_order, name, start_date, finish_date, duration_days, predecessors, assignee, is_milestone)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            projectId,
            r['WBS'] || r['WBS Code'] || null,
            outlineLevel,
            sortOrder++,
            name,
            startRaw ? new Date(startRaw) : null,
            finishRaw ? new Date(finishRaw) : null,
            durationDays,
            predecessors || null,
            assignee || null,
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
      { error: 'Failed to import Gantt CSV', details: error.message },
      { status: 500 }
    )
  }
}


