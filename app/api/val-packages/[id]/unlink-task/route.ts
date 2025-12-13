import { NextRequest, NextResponse } from 'next/server'
import { unlinkTaskFromValPackage } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const valPackageId = params.id
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      )
    }

    await unlinkTaskFromValPackage(valPackageId, taskId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error unlinking task:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to unlink task: ${errorMessage}` },
      { status: 500 }
    )
  }
}


