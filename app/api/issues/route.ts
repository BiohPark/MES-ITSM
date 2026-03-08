import { NextRequest, NextResponse } from 'next/server'
import { getAllIssues, addIssue, updateIssue, deleteIssue, getNextIssueId, getRelatedIssues, getNextGmpRecordId, getNextGmpRecordNumberForKind, addGmpRecord, getAllGmpRecords, updateGmpRecord, clearTaskLinksByIssueId, setTaskLinkedIssueId } from '@/lib/db'
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
      // 신규 이슈 담당자 미지정 시 그룹 매니저를 1차 담당자로 설정
      if (!issue.owner || String(issue.owner).trim() === '') {
        const users = await getUsers()
        const groupManager = users.find(u => u.role === '그룹 매니저')
        issue.owner = groupManager?.name ?? '그룹 매니저'
      }
      await addIssue(issue)

      // 이슈 ↔ 일감 링크: 연결 일감이 있으면 해당 일감에 linked_issue_id 설정
      if (issue.linked_task_id) {
        await setTaskLinkedIssueId(issue.linked_task_id, issue.id)
      }
      
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
            // 그룹 매니저 확인/생성 (이슈·일감 담당은 그룹 매니저에서 시작)
          const users = await getUsers()
            let groupManager = users.find(u => u.role === '그룹 매니저')
          
            if (!groupManager) {
            try {
              const userId = await getNextUserId()
              await createUser({
                id: userId,
                  name: '그룹 매니저',
                email: undefined,
                  role: '그룹 매니저',
              })
                groupManager = { id: userId, name: '그룹 매니저', role: '그룹 매니저' }
            } catch (error) {
              // 사용자 생성 실패해도 계속 진행
            }
          }
            
            const ownerName = groupManager?.name || '그룹 매니저'
          
          // GMP Record 생성
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
            ...(issue.id ? { linked_issue_id: issue.id } : {}),
          } as ProjectChild & { linked_issue_id?: string }
          
          await addGmpRecord(null, gmpRecord) // 프로젝트는 N/A (null)
          await updateIssue({ ...issue, linked_gmp_record_id: gmpRecordId })
          }
        } catch (error) {
          // GMP Record 생성 실패해도 이슈 저장은 성공한 것으로 처리
        }
      }
      
      const issues = await getAllIssues()
      return NextResponse.json({ success: true, issues })
    } else if (action === 'update') {
      const issue: Issue = body.issue
      await updateIssue(issue)

      // 이슈 ↔ 일감 링크 반영: 기존 연결 해제 후 새 linked_task_id에 연결
      await clearTaskLinksByIssueId(issue.id)
      if (issue.linked_task_id) {
        await setTaskLinkedIssueId(issue.linked_task_id, issue.id)
      }
      
      // Deviation이 체크된 경우 GMP Record 동기화
      if (issue.is_deviation) {
        try {
          const allRecords = await getAllGmpRecords()
          // title과 kind로 매칭하여 기존 GMP Record 찾기
          const existingRecord = allRecords.find(record => 
            record.title === issue.title && (record as any).kind === 'Deviation'
          )
          
          if (existingRecord) {
            // 기존 GMP Record 업데이트 (이슈 링크 유지)
            const updatedRecord: ProjectChild & { linked_issue_id?: string } = {
              ...existingRecord,
              title: issue.title,
              owner: existingRecord.owner || '그룹 매니저',
              due: issue.due_date || '',
              description: issue.description || '',
              kind: 'Deviation',
              linked_issue_id: issue.id,
            }
            await updateGmpRecord((existingRecord as any).projectId || null, updatedRecord)
            await updateIssue({ ...issue, linked_gmp_record_id: existingRecord.id })
          } else {
            // 새 GMP Record 생성 - 그룹 매니저 확인/생성
            const users = await getUsers()
            let groupManager = users.find(u => u.role === '그룹 매니저')
            
            if (!groupManager) {
              try {
                const userId = await getNextUserId()
                await createUser({
                  id: userId,
                  name: '그룹 매니저',
                  email: undefined,
                  role: '그룹 매니저',
                })
                groupManager = { id: userId, name: '그룹 매니저', role: '그룹 매니저' }
              } catch (error) {
              }
            }
            
            const ownerName = groupManager?.name || '그룹 매니저'
            
            const gmpRecordId = await getNextGmpRecordId()
            const deviationNumber = await getNextGmpRecordNumberForKind('Deviation')
            
            const gmpRecord: ProjectChild & { linked_issue_id?: string } = {
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
              linked_issue_id: issue.id,
            }
            
            await addGmpRecord(null, gmpRecord)
            await updateIssue({ ...issue, linked_gmp_record_id: gmpRecordId })
          }
        } catch (error) {
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to process request: ${errorMessage}` },
      { status: 500 }
    )
  }
}

