import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySession } from './lib/auth'

// 인증이 필요하지 않은 경로
const publicPaths = ['/login', '/register', '/reset-password', '/api/auth']
// Admin 권한이 필요한 경로 (POST, PUT, DELETE만 제한, GET은 모든 인증된 사용자 허용)
const adminPaths = ['/api/users', '/api/settings']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 로그인/회원가입 등 인증 불필요 경로는 세션 검사 없이 통과
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path))
  if (isPublicPath) {
    return NextResponse.next()
  }

  // API 경로 처리 (위에서 /api/auth 는 이미 publicPaths 로 통과)
  if (pathname.startsWith('/api')) {
    const token = request.cookies.get('session')?.value

    if (!token) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    let session
    try {
      session = await verifySession(token)
    } catch (error) {
      const response = NextResponse.json(
        { error: '인증 처리 중 오류가 발생했습니다.' },
        { status: 500 }
      )
      return response
    }
    
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

    // Admin 권한이 필요한 경로 확인 (GET 요청은 제외) — role=admin 또는 isAdmin 플래그
    const isAdmin = session.role === 'admin' || !!session.isAdmin
    const isAdminPath = adminPaths.some(path => pathname.startsWith(path))
    if (isAdminPath && !isAdmin) {
      // GET 요청은 모든 인증된 사용자에게 허용 (담당자 목록 조회용)
      const method = request.method
      if (method !== 'GET') {
        return NextResponse.json(
          { error: 'Admin 권한이 필요합니다.' },
          { status: 403 }
        )
      }
    }

    // Viewonly 권한: 모든 쓰기 요청(POST/PUT/PATCH/DELETE) 전역 차단
    const method = request.method
    if (session.role === 'Viewonly' && method !== 'GET') {
      return NextResponse.json(
        { error: 'Viewonly 권한은 데이터를 수정할 수 없습니다.' },
        { status: 403 }
      )
    }

    // API 요청에 세션 정보 추가 (필요한 경우)
    // Edge Runtime에서는 헤더 값이 ByteString이어야 하므로 한글을 URL 인코딩
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', session.userId)
    // 한글 역할명을 URL 인코딩하여 헤더에 설정
    requestHeaders.set('x-user-role', encodeURIComponent(session.role))
    // 사용자 이름도 URL 인코딩하여 헤더에 설정
    requestHeaders.set('x-user-name', encodeURIComponent(session.name))

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

