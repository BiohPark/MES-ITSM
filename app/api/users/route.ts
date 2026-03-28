import { NextRequest, NextResponse } from 'next/server'
import { getUsers, deleteUser } from '@/lib/users'
import { createAccount, updateAccount } from '@/lib/accounts'
import { getSession, validatePasswordStrength } from '@/lib/auth'

export async function GET() {
  try {
    const users = await getUsers()
    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (body.action === 'create') {
      // 로그인 가능한 계정 생성 (회원가입과 동일한 정보 필요)
      const { username, name, email, password, role, is_admin, department_id } = body.user || body

      if (!username || !name || !email || !password) {
        return NextResponse.json(
          { error: 'ID, 이름, 이메일, 비밀번호를 모두 입력해주세요.' },
          { status: 400 }
        )
      }

      const deptNum = department_id != null && department_id !== '' ? Number(department_id) : NaN
      if (!Number.isFinite(deptNum) || deptNum < 1) {
        return NextResponse.json(
          { error: '부서를 선택해주세요.' },
          { status: 400 }
        )
      }

      // 비밀번호 강도 검증
      const passwordValidation = validatePasswordStrength(password)
      if (!passwordValidation.valid) {
        return NextResponse.json(
          { error: passwordValidation.message || '비밀번호가 요구사항을 만족하지 않습니다.' },
          { status: 400 }
        )
      }

      try {
        await createAccount(username, name, email, password, role || 'user', !!is_admin, deptNum)
        const users = await getUsers()
        return NextResponse.json({ success: true, users })
      } catch (error: any) {
        return NextResponse.json(
          { error: error.message || '사용자 추가에 실패했습니다.' },
          { status: 400 }
        )
      }
    } else if (body.action === 'delete') {
      await deleteUser(body.userId)
      const users = await getUsers()
      return NextResponse.json({ success: true, users })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error processing user request:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to process request: ${errorMessage}` },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    if (body.action === 'update') {
      const { userId, user } = body

      if (!userId) {
        return NextResponse.json(
          { error: '사용자 ID가 필요합니다.' },
          { status: 400 }
        )
      }

      const session = await getSession()
      const isAdmin = session?.role === 'admin' || !!session?.isAdmin
      // WBS 수정 권한은 admin만 부여/해제 가능
      const updates: Parameters<typeof updateAccount>[1] = {
        username: user.username,
        name: user.name,
        email: user.email,
        password: user.password,
        role: user.role,
        is_admin: user.is_admin,
      }
      if (isAdmin && typeof user.can_edit_wbs === 'boolean') {
        updates.can_edit_wbs = user.can_edit_wbs
      }
      if (isAdmin && user.department_id !== undefined) {
        const d = user.department_id
        if (d === null || d === '') {
          updates.department_id = null
        } else {
          const n = Number(d)
          updates.department_id = Number.isFinite(n) && n >= 1 ? n : null
        }
      }

      try {
        await updateAccount(userId, updates)
        const users = await getUsers()
        return NextResponse.json({ success: true, users })
      } catch (error: any) {
        return NextResponse.json(
          { error: error.message || '사용자 수정에 실패했습니다.' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error updating user:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to update user: ${errorMessage}` },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    await deleteUser(body.id)
    const users = await getUsers()
    return NextResponse.json({ success: true, users })
  } catch (error) {
    console.error('Error deleting user:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to delete user: ${errorMessage}` },
      { status: 500 }
    )
  }
}

