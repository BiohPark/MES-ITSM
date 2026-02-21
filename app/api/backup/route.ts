import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import {
  createBackup,
  getBackups,
  getBackupById,
  restoreFromBackup,
  cleanupOldBackups,
} from '@/lib/backup'
import { getSystemSettingNumber } from '@/lib/settings'

// 백업 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession(request.cookies.get('session')?.value || '')
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam != null && limitParam !== ''
      ? parseInt(limitParam, 10)
      : await getSystemSettingNumber('backup_list_limit', 50)
    const safeLimit = Number.isFinite(limit) && limit >= 1 && limit <= 500 ? limit : 50

    // system_settings.backup_retention_days 기준 오래된 백업 자동 삭제 후 목록 반환
    await cleanupOldBackups()
    const backups = await getBackups(safeLimit)
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
      const daysToKeep = body.daysToKeep != null
        ? parseInt(String(body.daysToKeep), 10)
        : undefined
      const deletedCount = await cleanupOldBackups(Number.isFinite(daysToKeep) ? daysToKeep : undefined)
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

