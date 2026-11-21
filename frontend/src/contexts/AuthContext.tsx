'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react'
import { useAuth as useClerkAuth, useClerk } from '@clerk/nextjs'
import { api, ApiError, setAuthTokenProvider } from '@/lib/api'
import type { Developer, Organization } from '@/lib/types'
import { withTimeout } from '@/lib/timeout'
import { clearStoredWorkspaceId } from '@/lib/workspaceStorage'

export type AuthStatus =
  | 'initializing'
  | 'redirecting_to_google'
  | 'provisioning'
  | 'onboarding_required'
  | 'authenticated'
  | 'unauthenticated'
  | 'error'

interface AuthContextType {
  developer: Developer | null
  organizations: Organization[]
  status: AuthStatus
  error: string | null
  isLoading: boolean
  isAuthenticated: boolean
  refresh: () => Promise<void>
  retry: () => Promise<void>
  logout: () => Promise<void>
  createWorkspace: (name: string) => Promise<void>
  markRedirecting: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, sessionId, getToken } = useClerkAuth()
  const { signOut } = useClerk()
  const [developer, setDeveloper] = useState<Developer | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [status, setStatus] = useState<AuthStatus>('initializing')
  const [error, setError] = useState<string | null>(null)
  const requestVersion = useRef(0)

  const getSessionToken = useCallback(async (fresh = false) => {
    if (!isLoaded || !isSignedIn) return null

    // Clerk can report a restored session a moment before its token is ready.
    // Keep that transient state away from the backend auth boundary.
    const delays = [0, 150, 350, 700]
    for (let attempt = 0; attempt < delays.length; attempt += 1) {
      if (delays[attempt]) {
        await new Promise((resolve) => window.setTimeout(resolve, delays[attempt]))
      }
      const token = await withTimeout(
        getToken({ skipCache: fresh || attempt > 0 }),
        5000,
        'Google session verification timed out. Check your connection and retry.',
      )
      if (token) return token
    }
    return null
  }, [getToken, isLoaded, isSignedIn])

  useEffect(() => {
    setAuthTokenProvider(() => getSessionToken())
    return () => setAuthTokenProvider(async () => null)
  }, [getSessionToken])

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current
    if (!isLoaded) {
      return
    }
    if (!isSignedIn) {
      clearStoredWorkspaceId()
      setDeveloper(null)
      setOrganizations([])
      setError(null)
      setStatus('unauthenticated')
      return
    }

    setStatus('provisioning')
    setError(null)
    try {
      const result = await withTimeout((async () => {
        const token = await getSessionToken()
        if (!token) {
          throw new Error('Your Google session is active, but its secure token is not ready yet. Please retry.')
        }

        try {
          return await api.auth.me(token)
        } catch (caught) {
          if (!(caught instanceof ApiError) || caught.status !== 401) throw caught
          const freshToken = await getSessionToken(true)
          if (!freshToken) throw caught
          return await api.auth.me(freshToken)
        }
      })(), 25000, 'Connecting your account took too long. Please retry.')
      if (version !== requestVersion.current) return
      setDeveloper(result.developer)
      setOrganizations(result.organizations)
      setStatus(result.onboarding_required ? 'onboarding_required' : 'authenticated')
    } catch (caught) {
      if (version !== requestVersion.current) return
      // A backend rejection must not pretend the Clerk browser session vanished;
      // doing so would allow a second OAuth attempt and Clerk's "already signed in" error.
      setDeveloper(null)
      setOrganizations([])
      setStatus('error')
      setError(caught instanceof Error ? caught.message : 'Unable to prepare your GuideKit account.')
    }
  }, [getSessionToken, isLoaded, isSignedIn])

  useEffect(() => {
    void refresh()
    return () => { requestVersion.current += 1 }
  }, [refresh, sessionId])

  useEffect(() => {
    if (isLoaded) return
    const timer = window.setTimeout(() => {
      setStatus('error')
      setError('Google sign-in could not load. Check your connection, then reload this page.')
    }, 15000)
    return () => window.clearTimeout(timer)
  }, [isLoaded])

  const logout = useCallback(async () => {
    clearStoredWorkspaceId()
    await signOut({ redirectUrl: '/login' })
    setDeveloper(null)
    setOrganizations([])
    setError(null)
    setStatus('unauthenticated')
  }, [signOut])

  const createWorkspace = useCallback(async (name: string) => {
    await api.orgs.create({ name })
    await refresh()
  }, [refresh])

  const value = useMemo<AuthContextType>(() => ({
    developer,
    organizations,
    status,
    error,
    isLoading: status === 'initializing' || status === 'provisioning',
    isAuthenticated: developer !== null,
    refresh,
    retry: refresh,
    logout,
    createWorkspace,
    markRedirecting: () => setStatus('redirecting_to_google'),
  }), [createWorkspace, developer, error, logout, organizations, refresh, status])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
