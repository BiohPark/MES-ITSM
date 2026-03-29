import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getPool } from '@/lib/db'
import {
  getNextProjectDefectId,
  insertProjectDefect,
  listProjectDefects,
} from '@/lib/project-defects'
import type { ProjectDefectSeverity, ProjectDefectStatus, ProjectDefectTestPhase } from '@/types/project-defect'

async function projectExists(projectId: string): Promise<boolean> {
  const pool = getPool()
  const [rows] = await pool.query<any[]>('SELECT id FROM projects WHERE id = ? LIMIT 1', [projectId])
  return Array.isArray(rows) && rows.length > 0
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  if (searchParams.get('nextId') === '1') {
    const nextId = await getNextProjectDefectId()
    return NextResponse.json({ nextId })
  }
  const projectId = searchParams.get('projectId') || undefined
  const status = searchParams.get('status') || undefined
  const severity = searchParams.get('severity') || undefined
  const rows = await listProjectDefects({ projectId, status, severity })
  return NextResponse.json({ defects: rows })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const project_id = String(body.project_id || '').trim()
    const title = String(body.title || '').trim()
    if (!project_id || !title) {
      return NextResponse.json({ error: 'project_id and title are required' }, { status: 400 })
    }
    if (!(await projectExists(project_id))) {
      return NextResponse.json({ error: 'Project not found' }, { status: 400 })
    }
    const detected_at = String(body.detected_at || '').trim()
    if (!detected_at) {
      return NextResponse.json({ error: 'detected_at is required' }, { status: 400 })
    }
    const id = await insertProjectDefect(
      {
        project_id,
        title,
        description: String(body.description || ''),
        severity: (body.severity as ProjectDefectSeverity) || 'Major',
        status: (body.status as ProjectDefectStatus) || 'Open',
        test_phase: (body.test_phase as ProjectDefectTestPhase) || 'Other',
        reporter_user_id: session.userId,
        reporter_name: session.name || session.username || '',
        assignee: String(body.assignee || ''),
        detected_at,
        resolved_at: String(body.resolved_at || '').trim(),
        verified_at: String(body.verified_at || '').trim(),
        verified_by: String(body.verified_by || ''),
        root_cause: String(body.root_cause || ''),
        fix_summary: String(body.fix_summary || ''),
        linked_task_id: String(body.linked_task_id || ''),
      },
      { userId: session.userId, name: session.name || session.username || '' }
    )
    return NextResponse.json({ id })
  } catch (e: any) {
    console.error('project-defects POST', e)
    return NextResponse.json({ error: e?.message || 'Failed to create defect' }, { status: 500 })
  }
}
