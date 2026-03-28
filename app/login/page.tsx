 'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const { t } = useI18n()
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
      setError(t('auth.login.sessionExpired'))
      setShowErrorPopup(true)
    }
  }, [expired, t])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setShowErrorPopup(false)
    setLoading(true)

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

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.error || t('auth.login.errorDefault')
        setError(errorMessage)
        setShowErrorPopup(true)
        setLoading(false)
        return
      }

      // 로그인 성공
      // 입력값 초기화
      setUsername('')
      setPassword('')
      setLoading(false)
      
      // 쿠키가 설정되도록 약간의 지연 후 전체 페이지 리로드
      // window.location.replace를 사용하여 히스토리에 남기지 않음
      setTimeout(() => {
        window.location.replace(from || '/')
      }, 100)
    } catch (error) {
      const errorMessage = t('auth.login.errorGeneric')
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
                {t('auth.login.failureTitle')}
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
              {t('common.ok')}
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
            {t('auth.login.title')}
          </h1>
          <p style={{
            fontSize: '0.875rem',
            color: '#6b7280',
            textAlign: 'center',
            marginBottom: '2rem',
          }}>
            {t('auth.login.subtitle')}
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
              {t('auth.login.username')}
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
              placeholder={t('auth.login.placeholderUsername')}
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
              {t('auth.login.password')}
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
              placeholder={t('auth.login.placeholderPassword')}
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
            {loading ? t('auth.login.submitting') : t('auth.login.submit')}
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
            {t('auth.login.register')}
          </Link>
          <Link
            href="/reset-password"
            style={{
              color: '#667eea',
              textDecoration: 'none',
            }}
          >
            {t('auth.login.forgotPassword')}
          </Link>
        </div>
      </div>
    </div>
    </>
  )
}

