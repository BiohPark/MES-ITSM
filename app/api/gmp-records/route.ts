import { NextRequest, NextResponse } from 'next/server'
import {
  getAllGmpRecords,
  getOrphanGmpRecords,
  addGmpRecord,
  updateGmpRecord,
  deleteGmpRecord,
  getNextGmpRecordId,
} from '@/lib/db'
import type { ProjectChild } from '@/types/project'

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
    return NextResponse.json(records)
  } catch (error) {
    console.error('Error processing GET request:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to fetch GMP records: ${errorMessage}` },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
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
      }

      await addGmpRecord(body.projectId || null, newRecord)
      const records = await getAllGmpRecords()
      return NextResponse.json({ success: true, records })
    } else if (body.action === 'update') {
      // GMP Record 업데이트
      await updateGmpRecord(body.projectId || null, body.child)
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

