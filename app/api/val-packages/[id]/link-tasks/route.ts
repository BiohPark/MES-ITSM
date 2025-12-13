import { NextRequest, NextResponse } from 'next/server'
import { linkTasksToValPackage } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const valPackageId = params.id
    const body = await request.json()
    const { taskIds } = body

    if (!Array.isArray(taskIds)) {
      return NextResponse.json(
        { error: 'taskIds must be an array' },
        { status: 400 }
      )
    }

    await linkTasksToValPackage(valPackageId, taskIds)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error linking tasks:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to link tasks: ${errorMessage}` },
      { status: 500 }
    )
  }
}


