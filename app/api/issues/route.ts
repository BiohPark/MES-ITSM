import { NextRequest, NextResponse } from 'next/server'
import { getAllIssues, addIssue, updateIssue, deleteIssue, getNextIssueId, getRelatedIssues, getNextGmpRecordId, getNextGmpRecordNumberForKind, addGmpRecord, getAllGmpRecords, updateGmpRecord } from '@/lib/db'
import { getUsers, createUser, getNextUserId } from '@/lib/users'
import type { Issue } from '@/types/issue'
import type { ProjectChild } from '@/types/project'

export async function GET(request: NextRequest) {
  try {
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
    return NextResponse.json(issues)
  } catch (error) {
    console.error('Error processing GET request:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to fetch issues: ${errorMessage}` },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const action = body.action

    if (action === 'add') {
      const issue: Issue = body.issue
      await addIssue(issue)
      
      // Deviation이 체크된 경우 GMP Record 자동 생성
      console.log('이슈 생성 - is_deviation:', issue.is_deviation, typeof issue.is_deviation)
      if (issue.is_deviation === true || issue.is_deviation === 1 || issue.is_deviation === 'true') {
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
            // Dev매니저 사용자 확인 및 생성
            const users = await getUsers()
            let devManager = users.find(u => u.name === 'Dev매니저') || users.find(u => u.name === 'DevManager')
            
            // Dev매니저가 없으면 생성
            if (!devManager) {
              try {
                const userId = await getNextUserId()
                await createUser({
                  id: userId,
                  name: 'Dev매니저',
                  email: undefined,
                })
                console.log('Dev매니저 사용자 생성 완료')
                devManager = { name: 'Dev매니저' }
              } catch (error) {
                console.error('Dev매니저 사용자 생성 실패:', error)
                // 사용자 생성 실패해도 계속 진행
              }
            }
            
            // GMP Record의 담당자는 항상 Dev매니저로 설정
            const ownerName = 'Dev매니저'
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
            // 기존 GMP Record 업데이트 (담당자는 항상 Dev매니저로 유지)
            const updatedRecord: ProjectChild = {
              ...existingRecord,
              title: issue.title,
              owner: 'Dev매니저', // 항상 Dev매니저로 설정
              due: issue.due_date || '',
              description: issue.description || '',
              kind: 'Deviation',
            }
            await updateGmpRecord((existingRecord as any).projectId || null, updatedRecord)
          } else {
            // 새 GMP Record 생성
            const users = await getUsers()
            let devManager = users.find(u => u.name === 'Dev매니저') || users.find(u => u.name === 'DevManager')
            
            // Dev매니저가 없으면 생성
            if (!devManager) {
              try {
                const userId = await getNextUserId()
                await createUser({
                  id: userId,
                  name: 'Dev매니저',
                  email: undefined,
                })
                devManager = { name: 'Dev매니저' }
              } catch (error) {
                console.error('Dev매니저 사용자 생성 실패:', error)
              }
            }
            
            // GMP Record의 담당자는 항상 Dev매니저로 설정
            const ownerName = 'Dev매니저'
            
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

