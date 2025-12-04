import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { cookies } from 'next/headers'

const secretKey = process.env.JWT_SECRET || 'default-secret-key-change-in-production'
if (process.env.NODE_ENV === 'production' && secretKey === 'default-secret-key-change-in-production') {
  console.warn('⚠️  WARNING: JWT_SECRET이 기본값을 사용하고 있습니다. 프로덕션 환경에서는 반드시 변경해야 합니다!')
}
const encodedKey = new TextEncoder().encode(secretKey)

export interface SessionPayload {
  userId: string
  username: string
  name: string
  role: 'admin' | 'user'
  email?: string
}

// JWT 생성
export async function createSession(payload: SessionPayload): Promise<string> {
  // jose의 타입 요구사항을 만족하도록 JWTPayload로 캐스팅
  const jwtPayload: JWTPayload = { ...payload }
  const token = await new SignJWT(jwtPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // 7일 후 만료
    .sign(encodedKey)

  return token
}

// JWT 검증
export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ['HS256'],
    })
    return payload as unknown as SessionPayload
  } catch (error) {
    console.error('JWT 검증 실패:', error)
    return null
  }
}

// 쿠키에서 세션 가져오기
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value

  if (!token) {
    return null
  }

  return await verifySession(token)
}

// 세션 쿠키 설정 (토큰 반환)
export async function setSession(payload: SessionPayload): Promise<string> {
  const token = await createSession(payload)
  const cookieStore = await cookies()
  
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7일
    path: '/',
  })
  
  return token
}

// 세션 쿠키 삭제
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}

// 비밀번호 강도 검증
export function validatePasswordStrength(password: string): {
  valid: boolean
  message?: string
} {
  if (password.length < 8) {
    return { valid: false, message: '비밀번호는 최소 8자 이상이어야 합니다.' }
  }

  if (!/[A-Za-z]/.test(password)) {
    return { valid: false, message: '비밀번호는 영문자를 포함해야 합니다.' }
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '비밀번호는 숫자를 포함해야 합니다.' }
  }

  return { valid: true }
}

// 랜덤 토큰 생성 (비밀번호 리셋용)
export function generateResetToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

