import { NextRequest, NextResponse } from 'next/server'
import { getAllActionItems, getActionItemsByAssignee, updateActionItemStatus } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const assignee = searchParams.get('assignee')

    if (assignee) {
      // 특정 담당자의 액션 아이템 조회
      const actionItems = await getActionItemsByAssignee(assignee)
      return NextResponse.json(actionItems)
    }

    // 모든 액션 아이템 조회
    const actionItems = await getAllActionItems()
    const response = NextResponse.json(actionItems)
    if (process.env.NODE_ENV === 'production') {
      response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
    } else {
      response.headers.set('Cache-Control', 'no-store')
    }
    return response
  } catch (error: any) {
    console.error('[action-items][GET] 오류:', error)
    return NextResponse.json(
      { error: '액션 아이템 조회 실패', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, meetingNoteId, actionItemId, status } = body

    if (action === 'updateStatus') {
      if (!meetingNoteId || !actionItemId || !status) {
        return NextResponse.json(
          { error: 'meetingNoteId, actionItemId, status가 필요합니다.' },
          { status: 400 }
        )
      }

      await updateActionItemStatus(meetingNoteId, actionItemId, status)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: '잘못된 액션입니다.' }, { status: 400 })
  } catch (error: any) {
    console.error('[action-items][POST] 오류:', error)
    return NextResponse.json(
      { error: '액션 아이템 처리 실패', details: error.message },
      { status: 500 }
    )
  }
}

