import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getSession } from '@/lib/auth'

// Gantt 프로젝트 목록 조회 / 생성 / 수정 / 삭제

export async function GET() {
  try {
    const pool = getPool()
    const [rows] = await pool.query<any[]>(`
      SELECT id, name, description, owner_id as ownerId, created_at as createdAt, updated_at as updatedAt
      FROM gantt_projects
      ORDER BY id DESC
    `)

    return NextResponse.json({ projects: rows })
  } catch (error: any) {
    console.error('[gantt/projects][GET] 오류:', error)
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
    const { id, name, description } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      )
    }

    const pool = getPool()

    if (id) {
      await pool.query(
        `UPDATE gantt_projects SET name = ?, description = ? WHERE id = ?`,
        [name, description ?? null, id]
      )
      return NextResponse.json({ success: true, id })
    } else {
      const [result] = await pool.query<any>(
        `INSERT INTO gantt_projects (name, description, owner_id) VALUES (?, ?, ?)`,
        [name, description ?? null, session?.userId ?? null]
      )
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


