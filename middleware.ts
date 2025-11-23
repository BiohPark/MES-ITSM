import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySession } from './lib/auth'

// 인증이 필요하지 않은 경로
const publicPaths = ['/login', '/register', '/reset-password', '/api/auth']
// Admin 권한이 필요한 경로
const adminPaths = ['/api/users'] // 설정 관련 API는 나중에 확장 가능

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // public 경로는 통과
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path))
  if (isPublicPath) {
    return NextResponse.next()
  }

  // API 경로 처리
  if (pathname.startsWith('/api')) {
    const token = request.cookies.get('session')?.value

    if (!token) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const session = await verifySession(token)
    if (!session) {
      const response = NextResponse.json(
        { error: '인증이 유효하지 않습니다.' },
        { status: 401 }
      )
      // 만료된 쿠키 삭제
      response.cookies.set('session', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      })
      return response
    }

    // Admin 권한이 필요한 경로 확인
    const isAdminPath = adminPaths.some(path => pathname.startsWith(path))
    if (isAdminPath && session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    // API 요청에 세션 정보 추가 (필요한 경우)
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', session.userId)
    requestHeaders.set('x-user-role', session.role)

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  // 페이지 경로 처리
  const token = request.cookies.get('session')?.value

  if (!token) {
    // 로그인 페이지로 리다이렉트
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const session = await verifySession(token)
  if (!session) {
    // 세션이 유효하지 않으면 쿠키 삭제 후 로그인 페이지로 리다이렉트
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    loginUrl.searchParams.set('expired', 'true')
    const response = NextResponse.redirect(loginUrl)
    // 만료된 쿠키 삭제
    response.cookies.set('session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

