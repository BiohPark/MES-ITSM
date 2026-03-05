'use server'

import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import ExcelJS from 'exceljs'

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
        progress_percent,
        predecessors,
        assignee,
        is_milestone
      FROM gantt_tasks
      WHERE project_id = ?
      ORDER BY sort_order ASC, id ASC
      `,
      [params.projectId]
    )

    const workbook = new ExcelJS.Workbook()

    // Sheet 1: WBS 테이블
    const sheet = workbook.addWorksheet('Gantt')

    sheet.columns = [
      { header: '#', key: 'seq', width: 5 },
      { header: 'WBS', key: 'wbs', width: 10 },
      { header: 'Level', key: 'level', width: 8 },
      { header: 'Task Name', key: 'name', width: 40 },
      { header: 'Progress %', key: 'progress', width: 12 },
      { header: 'Start', key: 'start', width: 14 },
      { header: 'Finish', key: 'finish', width: 14 },
      { header: 'Duration (days)', key: 'duration', width: 16 },
      { header: 'Predecessors', key: 'pred', width: 18 },
      { header: 'Assignee', key: 'assignee', width: 18 },
      { header: 'Milestone', key: 'milestone', width: 10 },
    ]

    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5E7EB' },
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      }
    })

    ;(tasks as any[]).forEach((task, idx) => {
      const level = task.outline_level || 1
      const row = sheet.addRow({
        seq: idx + 1,
        wbs: task.wbs_code || '',
        level,
        name: task.name || '',
        progress:
          task.progress_percent != null
            ? Math.round(Number(task.progress_percent))
            : null,
        start: task.start_date
          ? new Date(task.start_date).toISOString().slice(0, 10)
          : '',
        finish: task.finish_date
          ? new Date(task.finish_date).toISOString().slice(0, 10)
          : '',
        duration: task.duration_days ?? '',
        pred: task.predecessors || '',
        assignee: task.assignee || '',
        milestone: task.is_milestone ? 'Yes' : '',
      })

      // 들여쓰기로 계층 구조 표현 (현재 차트에서 작업명 들여쓰기를 그대로 반영)
      const nameCell = row.getCell('name')
      nameCell.alignment = {
        indent: Math.max(0, level - 1),
      }
    })

    // 격자선 정리
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      row.eachCell((cell) => {
        cell.border = {
          top: cell.border?.top ?? { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        }
      })
    })

    // Sheet 2: Gantt Chart (월/일 축 + Bar)
    const chartSheet = workbook.addWorksheet('Chart')
    chartSheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 2 }]

    const parseDateOnly = (value: unknown): Date | null => {
      if (!value) return null
      const d = new Date(value as string)
      if (Number.isNaN(d.getTime())) return null
      d.setHours(0, 0, 0, 0)
      return d
    }

    let minStart: Date | null = null
    let maxFinish: Date | null = null
    ;(tasks as any[]).forEach((task) => {
      const s = parseDateOnly(task.start_date)
      const f = parseDateOnly(task.finish_date)
      if (s) {
        if (!minStart || s < minStart) minStart = s
      }
      if (f) {
        if (!maxFinish || f > maxFinish) maxFinish = f
      }
    })

    // 날짜 정보가 없으면 Chart 시트는 비워 둠
    if (minStart && maxFinish) {
      const days: Date[] = []
      const cursor = new Date(minStart)
      while (cursor <= maxFinish) {
        days.push(new Date(cursor))
        cursor.setDate(cursor.getDate() + 1)
      }

      // 헤더: A열은 Task, 1행 월, 2행 일
      chartSheet.getCell(1, 1).value = 'Task'
      chartSheet.getCell(1, 1).font = { bold: true }
      chartSheet.getColumn(1).width = 40

      const monthLabels: string[] = []
      days.forEach((d, idx) => {
        const col = 2 + idx
        const monthLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const dayLabel = String(d.getDate()).padStart(2, '0')
        chartSheet.getCell(1, col).value = monthLabel
        chartSheet.getCell(2, col).value = dayLabel
        chartSheet.getCell(2, col).alignment = { horizontal: 'center' }
        chartSheet.getColumn(col).width = 4
        monthLabels[idx] = monthLabel
      })

      // 월별 병합 (1행)
      let currentMonth = monthLabels[0]
      let monthStartCol = 2
      for (let i = 1; i < monthLabels.length; i++) {
        const col = 2 + i
        const m = monthLabels[i]
        if (m !== currentMonth) {
          chartSheet.mergeCells(1, monthStartCol, 1, col - 1)
          currentMonth = m
          monthStartCol = col
        }
      }
      // 마지막 월 병합
      const lastCol = 1 + days.length + 1 - 0 // 1 + (#days) +? actually days.length +1
      chartSheet.mergeCells(1, monthStartCol, 1, 1 + days.length)
      chartSheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' }

      const isSameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      ;(tasks as any[]).forEach((task, idx) => {
        const rowIndex = 3 + idx
        const row = chartSheet.getRow(rowIndex)
        const level = task.outline_level || 1

        row.getCell(1).value = task.name || ''
        row.getCell(1).alignment = { indent: Math.max(0, level - 1) }

        const start = parseDateOnly(task.start_date)
        const finish = parseDateOnly(task.finish_date)
        const progress =
          task.progress_percent != null ? Number(task.progress_percent) : null

        const isComplete = progress != null && progress >= 100
        const isDelayed =
          finish && (progress == null || progress < 100) && today > finish

        const barColor = isComplete
          ? 'FFCBD5E1' // 회색 (완료)
          : isDelayed
          ? 'FFDC2626' // 빨강 (지연)
          : 'FF3B82F6' // 파랑 (진행 중 / 기타)

        if (start && finish) {
          const startIdx = days.findIndex((d) => isSameDay(d, start))
          const endIdx = days.findIndex((d) => isSameDay(d, finish))
          if (startIdx !== -1 && endIdx !== -1) {
            for (let di = startIdx; di <= endIdx; di++) {
              const col = 2 + di
              const cell = row.getCell(col)
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: barColor },
              }
              cell.border = {
                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              }
            }
          }
        }
      })
    }

    const buffer = await workbook.xlsx.writeBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="gantt_project_${project.id}.xlsx"`,
      },
    })
  } catch (error: any) {
    console.error('[gantt/export-excel][GET] 오류:', error)
    return NextResponse.json(
      { error: 'Failed to export Gantt Excel', details: error.message },
      { status: 500 }
    )
  }
}

