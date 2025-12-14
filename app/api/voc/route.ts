import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import {
  createVocFeedback,
  getVocFeedbacks,
  getVocFeedbackById,
  updateVocFeedback,
  deleteVocFeedback,
} from '@/lib/voc'

// VOC 피드백 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession(request.cookies.get('session')?.value || '')
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const userId = searchParams.get('userId') || undefined

    // Admin이 아니면 자신의 피드백만 조회
    const targetUserId = session.role === 'admin' ? userId : session.userId

    const feedbacks = await getVocFeedbacks(status, targetUserId)
    return NextResponse.json(feedbacks)
  } catch (error: any) {
    console.error('VOC API error:', error)
    
    // 테이블이 존재하지 않는 경우 명확한 오류 메시지
    if (error.code === 'ER_NO_SUCH_TABLE' || error.message?.includes("doesn't exist")) {
      return NextResponse.json(
        { 
          error: 'VOC 테이블이 존재하지 않습니다. 다음 명령어를 실행해주세요: npm run add-voc-table',
          code: 'TABLE_NOT_FOUND'
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { 
        error: error.message || 'VOC 피드백 조회 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// VOC 피드백 생성
export async function POST(request: NextRequest) {
  try {
    const session = await verifySession(request.cookies.get('session')?.value || '')
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    if (action === 'create') {
      const { category, title, content, priority } = body

      if (!category || !title || !content) {
        return NextResponse.json(
          { error: '카테고리, 제목, 내용을 모두 입력해주세요.' },
          { status: 400 }
        )
      }

      const id = await createVocFeedback(
        session.userId,
        session.name,
        category,
        title,
        content,
        priority || 'Medium'
      )

      return NextResponse.json({ success: true, id })
    }

    if (action === 'update') {
      if (session.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const { id, status, admin_response, priority } = body

      if (!id) {
        return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
      }

      await updateVocFeedback(id, {
        status,
        admin_response,
        priority,
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      if (session.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const { id } = body

      if (!id) {
        return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
      }

      await deleteVocFeedback(id)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('VOC API error:', error)
    return NextResponse.json(
      { error: 'VOC 피드백 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

