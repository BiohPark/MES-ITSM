import { NextRequest, NextResponse } from 'next/server'
import { verifyLogin, createAccount, getAccountByEmail, setPasswordResetToken, getAccountByResetToken, updatePassword } from '@/lib/accounts'
import { createSession, deleteSession, generateResetToken, validatePasswordStrength, verifySession } from '@/lib/auth'

// 로그인
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'login') {
      const { username, password } = body

      if (!username || !password) {
        return NextResponse.json(
          { error: 'ID와 비밀번호를 입력해주세요.' },
          { status: 400 }
        )
      }

      const account = await verifyLogin(username, password)
      if (!account) {
        console.log('로그인 실패: 계정을 찾을 수 없음')
        return NextResponse.json(
          { error: 'ID 또는 비밀번호가 올바르지 않습니다.' },
          { status: 401 }
        )
      }

      console.log('로그인 성공:', account.username)

      // 세션 토큰 생성
      const token = await createSession({
        userId: account.id,
        username: account.username,
        name: account.name,
        role: account.role,
        email: account.email,
      })

      console.log('세션 토큰 생성 완료')

      // 응답 생성 및 쿠키 설정
      const response = NextResponse.json({
        success: true,
        user: {
          id: account.id,
          username: account.username,
          name: account.name,
          role: account.role,
          email: account.email,
        },
      })

      // 쿠키를 응답에 직접 설정
      response.cookies.set('session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7일
        path: '/',
      })

      console.log('쿠키 설정 완료')
      return response
    }

    if (action === 'register') {
      const { username, name, email, password } = body

      if (!username || !name || !email || !password) {
        return NextResponse.json(
          { error: '모든 필드를 입력해주세요.' },
          { status: 400 }
        )
      }

      // 비밀번호 강도 검증
      const passwordValidation = validatePasswordStrength(password)
      if (!passwordValidation.valid) {
        return NextResponse.json(
          { error: passwordValidation.message },
          { status: 400 }
        )
      }

      try {
        const userId = await createAccount(username, name, email, password, 'user')
        
        // 자동 로그인
        const account = await verifyLogin(username, password)
        if (account) {
          const token = await createSession({
            userId: account.id,
            username: account.username,
            name: account.name,
            role: account.role,
            email: account.email,
          })

          const response = NextResponse.json({
            success: true,
            message: '회원가입이 완료되었습니다.',
            user: {
              id: account.id,
              username: account.username,
              name: account.name,
              role: account.role,
              email: account.email,
            },
          })

          // 쿠키를 응답에 직접 설정
          response.cookies.set('session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7일
            path: '/',
          })

          return response
        }

        return NextResponse.json({
          success: true,
          message: '회원가입이 완료되었습니다.',
          user: null,
        })
      } catch (error: any) {
        return NextResponse.json(
          { error: error.message || '회원가입에 실패했습니다.' },
          { status: 400 }
        )
      }
    }

    if (action === 'logout') {
      await deleteSession()
      return NextResponse.json({ success: true, message: '로그아웃되었습니다.' })
    }

    if (action === 'request-reset') {
      const { email } = body

      if (!email) {
        return NextResponse.json(
          { error: '이메일을 입력해주세요.' },
          { status: 400 }
        )
      }

      const account = await getAccountByEmail(email)
      if (!account) {
        // 보안을 위해 계정이 없어도 성공 메시지 반환
        return NextResponse.json({
          success: true,
          message: '비밀번호 재설정 링크가 이메일로 전송되었습니다.',
        })
      }

      // 비밀번호 리셋 토큰 생성
      const token = generateResetToken()
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 1) // 1시간 후 만료

      await setPasswordResetToken(account.id, token, expiresAt)

      // TODO: 실제로는 이메일로 토큰 전송
      // 여기서는 개발용으로 토큰을 응답에 포함
      // 프로덕션에서는 이 부분을 제거하고 이메일 서비스 연동
      console.log(`비밀번호 리셋 토큰 (개발용): ${token}`)

      return NextResponse.json({
        success: true,
        message: '비밀번호 재설정 링크가 이메일로 전송되었습니다.',
        // 개발용: 실제로는 제거해야 함
        resetToken: process.env.NODE_ENV === 'development' ? token : undefined,
      })
    }

    if (action === 'reset-password') {
      const { token, newPassword } = body

      if (!token || !newPassword) {
        return NextResponse.json(
          { error: '토큰과 새 비밀번호를 입력해주세요.' },
          { status: 400 }
        )
      }

      // 비밀번호 강도 검증
      const passwordValidation = validatePasswordStrength(newPassword)
      if (!passwordValidation.valid) {
        return NextResponse.json(
          { error: passwordValidation.message },
          { status: 400 }
        )
      }

      const account = await getAccountByResetToken(token)
      if (!account) {
        return NextResponse.json(
          { error: '유효하지 않거나 만료된 토큰입니다.' },
          { status: 400 }
        )
      }

      await updatePassword(account.id, newPassword)

      return NextResponse.json({
        success: true,
        message: '비밀번호가 성공적으로 변경되었습니다.',
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Auth API error:', error)
    return NextResponse.json(
      { error: '인증 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 세션 확인
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('session')?.value

    if (!token) {
      return NextResponse.json({ authenticated: false })
    }

    const session = await verifySession(token)

    if (!session) {
      return NextResponse.json({ authenticated: false })
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.userId,
        username: session.username,
        name: session.name,
        role: session.role,
        email: session.email,
      },
    })
  } catch (error) {
    console.error('Session check error:', error)
    return NextResponse.json({ authenticated: false })
  }
}

