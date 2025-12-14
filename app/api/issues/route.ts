import { NextRequest, NextResponse } from 'next/server'
import { getAllIssues, addIssue, updateIssue, deleteIssue, getNextIssueId, getRelatedIssues, getNextGmpRecordId, getNextGmpRecordNumberForKind, addGmpRecord, getAllGmpRecords, updateGmpRecord } from '@/lib/db'
import { getUsers, createUser, getNextUserId } from '@/lib/users'
import type { Issue } from '@/types/issue'
import type { ProjectChild } from '@/types/project'

export async function GET(request: NextRequest) {
  try {
    // middleware에서 이미 세션 확인 완료, 헤더에서 정보 가져오기
    // 헤더 값이 URL 인코딩되어 있으므로 디코딩
    const encodedRole = request.headers.get('x-user-role') || ''
    const userRole = encodedRole ? decodeURIComponent(encodedRole) : ''
    const userId = request.headers.get('x-user-id') || ''

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const issueId = searchParams.get('issueId')

    if (type === 'issue') {
      // 다음 이슈 ID 조회
      const nextId = await getNextIssueId()
      return NextResponse.json({ nextId })
    } else if (type === 'related' && issueId) {
      // 관련 이슈 조회
      const relatedIssues = await getRelatedIssues(issueId)
      return NextResponse.json(relatedIssues)
    }

    // 기본: 모든 이슈 목록 조회
    const issues = await getAllIssues()
    const response = NextResponse.json(issues)
    // 개발 모드에서는 캐싱 비활성화, 프로덕션에서는 짧은 캐시 시간 설정
    if (process.env.NODE_ENV === 'production') {
      response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
    } else {
      response.headers.set('Cache-Control', 'no-store')
    }
    return response
  } catch (error: any) {
    console.error('Error processing GET request:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('Error code:', error.code)
    console.error('Error message:', error.message)
    
    const isConnectionError = 
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'PROTOCOL_CONNECTION_LOST' ||
      error.code === 'ER_ACCESS_DENIED_ERROR' ||
      error.message?.includes('connection')
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    if (isConnectionError) {
      return NextResponse.json(
        { 
          error: '데이터베이스 연결에 실패했습니다. 데이터베이스 서버가 실행 중인지 확인해주세요.',
          code: 'DB_CONNECTION_ERROR',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
          stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
        },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { 
        error: `이슈 조회 실패: ${errorMessage}`,
        code: 'DB_QUERY_ERROR',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
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
    const action = body.action

    if (action === 'add') {
      const issue: Issue = body.issue
      await addIssue(issue)
      
      // Deviation이 체크된 경우 GMP Record 자동 생성
      const isDeviation = issue.is_deviation === true
      console.log('이슈 생성 - is_deviation:', issue.is_deviation, typeof issue.is_deviation, '=>', isDeviation)
      if (isDeviation) {
        try {
          console.log('Deviation 체크됨, GMP Record 생성 시작')
          // 기존 GMP Record 확인 (title과 kind로 매칭)
          const allRecords = await getAllGmpRecords()
          console.log('기존 GMP Records 개수:', allRecords.length)
          const existingRecord = allRecords.find(record => 
            record.title === issue.title && (record as any).kind === 'Deviation'
          )
          
          if (!existingRecord) {
            console.log('기존 GMP Record 없음, 새로 생성')
            // Deviation 매니저(또는 총괄 매니저) 확인/생성
          const users = await getUsers()
            let deviationManager = users.find(
              u => u.role === 'Deviation 매니저' || u.role === '총괄 매니저'
            )
          
            // Deviation 매니저가 없으면 생성
            if (!deviationManager) {
            try {
              const userId = await getNextUserId()
              await createUser({
                id: userId,
                  name: 'Deviation 매니저',
                email: undefined,
                  role: 'Deviation 매니저',
              })
                console.log('Deviation 매니저 사용자 생성 완료')
                deviationManager = { id: userId, name: 'Deviation 매니저', role: 'Deviation 매니저' }
            } catch (error) {
                console.error('Deviation 매니저 사용자 생성 실패:', error)
              // 사용자 생성 실패해도 계속 진행
            }
          }
            
            // GMP Record의 담당자는 항상 Deviation 매니저로 설정
            const ownerName = deviationManager?.name || 'Deviation 매니저'
            console.log('Owner:', ownerName)
          
          // GMP Record 생성
          const gmpRecordId = await getNextGmpRecordId()
            console.log('GMP Record ID:', gmpRecordId)
          const deviationNumber = await getNextGmpRecordNumberForKind('Deviation')
            console.log('Deviation Number:', deviationNumber)
          
          const gmpRecord: ProjectChild = {
            id: gmpRecordId,
            title: issue.title,
            owner: ownerName,
            status: 'Planning',
            progress: 0,
              start: issue.occurred_date || new Date().toISOString().slice(0, 10),
            due: issue.due_date || new Date().toISOString().slice(0, 10),
            description: issue.description || '',
            kind: 'Deviation',
            number: deviationNumber,
          }
          
            console.log('GMP Record 생성 시도:', gmpRecord)
          await addGmpRecord(null, gmpRecord) // 프로젝트는 N/A (null)
            console.log('GMP Record 생성 완료')
          } else {
            console.log('기존 GMP Record 존재:', existingRecord.id)
          }
        } catch (error) {
          console.error('GMP Record 자동 생성 실패:', error)
          console.error('에러 상세:', error instanceof Error ? error.stack : error)
          // GMP Record 생성 실패해도 이슈 저장은 성공한 것으로 처리
        }
      } else {
        console.log('Deviation 체크되지 않음')
      }
      
      const issues = await getAllIssues()
      return NextResponse.json({ success: true, issues })
    } else if (action === 'update') {
      const issue: Issue = body.issue
      await updateIssue(issue)
      
      // Deviation이 체크된 경우 GMP Record 동기화
      if (issue.is_deviation) {
        try {
          const allRecords = await getAllGmpRecords()
          // title과 kind로 매칭하여 기존 GMP Record 찾기
          const existingRecord = allRecords.find(record => 
            record.title === issue.title && (record as any).kind === 'Deviation'
          )
          
          if (existingRecord) {
            // 기존 GMP Record 업데이트 (담당자는 항상 Deviation 매니저 또는 총괄 매니저로 유지)
            const updatedRecord: ProjectChild = {
              ...existingRecord,
              title: issue.title,
              owner: existingRecord.owner || 'Deviation 매니저',
              due: issue.due_date || '',
              description: issue.description || '',
              kind: 'Deviation',
            }
            await updateGmpRecord((existingRecord as any).projectId || null, updatedRecord)
          } else {
            // 새 GMP Record 생성 - Deviation 매니저(또는 총괄 매니저) 확인/생성
            const users = await getUsers()
            let deviationManager = users.find(
              u => u.role === 'Deviation 매니저' || u.role === '총괄 매니저'
            )
            
            // Deviation 매니저가 없으면 생성
            if (!deviationManager) {
              try {
                const userId = await getNextUserId()
                await createUser({
                  id: userId,
                  name: 'Deviation 매니저',
                  email: undefined,
                  role: 'Deviation 매니저',
                })
                deviationManager = { id: userId, name: 'Deviation 매니저', role: 'Deviation 매니저' }
              } catch (error) {
                console.error('Deviation 매니저 사용자 생성 실패:', error)
              }
            }
            
            // GMP Record의 담당자는 항상 Deviation 매니저로 설정
            const ownerName = deviationManager?.name || 'Deviation 매니저'
            
            const gmpRecordId = await getNextGmpRecordId()
            const deviationNumber = await getNextGmpRecordNumberForKind('Deviation')
            
            const gmpRecord: ProjectChild = {
              id: gmpRecordId,
              title: issue.title,
              owner: ownerName,
              status: 'Planning',
              progress: 0,
              start: issue.occurred_date || new Date().toISOString().slice(0, 10),
              due: issue.due_date || new Date().toISOString().slice(0, 10),
              description: issue.description || '',
              kind: 'Deviation',
              number: deviationNumber,
            }
            
            await addGmpRecord(null, gmpRecord)
          }
        } catch (error) {
          console.error('GMP Record 동기화 실패:', error)
          // GMP Record 동기화 실패해도 이슈 업데이트는 성공한 것으로 처리
        }
      }
      
      const issues = await getAllIssues()
      return NextResponse.json({ success: true, issues })
    } else if (action === 'delete') {
      const issueId: string = body.issueId
      await deleteIssue(issueId)
      const issues = await getAllIssues()
      return NextResponse.json({ success: true, issues })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error processing POST request:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to process request: ${errorMessage}` },
      { status: 500 }
    )
  }
}

