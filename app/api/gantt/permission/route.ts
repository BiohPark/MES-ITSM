import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAccountById, getAccountByUsername } from '@/lib/accounts'

/** 현재 사용자의 WBS 수정 권한 여부 (admin이거나 can_edit_wbs가 true인 경우) */
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ canEditWbs: false })
    }
    if (session.role === 'admin') {
      return NextResponse.json({ canEditWbs: true })
    }
    // 로그인 ID(username) 기준으로 계정 조회 → 사용자 관리 화면과 동일한 행 사용
    const username = session.username?.trim()
    if (!username) {
      return NextResponse.json({ canEditWbs: false })
    }
    const account = await getAccountByUsername(username)
    if (!account || account.id !== session.userId) {
      return NextResponse.json({ canEditWbs: false })
    }
    return NextResponse.json({ canEditWbs: !!account.can_edit_wbs })
  } catch (e) {
    console.error('[gantt/permission]', e)
    return NextResponse.json({ canEditWbs: false })
  }
}
