import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  appendAuditBeforeDelete,
  deleteProjectDefect,
  getProjectDefectById,
  listAuditForDefect,
  updateProjectDefect,
} from '@/lib/project-defects'
import {
  normalizeProjectDefectTestPhase,
  type ProjectDefectSeverity,
  type ProjectDefectStatus,
} from '@/types/project-defect'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await context.params
  const defect = await getProjectDefectById(id)
  if (!defect) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const audit = await listAuditForDefect(id)
  return NextResponse.json({ defect, audit })
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await context.params
  try {
    const body = await request.json()
    const patch: Record<string, unknown> = {}
    if (body.title !== undefined) patch.title = String(body.title).trim()
    if (body.description !== undefined) patch.description = String(body.description)
    if (body.severity !== undefined) patch.severity = body.severity as ProjectDefectSeverity
    if (body.status !== undefined) patch.status = body.status as ProjectDefectStatus
    if (body.test_phase !== undefined) {
      patch.test_phase = normalizeProjectDefectTestPhase(String(body.test_phase))
    }
    if (body.assignee !== undefined) patch.assignee = String(body.assignee)
    if (body.detected_at !== undefined) patch.detected_at = String(body.detected_at)
    if (body.resolved_at !== undefined) patch.resolved_at = String(body.resolved_at)
    if (body.verified_at !== undefined) patch.verified_at = String(body.verified_at)
    if (body.verified_by !== undefined) patch.verified_by = String(body.verified_by)
    if (body.root_cause !== undefined) patch.root_cause = String(body.root_cause)
    if (body.fix_summary !== undefined) patch.fix_summary = String(body.fix_summary)
    if (body.linked_task_id !== undefined) patch.linked_task_id = String(body.linked_task_id)

    await updateProjectDefect(id, patch as any, {
      userId: session.userId,
      name: session.name || session.username || '',
    })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('project-defects PUT', e)
    return NextResponse.json({ error: e?.message || 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const isAdmin = session.role === 'admin' || !!session.isAdmin
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }
  const { id } = await context.params
  try {
    await appendAuditBeforeDelete(id, {
      userId: session.userId,
      name: session.name || session.username || '',
    })
    await deleteProjectDefect(id)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('project-defects DELETE', e)
    return NextResponse.json({ error: e?.message || 'Delete failed' }, { status: 500 })
  }
}
