'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { loginUrl, onboardingUrl } from '@/lib/auth'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, status } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.replace(loginUrl('/dashboard'))
    if (status === 'onboarding_required') router.replace(onboardingUrl('/dashboard'))
  }, [router, status])

  if (isLoading) {
    return (
      <div
        style={{
          background: '#0A0A0C',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid #1F2229',
              borderTopColor: '#10B981',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ color: '#8E929F', fontSize: '14px' }}>Loading...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return <>{children}</>
}
