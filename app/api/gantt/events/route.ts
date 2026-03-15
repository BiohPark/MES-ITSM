import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getAccountById } from '@/lib/accounts'

// GET /api/gantt/events?projectId=123
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const projectIdParam = searchParams.get('projectId')
    if (!projectIdParam) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }
    const projectId = parseInt(projectIdParam, 10)
    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 })
    }

    const pool = getPool()
    const [rows] = await pool.query<any[]>(
      `
      SELECT
        id,
        project_id as projectId,
        event_date as date,
        name
      FROM gantt_events
      WHERE project_id = ?
      ORDER BY event_date ASC, id ASC
      `,
      [projectId]
    )

    return NextResponse.json({ events: rows })
  } catch (error: any) {
    console.error('[gantt/events][GET] 오류:', error)
    return NextResponse.json(
      { error: 'Failed to load Gantt events', details: error.message },
      { status: 500 }
    )
  }
}

// POST /api/gantt/events  { projectId, events: [{ id?, date, name }] }
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }
    const account = await getAccountById(session.userId)
    const canEditWbs = session.role === 'admin' || !!session.isAdmin || !!account?.can_edit_wbs
    if (!canEditWbs) {
      return NextResponse.json(
        { error: 'WBS 수정 권한이 없습니다. 관리자에게 권한 부여를 요청하세요.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { projectId, events } = body as {
      projectId?: number
      events?: Array<{ id?: number | string; date: string; name: string }>
    }

    if (!projectId || !Array.isArray(events)) {
      return NextResponse.json(
        { error: 'projectId and events are required' },
        { status: 400 }
      )
    }

    const pool = getPool()
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      // 간단하게: 해당 프로젝트 이벤트 전체 삭제 후, 새 목록 삽입
      await conn.query(`DELETE FROM gantt_events WHERE project_id = ?`, [projectId])

      for (const ev of events) {
        const datePart = (ev.date || '').split('T')[0]
        if (!datePart) continue
        const name = (ev.name || '').trim()
        if (!name) continue

        await conn.query(
          `
          INSERT INTO gantt_events
            (project_id, event_date, name, created_by)
          VALUES (?, ?, ?, ?)
          `,
          [projectId, datePart, name, session.userId]
        )
      }

      await conn.commit()

      return NextResponse.json({ ok: true })
    } catch (error: any) {
      await conn.rollback()
      console.error('[gantt/events][POST] 오류:', error)
      return NextResponse.json(
        { error: 'Failed to save Gantt events', details: error.message },
        { status: 500 }
      )
    } finally {
      conn.release()
    }
  } catch (error: any) {
    console.error('[gantt/events][POST] 치명적 오류:', error)
    return NextResponse.json(
      { error: 'Failed to save Gantt events', details: error.message },
      { status: 500 }
    )
  }
}

