import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import {
  createBackup,
  getBackups,
  getBackupById,
  restoreFromBackup,
  cleanupOldBackups,
} from '@/lib/backup'

// 백업 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession(request.cookies.get('session')?.value || '')
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    // 10일 초과된 백업 자동 삭제 후 목록 반환
    await cleanupOldBackups(10)
    const backups = await getBackups(limit)
    return NextResponse.json(backups)
  } catch (error) {
    console.error('Backup API error:', error)
    return NextResponse.json(
      { error: '백업 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 백업 생성 및 복구
export async function POST(request: NextRequest) {
  try {
    const session = await verifySession(request.cookies.get('session')?.value || '')
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { action } = body

    if (action === 'create') {
      const filename = await createBackup('manual', session.userId)
      return NextResponse.json({ success: true, filename })
    }

    if (action === 'restore') {
      const { backupId } = body

      if (!backupId) {
        return NextResponse.json({ error: '백업 ID가 필요합니다.' }, { status: 400 })
      }

      await restoreFromBackup(backupId)
      return NextResponse.json({ success: true, message: '데이터베이스가 복구되었습니다.' })
    }

    if (action === 'cleanup') {
      const daysToKeep = parseInt(body.daysToKeep || '10', 10)
      const deletedCount = await cleanupOldBackups(daysToKeep)
      return NextResponse.json({ success: true, deletedCount })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Backup API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '백업 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

