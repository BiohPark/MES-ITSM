import { NextRequest, NextResponse } from 'next/server'
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  addChildToProject,
  updateChild,
  deleteChild,
  getNextProjectId,
  getNextTaskId,
  getOrphanTasks,
  getPool,
} from '@/lib/db'
import type { Project, ProjectChild } from '@/types/project'

const toNumber = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value
  }

  const parsed = parseInt(value as string, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

export async function GET(request: NextRequest) {
  console.log('[PROJECTS API] GET 요청 시작')
  try {
    // middleware에서 이미 세션 확인 완료, 헤더에서 정보 가져오기
    // 헤더 값이 URL 인코딩되어 있으므로 디코딩
    const encodedRole = request.headers.get('x-user-role') || ''
    const userRole = encodedRole ? decodeURIComponent(encodedRole) : ''
    const userId = request.headers.get('x-user-id') || ''
    
    console.log('[PROJECTS API] 요청 헤더:', { userRole, userId })
    console.log('[PROJECTS API] 모든 헤더:', Object.fromEntries(request.headers.entries()))

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const taskId = searchParams.get('taskId')
    console.log('[PROJECTS API] 쿼리 파라미터:', { type, taskId })

    if (type === 'project') {
      const nextId = await getNextProjectId()
      return NextResponse.json({ nextId })
    } else if (type === 'task') {
      const nextId = await getNextTaskId()
      return NextResponse.json({ nextId })
    } else if (type === 'orphan-tasks') {
      const orphanTasks = await getOrphanTasks()
      return NextResponse.json(orphanTasks)
    } else if (taskId) {
      // 특정 일감 조회 (Link 상태 확인용)
      const pool = getPool()
      const [tasks] = await pool.query<any[]>(
        'SELECT * FROM project_children WHERE id = ?',
        [taskId]
      )
      if (tasks.length > 0) {
        return NextResponse.json(tasks[0])
      }
      return NextResponse.json(null, { status: 404 })
    }

    // 기본: 프로젝트 목록 조회
    console.log('[PROJECTS API] getProjects 호출 시작')
    const projects = await getProjects()
    console.log('[PROJECTS API] getProjects 완료, 프로젝트 수:', projects.length)
    const response = NextResponse.json(projects)
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
    
    // 데이터베이스 연결 오류인지 확인
    const isConnectionError = 
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'PROTOCOL_CONNECTION_LOST' ||
      error.code === 'ER_ACCESS_DENIED_ERROR' ||
      error.message?.includes('connection') ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('ETIMEDOUT')
    
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
        { status: 503 } // Service Unavailable
      )
    }
    
    return NextResponse.json(
      { 
        error: `프로젝트 조회 실패: ${errorMessage}`,
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

    if (body.action === 'add') {
      // 새 프로젝트 추가
      const projectId = body.id || await getNextProjectId()
      const newProject: Project = {
        id: projectId,
        name: body.name,
        owner: body.owner,
        members: toNumber(body.members, 1),
        status: body.status || 'Planning',
        progress: toNumber(body.progress, 0),
        due: body.due,
        children: body.children ?? [],
      }
      await createProject(newProject)
      const projects = await getProjects()
      return NextResponse.json({ success: true, projects })
    } else if (body.action === 'update') {
      // 프로젝트 업데이트
      const existingProjects = await getProjects()
      const existingProject = existingProjects.find((p) => p.id === body.id)

      if (!existingProject) {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        )
      }

      const data = body.data || body
      const updatedProject: Project = {
        ...existingProject,
        ...data,
        id: body.id, // ID는 변경 불가
        members:
          data.members !== undefined
            ? toNumber(data.members, existingProject.members)
            : existingProject.members,
        progress:
          data.progress !== undefined
            ? toNumber(data.progress, existingProject.progress)
            : existingProject.progress,
        start: data.start !== undefined ? data.start : existingProject.start,
        children: data.children ?? existingProject.children ?? [],
      }

      await updateProject(updatedProject)
      const projects = await getProjects()
      return NextResponse.json({ success: true, projects })
    } else if (body.action === 'delete') {
      // 프로젝트 삭제
      await deleteProject(body.id)
      const projects = await getProjects()
      return NextResponse.json({ success: true, projects })
    } else if (body.action === 'addChild') {
      // 하위 아이템 추가
      // 클라이언트에서 넘어온 ID가 있어도 무시하고, 항상 서버에서 다음 ID를 생성해 중복을 방지한다.
      const taskId = await getNextTaskId()
      const newChild: ProjectChild = {
        id: taskId,
        title: body.child?.title,
        owner: body.child?.owner,
        status: body.child?.status || 'Planning',
        progress: body.child?.progress ?? 0,
        start: body.child?.start ?? null,
        due: body.child?.due || '',
        description: body.child?.description || '',
        phases: body.child?.phases,
      }

      await addChildToProject(body.projectId, newChild)
      const projects = await getProjects()
      return NextResponse.json({ success: true, projects })
    } else if (body.action === 'updateChild') {
      // 하위 아이템 업데이트
      await updateChild(body.projectId, body.child)
      const projects = await getProjects()
      return NextResponse.json({ success: true, projects })
    } else if (body.action === 'deleteChild') {
      // 하위 아이템 삭제
      try {
        await deleteChild(body.projectId ?? null, body.childId)
        const projects = await getProjects()
        return NextResponse.json({ success: true, projects })
      } catch (error) {
        console.error('Error deleting child:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
          { error: `하위 아이템 삭제 실패: ${errorMessage}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Error processing POST request:', error)
    
    // 데이터베이스 연결 오류인지 확인
    const isConnectionError = 
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'PROTOCOL_CONNECTION_LOST' ||
      error.code === 'ER_ACCESS_DENIED_ERROR' ||
      error.message?.includes('connection') ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('ETIMEDOUT')
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    if (isConnectionError) {
      return NextResponse.json(
        { 
          error: '데이터베이스 연결에 실패했습니다. 데이터베이스 서버가 실행 중인지 확인해주세요.',
          code: 'DB_CONNECTION_ERROR',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
        },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { 
        error: `요청 처리 실패: ${errorMessage}`,
        code: 'DB_QUERY_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

