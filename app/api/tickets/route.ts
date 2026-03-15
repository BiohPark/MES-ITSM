import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import {
  addTicketLink,
  createTicket,
  deleteTicket,
  deleteTicketLink,
  getNextTicketId,
  getTicketDetail,
  getTickets,
  updateTicket,
} from '@/lib/tickets'
import type { Ticket, TicketType } from '@/types/ticket'

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
    const type = searchParams.get('type')
    const ticketType = searchParams.get('ticketType') as TicketType | null
    const id = searchParams.get('id')

    if (type === 'nextId') {
      if (!ticketType) {
        return NextResponse.json({ error: 'ticketType is required' }, { status: 400 })
      }
      const nextId = await getNextTicketId(ticketType)
      return NextResponse.json({ nextId })
    }

    if (type === 'detail' && id) {
      const ticket = await getTicketDetail(id)
      return NextResponse.json({ ticket })
    }

    const tickets = await getTickets(ticketType || undefined)
    return NextResponse.json({ tickets })
  } catch (error) {
    console.error('Error handling ticket GET:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tickets' },
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
    const action = body.action

    if (action === 'add') {
      const ticket = body.ticket as Ticket
      await createTicket({
        ...ticket,
        created_by: session.name,
        updated_by: session.name,
      })
      return NextResponse.json({ success: true, tickets: await getTickets(ticket.ticket_type) })
    }

    if (action === 'update') {
      const ticket = body.ticket as Ticket
      await updateTicket({
        ...ticket,
        updated_by: session.name,
      })
      return NextResponse.json({ success: true, tickets: await getTickets(ticket.ticket_type) })
    }

    if (action === 'delete') {
      await deleteTicket(body.ticketId, session.name)
      return NextResponse.json({ success: true })
    }

    if (action === 'link-add') {
      await addTicketLink(body.ticketId, body.link, session.name)
      return NextResponse.json({ success: true, ticket: await getTicketDetail(body.ticketId) })
    }

    if (action === 'link-delete') {
      await deleteTicketLink(body.linkId, session.name)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error handling ticket POST:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process ticket request' },
      { status: 500 }
    )
  }
}
