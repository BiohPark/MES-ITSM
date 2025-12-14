import { NextRequest, NextResponse } from 'next/server'
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
    // middleware에서 이미 세션 확인 완료, 헤더에서 정보 가져오기
    // 헤더 값이 URL 인코딩되어 있으므로 디코딩
    const encodedRole = request.headers.get('x-user-role') || ''
    const userRole = encodedRole ? decodeURIComponent(encodedRole) : ''
    const userId = request.headers.get('x-user-id') || ''

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const filterUserId = searchParams.get('userId') || undefined

    // 모든 권한에서 모든 피드백을 볼 수 있도록 수정
    // 특정 사용자의 피드백만 조회하려면 userId 파라미터를 전달
    const targetUserId = filterUserId || undefined

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
    // middleware에서 이미 세션 확인 완료, 헤더에서 정보 가져오기
    // 헤더 값이 URL 인코딩되어 있으므로 디코딩
    const encodedRole = request.headers.get('x-user-role') || ''
    const userRole = encodedRole ? decodeURIComponent(encodedRole) : ''
    const userId = request.headers.get('x-user-id') || ''
    const userName = request.headers.get('x-user-name') || ''

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
        userId,
        userName,
        category,
        title,
        content,
        priority || 'Medium'
      )

      return NextResponse.json({ success: true, id })
    }

    if (action === 'update') {
      if (userRole !== 'admin') {
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
      if (userRole !== 'admin') {
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

