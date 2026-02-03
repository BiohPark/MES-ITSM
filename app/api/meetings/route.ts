import { NextRequest, NextResponse } from 'next/server'
import { getAllMeetingNotes, addMeetingNote, updateMeetingNote, deleteMeetingNote, searchMeetingNotes, getNextMeetingNoteId, getMeetingNoteById } from '@/lib/db'
import type { MeetingNote } from '@/types/meeting'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const keyword = searchParams.get('keyword')
    const type = searchParams.get('type')

    if (type === 'nextId') {
      // 다음 회의록 ID 조회
      const nextId = await getNextMeetingNoteId()
      return NextResponse.json({ nextId })
    }

    if (keyword) {
      // 검색
      const results = await searchMeetingNotes(keyword)
      return NextResponse.json(results)
    }

    // 기본: 모든 회의록 목록 조회
    const meetingNotes = await getAllMeetingNotes()
    const response = NextResponse.json(meetingNotes)
    if (process.env.NODE_ENV === 'production') {
      response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
    } else {
      response.headers.set('Cache-Control', 'no-store')
    }
    return response
  } catch (error: any) {
    const isConnectionError = 
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'PROTOCOL_CONNECTION_LOST' ||
      error.code === 'ER_ACCESS_DENIED_ERROR' ||
      error.message?.includes('connection')
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    if (isConnectionError) {
      return NextResponse.json(
        { 
          error: '데이터베이스 연결에 실패했습니다. 데이터베이스 서버가 실행 중인지 확인해주세요.',
          code: 'DB_CONNECTION_ERROR',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { 
        error: `회의록 조회 실패: ${errorMessage}`,
        code: 'DB_QUERY_ERROR',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || ''
    const body = await request.json()
    const action = body.action

    if (action === 'add') {
      const meetingNote: MeetingNote = body.meetingNote
      await addMeetingNote(meetingNote)
      return NextResponse.json({ success: true })
    } else if (action === 'update') {
      const meetingNote: MeetingNote = body.meetingNote
      await updateMeetingNote(meetingNote)
      return NextResponse.json({ success: true })
    } else if (action === 'delete') {
      const id = body.id
      if (!id) {
        return NextResponse.json({ error: '회의록 ID가 필요합니다.' }, { status: 400 })
      }
      await deleteMeetingNote(id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: '잘못된 액션입니다.' }, { status: 400 })
  } catch (error: any) {
    console.error('[meetings][POST] 오류:', error)
    return NextResponse.json(
      { error: '회의록 처리 실패', details: error.message },
      { status: 500 }
    )
  }
}


