import { NextRequest, NextResponse } from 'next/server'
import {
  getValPackages,
  createValPackage,
  updateValPackage,
  deleteValPackage,
  getNextValPackageId,
} from '@/lib/db'
import type { Project } from '@/types/project'

const toNumber = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value
  }

  const parsed = parseInt(value as string, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

export async function GET(request: NextRequest) {
  try {
    // middleware에서 이미 세션 확인 완료, 헤더에서 정보 가져오기
    // 헤더 값이 URL 인코딩되어 있으므로 디코딩
    const encodedRole = request.headers.get('x-user-role') || ''
    const userRole = encodedRole ? decodeURIComponent(encodedRole) : ''
    const userId = request.headers.get('x-user-id') || ''

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (type === 'val-package') {
      const nextId = await getNextValPackageId()
      return NextResponse.json({ nextId })
    }

    // 기본: VAL Pkg 목록 조회
    const valPackages = await getValPackages()
    const response = NextResponse.json(valPackages)
    // 개발 모드에서는 캐싱 비활성화, 프로덕션에서는 짧은 캐시 시간 설정
    if (process.env.NODE_ENV === 'production') {
      response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
    } else {
      response.headers.set('Cache-Control', 'no-store')
    }
    return response
  } catch (error: any) {
    console.error('Error processing GET request:', error)
    
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
          code: 'DB_CONNECTION_ERROR'
        },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { error: `VAL Pkg 조회 실패: ${errorMessage}` },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // middleware에서 이미 세션 확인 완료, 헤더에서 정보 가져오기
    // 헤더 값이 URL 인코딩되어 있으므로 디코딩
    const encodedRole = request.headers.get('x-user-role') || ''
    const userRole = encodedRole ? decodeURIComponent(encodedRole) : ''
    const userId = request.headers.get('x-user-id') || ''

    const body = await request.json()

    if (body.action === 'add') {
      // 새 VAL Pkg 추가
      const valPackageId = body.id || await getNextValPackageId()
      const newValPackage: Project = {
        id: valPackageId,
        name: body.name,
        owner: body.owner,
        members: toNumber(body.members, 1),
        status: body.status || 'Planning',
        progress: toNumber(body.progress, 0),
        due: body.due,
        children: [],
      }
      await createValPackage(newValPackage)
      const valPackages = await getValPackages()
      return NextResponse.json({ success: true, valPackages })
    } else if (body.action === 'update') {
      // VAL Pkg 업데이트
      const existingValPackages = await getValPackages()
      const existingValPackage = existingValPackages.find((p) => p.id === body.id)

      if (!existingValPackage) {
        return NextResponse.json(
          { error: 'VAL Pkg not found' },
          { status: 404 }
        )
      }

      const data = body.data || body
      const updatedValPackage: Project = {
        ...existingValPackage,
        ...data,
        id: body.id, // ID는 변경 불가
        members:
          data.members !== undefined
            ? toNumber(data.members, existingValPackage.members)
            : existingValPackage.members,
        progress:
          data.progress !== undefined
            ? toNumber(data.progress, existingValPackage.progress)
            : existingValPackage.progress,
        start: data.start !== undefined ? data.start : existingValPackage.start,
        children: [],
      }

      await updateValPackage(updatedValPackage)
      const valPackages = await getValPackages()
      return NextResponse.json({ success: true, valPackages })
    } else if (body.action === 'delete') {
      // VAL Pkg 삭제
      await deleteValPackage(body.id)
      const valPackages = await getValPackages()
      return NextResponse.json({ success: true, valPackages })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error processing request:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to process request: ${errorMessage}` },
      { status: 500 }
    )
  }
}


