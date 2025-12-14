import { NextRequest, NextResponse } from 'next/server'
import { getAttachment } from '@/lib/attachments'
import { verifySession } from '@/lib/auth'
import { promises as fs } from 'fs'

export async function GET(
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
    const attachment = await getAttachment(attachmentId)

    if (!attachment) {
      return NextResponse.json(
        { error: '첨부파일을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 파일 읽기
    const fileBuffer = await fs.readFile(attachment.file_path)

    // 응답 헤더 설정
    const headers = new Headers()
    headers.set('Content-Type', attachment.mime_type || 'application/octet-stream')
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.file_name)}"`)
    headers.set('Content-Length', attachment.file_size.toString())

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error('Error downloading attachment:', error)
    const errorMessage = error instanceof Error ? error.message : '파일 다운로드에 실패했습니다.'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

