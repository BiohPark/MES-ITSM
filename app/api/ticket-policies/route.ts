import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import {
  deletePriorityPolicy,
  deleteSlaPolicy,
  getPriorityPolicies,
  getSlaPolicies,
  savePriorityPolicy,
  saveSlaPolicy,
} from '@/lib/ticket-ops'
import type { PriorityPolicy, SlaPolicy } from '@/types/ticket'

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
      priorityPolicies: await getPriorityPolicies(),
      slaPolicies: await getSlaPolicies(),
    })
  } catch (error) {
    console.error('Error fetching ticket policies:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch policies' },
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
    if (session.role !== 'admin' && !session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    if (body.action === 'savePriority') {
      await savePriorityPolicy(body.policy as PriorityPolicy)
    } else if (body.action === 'saveSla') {
      await saveSlaPolicy(body.policy as SlaPolicy)
    } else if (body.action === 'deletePriority') {
      await deletePriorityPolicy(body.id)
    } else if (body.action === 'deleteSla') {
      await deleteSlaPolicy(body.id)
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      priorityPolicies: await getPriorityPolicies(),
      slaPolicies: await getSlaPolicies(),
    })
  } catch (error) {
    console.error('Error updating ticket policies:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update policies' },
      { status: 500 }
    )
  }
}
