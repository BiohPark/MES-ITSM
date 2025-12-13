import { NextRequest, NextResponse } from 'next/server'
import { getAvailableTasksForValPackage } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const tasks = await getAvailableTasksForValPackage()
    return NextResponse.json(tasks)
  } catch (error) {
    console.error('Error fetching available tasks:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to fetch available tasks: ${errorMessage}` },
      { status: 500 }
    )
  }
}


