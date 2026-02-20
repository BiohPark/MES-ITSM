import { NextRequest, NextResponse } from 'next/server'
import { searchAll } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const keyword = searchParams.get('keyword')

    if (!keyword || keyword.trim() === '') {
      return NextResponse.json({
        projects: [],
        tasks: [],
        gmpRecords: [],
        ganttTasks: [],
      })
    }

    const results = await searchAll(keyword.trim())
    return NextResponse.json(results)
  } catch (error) {
    console.error('Error processing search request:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `검색 실패: ${errorMessage}` },
      { status: 500 }
    )
  }
}

