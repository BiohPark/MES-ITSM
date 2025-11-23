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
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (type === 'project') {
      const nextId = await getNextProjectId()
      return NextResponse.json({ nextId })
    } else if (type === 'task') {
      const nextId = await getNextTaskId()
      return NextResponse.json({ nextId })
    } else if (type === 'orphan-tasks') {
      const orphanTasks = await getOrphanTasks()
      return NextResponse.json(orphanTasks)
    }

    // 기본: 프로젝트 목록 조회
    const projects = await getProjects()
    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error processing GET request:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to fetch projects: ${errorMessage}` },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
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
      const taskId = body.child?.id || await getNextTaskId()
      const newChild: ProjectChild = {
        id: taskId,
        title: body.child?.title,
        owner: body.child?.owner,
        status: body.child?.status || 'Planning',
        due: body.child?.due || '',
        description: body.child?.description || '',
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
  } catch (error) {
    console.error('Error processing request:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to process request: ${errorMessage}` },
      { status: 500 }
    )
  }
}

