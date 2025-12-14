import { NextRequest, NextResponse } from 'next/server'
import { getAttachments } from '@/lib/attachments'
import { verifySession } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { recordId: string } }
) {
  try {
    // 세션 확인
    const token = request.cookies.get('session')?.value
    if (!token) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const session = await verifySession(token)
    if (!session) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const recordId = params.recordId
    const { searchParams } = new URL(request.url)
    const recordType = searchParams.get('record_type') || 'task'

    const attachments = await getAttachments(recordId, recordType)

    return NextResponse.json({
      attachments,
    })
  } catch (error) {
    console.error('Error fetching attachments:', error)
    const errorMessage = error instanceof Error ? error.message : '첨부파일 목록 조회에 실패했습니다.'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

