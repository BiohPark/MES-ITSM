import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getSession } from '@/lib/auth'

type GanttProjectRow = {
  id: number
  name: string
  description?: string | null
  ownerId?: string | null
  canonicalProjectId?: string | null
  createdAt?: string
  updatedAt?: string
}

type GanttProjectsCacheEntry = {
  cachedAt: number
  projects: GanttProjectRow[]
}

type GanttProjectsCacheState = typeof globalThis & {
  __itsmGanttProjectsCache?: GanttProjectsCacheEntry
}

const ganttProjectsCacheState = globalThis as GanttProjectsCacheState
const GANTT_PROJECTS_CACHE_TTL_MS = 15_000

// Gantt 프로젝트 목록 조회 / 생성 / 수정 / 삭제

export async function GET() {
  try {
    const cached = ganttProjectsCacheState.__itsmGanttProjectsCache
    if (cached && Date.now() - cached.cachedAt < GANTT_PROJECTS_CACHE_TTL_MS) {
      return NextResponse.json({ projects: cached.projects, cached: true })
    }

    const pool = getPool()
    const [rawRows] = await pool.query(
      `SELECT id, name, description, owner_id as ownerId,
              canonical_project_id as canonicalProjectId,
              created_at as createdAt, updated_at as updatedAt
       FROM gantt_projects
       ORDER BY id DESC`
    )
    const rows = rawRows as GanttProjectRow[]

    ganttProjectsCacheState.__itsmGanttProjectsCache = {
      cachedAt: Date.now(),
      projects: rows,
    }
    return NextResponse.json({ projects: rows })
  } catch (error: any) {
    console.error('[gantt/projects][GET] 오류:', error)
    if (error?.code === 'ER_CON_COUNT_ERROR') {
      const cached = ganttProjectsCacheState.__itsmGanttProjectsCache
      if (cached) {
        return NextResponse.json({ projects: cached.projects, stale: true }, { status: 200 })
      }
    }
    return NextResponse.json(
      { error: 'Failed to load Gantt projects', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    const body = await req.json()
    const { id, name, description, canonicalProjectId } = body as {
      id?: number
      name?: string
      description?: string | null
      canonicalProjectId?: string | null
    }

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      )
    }

    const pool = getPool()

    if (id) {
      const canon =
        canonicalProjectId === undefined
          ? undefined
          : canonicalProjectId === '' || canonicalProjectId == null
            ? null
            : String(canonicalProjectId)
      if (canon !== undefined) {
        await pool.query(
          `UPDATE gantt_projects SET name = ?, description = ?, canonical_project_id = ? WHERE id = ?`,
          [name, description ?? null, canon, id]
        )
      } else {
        await pool.query(
          `UPDATE gantt_projects SET name = ?, description = ? WHERE id = ?`,
          [name, description ?? null, id]
        )
      }
      ganttProjectsCacheState.__itsmGanttProjectsCache = undefined
      return NextResponse.json({ success: true, id })
    } else {
      const canon =
        canonicalProjectId === undefined || canonicalProjectId === '' || canonicalProjectId == null
          ? null
          : String(canonicalProjectId)
      const [result] = await pool.query<any>(
        `INSERT INTO gantt_projects (name, description, owner_id, canonical_project_id) VALUES (?, ?, ?, ?)`,
        [name, description ?? null, session?.userId ?? null, canon]
      )
      ganttProjectsCacheState.__itsmGanttProjectsCache = undefined
      return NextResponse.json({ success: true, id: result.insertId })
    }
  } catch (error: any) {
    console.error('[gantt/projects][POST] 오류:', error)
    return NextResponse.json(
      { error: 'Failed to save Gantt project', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Project id is required' },
        { status: 400 }
      )
    }

    const pool = getPool()
    const conn = await pool.getConnection()

    try {
      await conn.beginTransaction()

      // 관련 태스크 먼저 삭제
      await conn.query(`DELETE FROM gantt_tasks WHERE project_id = ?`, [id])

      // 프로젝트 삭제
      await conn.query(`DELETE FROM gantt_projects WHERE id = ?`, [id])

      await conn.commit()
      ganttProjectsCacheState.__itsmGanttProjectsCache = undefined
      return NextResponse.json({ success: true })
    } catch (error: any) {
      await conn.rollback()
      throw error
    } finally {
      conn.release()
    }
  } catch (error: any) {
    console.error('[gantt/projects][DELETE] 오류:', error)
    return NextResponse.json(
      { error: 'Failed to delete Gantt project', details: error.message },
      { status: 500 }
    )
  }
}


