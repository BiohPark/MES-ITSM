import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getPool } from '@/lib/db'
import {
  auditTrailToCsv,
  listProjectDefectAuditForExport,
} from '@/lib/project-defects'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId') || undefined
  const status = searchParams.get('status') || undefined
  const severity = searchParams.get('severity') || undefined
  const rows = await listProjectDefectAuditForExport({ projectId, status, severity })

  const pool = getPool()
  const [prows] = await pool.query<any[]>(`SELECT id, name FROM projects`)
  const projectNames = new Map<string, string>()
  for (const r of prows || []) {
    projectNames.set(String(r.id), String(r.name ?? ''))
  }

  const csv = auditTrailToCsv(rows, projectNames)
  const bom = '\uFEFF'
  const filename = `project-defect-audit-${new Date().toISOString().slice(0, 10)}.csv`
  return new NextResponse(bom + csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
