import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { getTicketAuditLogs } from '@/lib/ticket-ops'

async function getSessionOrReject(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return verifySession(token)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrReject(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ticketId = searchParams.get('ticketId')
    return NextResponse.json({ auditLogs: await getTicketAuditLogs(ticketId || undefined) })
  } catch (error) {
    console.error('Error fetching ticket audit logs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}
