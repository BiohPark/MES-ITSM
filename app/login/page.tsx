 'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showErrorPopup, setShowErrorPopup] = useState(false)

  const from = searchParams?.get('from') || '/'
  const expired = searchParams?.get('expired') === 'true'

  useEffect(() => {
    if (expired) {
      setError('세션이 만료되었습니다. 다시 로그인해주세요.')
      setShowErrorPopup(true)
    }
  }, [expired])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setShowErrorPopup(false)
    setLoading(true)

    console.log('로그인 시도:', { username, from })

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 쿠키 포함
        body: JSON.stringify({
          action: 'login',
          username,
          password,
        }),
      })

      console.log('로그인 응답 상태:', response.status, response.ok)

      const data = await response.json()
      console.log('로그인 응답 데이터:', data)

      if (!response.ok) {
        const errorMessage = data.error || '로그인에 실패했습니다.'
        console.error('로그인 실패:', errorMessage)
        setError(errorMessage)
        setShowErrorPopup(true)
        setLoading(false)
        return
      }

      // 로그인 성공
      console.log('로그인 성공, 리다이렉트 예정:', from)
      
      // 입력값 초기화
      setUsername('')
      setPassword('')
      setLoading(false)
      
      // 쿠키가 설정되도록 약간의 지연 후 전체 페이지 리로드
      // window.location.replace를 사용하여 히스토리에 남기지 않음
      setTimeout(() => {
        console.log('리다이렉트 실행:', from || '/')
        window.location.replace(from || '/')
      }, 100)
    } catch (error) {
      console.error('Login error:', error)
      const errorMessage = '로그인 중 오류가 발생했습니다.'
      setError(errorMessage)
      setShowErrorPopup(true)
      setLoading(false)
    }
  }

  const closeErrorPopup = () => {
    setShowErrorPopup(false)
    setError('')
  }

  return (
    <>
      {/* 에러 팝업 */}
      {showErrorPopup && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={closeErrorPopup}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '0.75rem',
              padding: '2rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              maxWidth: '400px',
              width: '90%',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
            }}>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#991b1b',
                margin: 0,
              }}>
                로그인 실패
              </h2>
              <button
                onClick={closeErrorPopup}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: 0,
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>
            <p style={{
              color: '#374151',
              fontSize: '1rem',
              marginBottom: '1.5rem',
              lineHeight: '1.5',
            }}>
              {error}
            </p>
            <button
              onClick={closeErrorPopup}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              확인
            </button>
          </div>
        </div>
      )}

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
            로그인
          </h1>
          <p style={{
            fontSize: '0.875rem',
            color: '#6b7280',
            textAlign: 'center',
            marginBottom: '2rem',
          }}>
            ITSM 시스템에 로그인하세요
          </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="username" style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#374151',
              marginBottom: '0.5rem',
            }}>
              ID
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
              placeholder="ID를 입력하세요"
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="password" style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#374151',
              marginBottom: '0.5rem',
            }}>
              비밀번호
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
              placeholder="비밀번호를 입력하세요"
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
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.875rem',
          marginTop: '1rem',
        }}>
          <Link
            href="/register"
            style={{
              color: '#667eea',
              textDecoration: 'none',
            }}
          >
            회원가입
          </Link>
          <Link
            href="/reset-password"
            style={{
              color: '#667eea',
              textDecoration: 'none',
            }}
          >
            비밀번호 찾기
          </Link>
        </div>
      </div>
    </div>
    </>
  )
}

