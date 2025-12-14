import { NextRequest, NextResponse } from 'next/server'
import { deleteAttachment } from '@/lib/attachments'
import { verifySession } from '@/lib/auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { attachmentId: string } }
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

    const attachmentId = params.attachmentId

    await deleteAttachment(attachmentId, session.userId)

    return NextResponse.json({
      success: true,
      message: '첨부파일이 성공적으로 삭제되었습니다.',
    })
  } catch (error) {
    console.error('Error deleting attachment:', error)
    const errorMessage = error instanceof Error ? error.message : '첨부파일 삭제에 실패했습니다.'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

