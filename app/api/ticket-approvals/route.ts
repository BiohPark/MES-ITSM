import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { actOnTicketApproval, getTicketApprovals, requestTicketApproval } from '@/lib/ticket-ops'

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
    const scope = searchParams.get('scope')
    const approvals = await getTicketApprovals(ticketId || undefined, scope === 'mine' ? session.name : undefined)
    return NextResponse.json({ approvals })
  } catch (error) {
    console.error('Error fetching ticket approvals:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch approvals' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrReject(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    if (body.action === 'request') {
      await requestTicketApproval(body.ticketId, body.approverName, session.name)
      return NextResponse.json({ success: true, approvals: await getTicketApprovals(body.ticketId) })
    }

    if (body.action === 'approve' || body.action === 'reject') {
      await actOnTicketApproval(body.ticketId, session.name, body.action, body.comments)
      return NextResponse.json({ success: true, approvals: await getTicketApprovals(body.ticketId) })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error processing ticket approval:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process approval' },
      { status: 500 }
    )
  }
}
