import { NextRequest, NextResponse } from 'next/server'
import { getValPackageTasks } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const valPackageId = params.id
    const tasks = await getValPackageTasks(valPackageId)
    return NextResponse.json(tasks)
  } catch (error) {
    console.error('Error fetching VAL Pkg tasks:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to fetch tasks: ${errorMessage}` },
      { status: 500 }
    )
  }
}


