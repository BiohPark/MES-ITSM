import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { getTicketEscalations, getTicketNotifications, markNotificationRead } from '@/lib/ticket-ops'

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

    return NextResponse.json({
      notifications: await getTicketNotifications(session.name),
      escalations: await getTicketEscalations(),
    })
  } catch (error) {
    console.error('Error fetching ticket notifications:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch notifications' },
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
    if (body.action === 'markRead') {
      await markNotificationRead(body.id)
      return NextResponse.json({ success: true, notifications: await getTicketNotifications(session.name) })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error updating ticket notification:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update notification' },
      { status: 500 }
    )
  }
}
