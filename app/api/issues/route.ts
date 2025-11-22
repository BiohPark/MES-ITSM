import { NextRequest, NextResponse } from 'next/server'
import { getAllIssues, addIssue, updateIssue, deleteIssue, getNextIssueId, getRelatedIssues, getNextGmpRecordId, getNextGmpRecordNumberForKind, addGmpRecord } from '@/lib/db'
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
      if (issue.is_deviation) {
        try {
          // Dev매니저 사용자 확인
          const users = await getUsers()
          const devManager = users.find(u => u.name === 'Dev매니저') || users.find(u => u.name === 'DevManager') || users[0]
          const ownerName = devManager ? devManager.name : 'Dev매니저'
          
          // Dev매니저가 없으면 생성
          if (!devManager) {
            try {
              const userId = await getNextUserId()
              await createUser({
                id: userId,
                name: 'Dev매니저',
                email: undefined,
              })
            } catch (error) {
              console.error('Dev매니저 사용자 생성 실패:', error)
              // 사용자 생성 실패해도 계속 진행
            }
          }
          
          // GMP Record 생성
          const gmpRecordId = await getNextGmpRecordId()
          const deviationNumber = await getNextGmpRecordNumberForKind('Deviation')
          
          const gmpRecord: ProjectChild = {
            id: gmpRecordId,
            title: issue.title,
            owner: ownerName,
            status: 'Planning',
            progress: 0,
            due: issue.due_date || new Date().toISOString().slice(0, 10),
            description: issue.description || '',
            kind: 'Deviation',
            number: deviationNumber,
          }
          
          await addGmpRecord(null, gmpRecord) // 프로젝트는 N/A (null)
        } catch (error) {
          console.error('GMP Record 자동 생성 실패:', error)
          // GMP Record 생성 실패해도 이슈 저장은 성공한 것으로 처리
        }
      }
      
      const issues = await getAllIssues()
      return NextResponse.json({ success: true, issues })
    } else if (action === 'update') {
      const issue: Issue = body.issue
      await updateIssue(issue)
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

