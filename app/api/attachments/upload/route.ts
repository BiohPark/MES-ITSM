import { NextRequest, NextResponse } from 'next/server'
import { saveFile } from '@/lib/attachments'
import { verifySession } from '@/lib/auth'

export async function POST(request: NextRequest) {
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

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const recordId = formData.get('record_id') as string | null
    const recordType = formData.get('record_type') as string | null || 'task'

    if (!file) {
      return NextResponse.json(
        { error: '파일이 제공되지 않았습니다.' },
        { status: 400 }
      )
    }

    if (!recordId) {
      return NextResponse.json(
        { error: 'record_id가 제공되지 않았습니다.' },
        { status: 400 }
      )
    }

    // 파일을 Buffer로 변환
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 파일 저장
    const { attachmentId } = await saveFile(
      buffer,
      file.name,
      recordId,
      recordType,
      session.userId
    )

    return NextResponse.json({
      success: true,
      attachment_id: attachmentId,
      message: '파일이 성공적으로 업로드되었습니다.',
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    const errorMessage = error instanceof Error ? error.message : '파일 업로드에 실패했습니다.'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

