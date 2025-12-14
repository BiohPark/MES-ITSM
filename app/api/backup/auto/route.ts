import { NextRequest, NextResponse } from 'next/server'
import { createBackup, cleanupOldBackups } from '@/lib/backup'

// 자동 백업 엔드포인트 (스케줄러에서 호출)
export async function POST(request: NextRequest) {
  try {
    // 간단한 인증 (환경 변수로 보호)
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.BACKUP_AUTH_TOKEN || 'backup-secret-token'

    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const filename = await createBackup('auto')
    
    // 30일 이상 된 백업 정리
    await cleanupOldBackups(30)

    return NextResponse.json({ success: true, filename })
  } catch (error) {
    console.error('Auto backup error:', error)
    return NextResponse.json(
      { error: '자동 백업 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

