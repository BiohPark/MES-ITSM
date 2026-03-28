import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getWorkloadSummary } from '@/lib/workload-summary'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const data = await getWorkloadSummary()
    return NextResponse.json(data)
  } catch (e) {
    console.error('workload summary', e)
    return NextResponse.json({ error: 'Failed to load workload summary' }, { status: 500 })
  }
}
