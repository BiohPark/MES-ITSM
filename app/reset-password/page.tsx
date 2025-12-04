 'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<'request' | 'reset'>('request')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetToken, setResetToken] = useState<string | null>(null)

  useEffect(() => {
    const urlToken = searchParams?.get('token')
    if (urlToken) {
      setToken(urlToken)
      setStep('reset')
    }
  }, [searchParams])

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'request-reset',
          email,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || '비밀번호 재설정 요청에 실패했습니다.')
        setLoading(false)
        return
      }

      setSuccess(data.message)
      if (data.resetToken) {
        setResetToken(data.resetToken)
      }
      setLoading(false)
    } catch (error) {
      console.error('Request reset error:', error)
      setError('비밀번호 재설정 요청 중 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    if (password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'reset-password',
          token: token || resetToken,
          newPassword: password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || '비밀번호 재설정에 실패했습니다.')
        setLoading(false)
        return
      }

      setSuccess('비밀번호가 성공적으로 변경되었습니다. 로그인 페이지로 이동합니다.')
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (error) {
      console.error('Reset password error:', error)
      setError('비밀번호 재설정 중 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  if (step === 'request') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '1rem',
      }}>
        <div style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
          width: '100%',
          maxWidth: '400px',
        }}>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
            textAlign: 'center',
            color: '#111827',
          }}>
            비밀번호 찾기
          </h1>
          <p style={{
            fontSize: '0.875rem',
            color: '#6b7280',
            textAlign: 'center',
            marginBottom: '2rem',
          }}>
            이메일 주소를 입력하세요
          </p>

          {error && (
            <div style={{
              background: '#fee2e2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              background: '#d1fae5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}>
              {success}
              {resetToken && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
                  <strong>개발용 토큰:</strong> {resetToken}
                  <br />
                  <a href={`/reset-password?token=${resetToken}`} style={{ color: '#059669', textDecoration: 'underline' }}>
                    이 링크를 클릭하여 비밀번호를 재설정하세요
                  </a>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleRequestReset}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="email" style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#374151',
                marginBottom: '0.5rem',
              }}>
                이메일
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                }}
                placeholder="이메일을 입력하세요"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: loading ? '#9ca3af' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                marginBottom: '1rem',
              }}
            >
              {loading ? '전송 중...' : '비밀번호 재설정 링크 전송'}
            </button>
          </form>

          <div style={{
            textAlign: 'center',
            fontSize: '0.875rem',
          }}>
            <a
              href="/login"
              style={{
                color: '#667eea',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              로그인으로 돌아가기
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '1rem',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '1rem',
        padding: '2rem',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
        width: '100%',
        maxWidth: '400px',
      }}>
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          marginBottom: '0.5rem',
          textAlign: 'center',
          color: '#111827',
        }}>
          비밀번호 재설정
        </h1>
        <p style={{
          fontSize: '0.875rem',
          color: '#6b7280',
          textAlign: 'center',
          marginBottom: '2rem',
        }}>
          새로운 비밀번호를 입력하세요
        </p>

        {error && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            fontSize: '0.875rem',
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: '#d1fae5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            fontSize: '0.875rem',
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleResetPassword}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="password" style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#374151',
              marginBottom: '0.5rem',
            }}>
              새 비밀번호 * (최소 8자, 영문자와 숫자 포함)
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
              placeholder="새 비밀번호를 입력하세요"
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="confirmPassword" style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#374151',
              marginBottom: '0.5rem',
            }}>
              비밀번호 확인 *
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
              placeholder="비밀번호를 다시 입력하세요"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: loading ? '#9ca3af' : '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '1rem',
            }}
          >
            {loading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>

        <div style={{
          textAlign: 'center',
          fontSize: '0.875rem',
        }}>
          <a
            href="/login"
            style={{
              color: '#667eea',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            로그인으로 돌아가기
          </a>
        </div>
      </div>
    </div>
  )
}

