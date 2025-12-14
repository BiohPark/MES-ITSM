import { NextRequest, NextResponse } from 'next/server'
import {
  getAllGmpRecords,
  getOrphanGmpRecords,
  addGmpRecord,
  updateGmpRecord,
  deleteGmpRecord,
  getNextGmpRecordId,
  getAllIssues,
  addIssue,
  updateIssue,
  getNextIssueId,
} from '@/lib/db'
import type { ProjectChild } from '@/types/project'
import type { Issue } from '@/types/issue'

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

    if (type === 'record') {
      // 다음 GMP Record ID 조회
      const nextId = await getNextGmpRecordId()
      return NextResponse.json({ nextId })
    } else if (type === 'orphan-records') {
      // 프로젝트 없는 GMP Record 조회
      const orphanRecords = await getOrphanGmpRecords()
      return NextResponse.json(orphanRecords)
    }

    // 기본: 모든 GMP Record 목록 조회
    const records = await getAllGmpRecords()
    const response = NextResponse.json(records)
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
      { error: `GMP Record 조회 실패: ${errorMessage}` },
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
      // 새 GMP Record 추가
      const recordId = body.child?.id || await getNextGmpRecordId()
      const newRecord: any = {
        id: recordId,
        title: body.child?.title,
        owner: body.child?.owner,
        status: body.child?.status || 'Planning',
        due: body.child?.due || '',
        description: body.child?.description || '',
        progress: body.child?.progress || 0,
        start: body.child?.start || '',
        kind: body.child?.kind || 'CC',
        number: body.child?.number || 0,
        phases: body.child?.phases,
      }

      await addGmpRecord(body.projectId || null, newRecord)
      
      // Deviation인 경우 이슈 자동 생성
      if (newRecord.kind === 'Deviation') {
        try {
          // 기존 이슈 확인 (title로 매칭)
          const allIssues = await getAllIssues()
          const existingIssue = allIssues.find(issue => 
            issue.title === newRecord.title && issue.is_deviation
          )
          
          if (!existingIssue) {
            // 새 이슈 생성
            const issueId = await getNextIssueId()
            const issue: Issue = {
              id: issueId,
              title: newRecord.title,
              description: newRecord.description || '',
              status: 'Open',
              owner: newRecord.owner,
              occurred_date: newRecord.start || new Date().toISOString().slice(0, 10),
              due_date: newRecord.due || undefined,
              is_deviation: true,
            }
            await addIssue(issue)
          }
        } catch (error) {
          console.error('이슈 자동 생성 실패:', error)
          // 이슈 생성 실패해도 GMP Record 저장은 성공한 것으로 처리
        }
      }
      
      const records = await getAllGmpRecords()
      return NextResponse.json({ success: true, records })
    } else if (body.action === 'update') {
      // GMP Record 업데이트
      const updatedRecord = body.child as any
      await updateGmpRecord(body.projectId || null, body.child)
      
      // Deviation인 경우 이슈 동기화
      if (updatedRecord.kind === 'Deviation') {
        try {
          const allIssues = await getAllIssues()
          // title로 매칭하여 기존 이슈 찾기
          const existingIssue = allIssues.find(issue => 
            issue.title === updatedRecord.title && issue.is_deviation
          )
          
          if (existingIssue) {
            // 기존 이슈 업데이트
            const updatedIssue: Issue = {
              ...existingIssue,
              title: updatedRecord.title,
              description: updatedRecord.description || '',
              owner: updatedRecord.owner,
              due_date: updatedRecord.due || undefined,
              is_deviation: true,
            }
            await updateIssue(updatedIssue)
          } else {
            // 새 이슈 생성
            const issueId = await getNextIssueId()
            const issue: Issue = {
              id: issueId,
              title: updatedRecord.title,
              description: updatedRecord.description || '',
              status: 'Open',
              owner: updatedRecord.owner,
              occurred_date: updatedRecord.start || new Date().toISOString().slice(0, 10),
              due_date: updatedRecord.due || undefined,
              is_deviation: true,
            }
            await addIssue(issue)
          }
        } catch (error) {
          console.error('이슈 동기화 실패:', error)
          // 이슈 동기화 실패해도 GMP Record 업데이트는 성공한 것으로 처리
        }
      }
      
      const records = await getAllGmpRecords()
      return NextResponse.json({ success: true, records })
    } else if (body.action === 'delete') {
      // GMP Record 삭제
      try {
        await deleteGmpRecord(body.projectId ?? null, body.childId)
        const records = await getAllGmpRecords()
        return NextResponse.json({ success: true, records })
      } catch (error) {
        console.error('Error deleting GMP record:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
          { error: `GMP Record 삭제 실패: ${errorMessage}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error processing request:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

