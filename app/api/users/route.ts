import { NextRequest, NextResponse } from 'next/server'
import { getUsers, deleteUser } from '@/lib/users'
import { createAccount, updateAccount } from '@/lib/accounts'
import { validatePasswordStrength } from '@/lib/auth'

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
      const { username, name, email, password, role } = body.user || body

      if (!username || !name || !email || !password) {
        return NextResponse.json(
          { error: 'ID, 이름, 이메일, 비밀번호를 모두 입력해주세요.' },
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
        await createAccount(username, name, email, password, role || 'user')
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

      try {
        await updateAccount(userId, {
          username: user.username,
          name: user.name,
          email: user.email,
          password: user.password, // 비밀번호가 제공된 경우에만 업데이트
          role: user.role,
        })
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

