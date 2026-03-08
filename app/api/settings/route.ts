import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { getSystemSettingNumber, getSystemSettingFloat, setSystemSetting } from '@/lib/settings'

const DEFAULTS = {
  backup_retention_days: 10,
  backup_list_limit: 50,
  backup_schedule_interval_hours: 1,
  meeting_autosave_interval_sec: 60,
} as const

// 시스템 설정 조회 (인증된 사용자 전체 허용 - 회의록 자동저장 주기 등에서 사용)
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession(request.cookies.get('session')?.value ?? '')
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const backup_retention_days = await getSystemSettingNumber(
      'backup_retention_days',
      DEFAULTS.backup_retention_days
    )
    const backup_list_limit = await getSystemSettingNumber(
      'backup_list_limit',
      DEFAULTS.backup_list_limit
    )
    const backup_schedule_interval_hours = await getSystemSettingFloat(
      'backup_schedule_interval_hours',
      DEFAULTS.backup_schedule_interval_hours
    )
    const meeting_autosave_interval_sec = await getSystemSettingNumber(
      'meeting_autosave_interval_sec',
      DEFAULTS.meeting_autosave_interval_sec
    )

    return NextResponse.json({
      backup_retention_days,
      backup_list_limit,
      backup_schedule_interval_hours,
      meeting_autosave_interval_sec,
    })
  } catch (error) {
    console.error('Settings API GET error:', error)
    return NextResponse.json(
      { error: '설정 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 시스템 설정 저장 (관리자 전용)
export async function PATCH(request: NextRequest) {
  try {
    const session = await verifySession(request.cookies.get('session')?.value ?? '')
    if (!session || (session.role !== 'admin' && !session.isAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    if (body.backup_retention_days !== undefined) {
      const days = parseInt(String(body.backup_retention_days), 10)
      if (!Number.isFinite(days) || days < 0 || days > 365) {
        return NextResponse.json(
          { error: '백업 보관 일수는 0~365 사이의 숫자여야 합니다.' },
          { status: 400 }
        )
      }
      await setSystemSetting('backup_retention_days', String(days))
    }
    if (body.backup_list_limit !== undefined) {
      const n = parseInt(String(body.backup_list_limit), 10)
      if (!Number.isFinite(n) || n < 1 || n > 500) {
        return NextResponse.json(
          { error: '백업 목록 limit은 1~500 사이여야 합니다.' },
          { status: 400 }
        )
      }
      await setSystemSetting('backup_list_limit', String(n))
    }
    if (body.backup_schedule_interval_hours !== undefined) {
      const h = parseFloat(String(body.backup_schedule_interval_hours))
      if (!Number.isFinite(h) || h < 0.25 || h > 168) {
        return NextResponse.json(
          { error: '자동 백업 주기는 0.25~168(시간) 사이여야 합니다.' },
          { status: 400 }
        )
      }
      await setSystemSetting('backup_schedule_interval_hours', String(h))
    }
    if (body.meeting_autosave_interval_sec !== undefined) {
      const s = parseInt(String(body.meeting_autosave_interval_sec), 10)
      if (!Number.isFinite(s) || s < 30 || s > 600) {
        return NextResponse.json(
          { error: '회의록 자동 저장 주기는 30~600(초) 사이여야 합니다.' },
          { status: 400 }
        )
      }
      await setSystemSetting('meeting_autosave_interval_sec', String(s))
    }

    const backup_retention_days = await getSystemSettingNumber(
      'backup_retention_days',
      DEFAULTS.backup_retention_days
    )
    const backup_list_limit = await getSystemSettingNumber(
      'backup_list_limit',
      DEFAULTS.backup_list_limit
    )
    const backup_schedule_interval_hours = await getSystemSettingFloat(
      'backup_schedule_interval_hours',
      DEFAULTS.backup_schedule_interval_hours
    )
    const meeting_autosave_interval_sec = await getSystemSettingNumber(
      'meeting_autosave_interval_sec',
      DEFAULTS.meeting_autosave_interval_sec
    )
    return NextResponse.json({
      backup_retention_days,
      backup_list_limit,
      backup_schedule_interval_hours,
      meeting_autosave_interval_sec,
    })
  } catch (error: unknown) {
    console.error('Settings API PATCH error:', error)
    const msg = error instanceof Error ? error.message : ''
    const code = (error as { code?: string })?.code
    if (code === 'ER_NO_SUCH_TABLE' || /system_settings|doesn't exist/i.test(msg)) {
      return NextResponse.json(
        { error: '시스템 설정 테이블이 없습니다. 터미널에서 npm run add-system-settings-table 을 실행한 뒤 다시 시도하세요.' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: '설정 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}