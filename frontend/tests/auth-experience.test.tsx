import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthExperience } from '@/components/auth/AuthExperience'

const mocks = vi.hoisted(() => ({
  clerk: { isLoaded: true, isSignedIn: false },
  signIn: { sso: vi.fn() },
  fetchStatus: 'idle',
  replace: vi.fn(),
  search: new URLSearchParams(),
  auth: {
    status: 'unauthenticated',
    error: null as string | null,
    isAuthenticated: false,
    organizations: [] as Array<{ id: string; name: string; slug: string; created_at: string }>,
    markRedirecting: vi.fn(),
    retry: vi.fn(),
    logout: vi.fn(),
  },
}))

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => mocks.clerk,
  useSignIn: () => ({ signIn: mocks.signIn, fetchStatus: mocks.fetchStatus }),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mocks.auth,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.search,
}))

vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a>,
}))

vi.mock('next/image', () => ({
  default: ({ fill: _fill, priority: _priority, sizes: _sizes, ...props }: React.ComponentProps<'img'> & { fill?: boolean; priority?: boolean; sizes?: string }) => <img {...props} />,
}))

beforeEach(() => {
  mocks.clerk.isLoaded = true
  mocks.clerk.isSignedIn = false
  mocks.fetchStatus = 'idle'
  mocks.search = new URLSearchParams()
  mocks.auth.status = 'unauthenticated'
  mocks.auth.error = null
  mocks.auth.isAuthenticated = false
  mocks.auth.organizations = []
  mocks.auth.markRedirecting.mockReset()
  mocks.auth.retry.mockReset().mockResolvedValue(undefined)
  mocks.auth.logout.mockReset().mockResolvedValue(undefined)
  mocks.signIn.sso.mockReset().mockResolvedValue({ error: null })
  mocks.replace.mockReset()
})

afterEach(() => cleanup())

describe('GuideKit authentication experience', () => {
  it('renders the focused Google-only login experience', () => {
    render(<AuthExperience mode="login" />)

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeTruthy()
    expect(screen.getByText('Sign in with Google to continue to your GuideKit workspace.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Continue with Google' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByRole('link', { name: 'Create an account' }).getAttribute('href')).toBe('/signup?return_to=%2Fdashboard')
    expect(screen.queryByText(/password/i)).toBeNull()
  })

  it('renders signup-specific copy without changing the Google account flow', () => {
    render(<AuthExperience mode="signup" />)

    expect(screen.getByRole('heading', { name: 'Create your GuideKit account' })).toBeTruthy()
    expect(screen.getByText('Continue with Google to create your account and set up your workspace.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Continue with Google' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/login?return_to=%2Fdashboard')
  })

  it('preserves an extension destination when opening Google', async () => {
    mocks.search = new URLSearchParams('return_to=%2Fdevice%3Fcode%3DABCD-1234')
    render(<AuthExperience mode="login" />)

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))

    await waitFor(() => expect(mocks.signIn.sso).toHaveBeenCalledWith({
      strategy: 'oauth_google',
      redirectUrl: '/device?code=ABCD-1234',
      redirectCallbackUrl: '/sso-callback?return_to=%2Fdevice%3Fcode%3DABCD-1234',
    }))
    expect(mocks.auth.markRedirecting).toHaveBeenCalledTimes(1)
  })

  it('prevents duplicate OAuth attempts while Google is opening', async () => {
    mocks.signIn.sso.mockImplementation(() => new Promise(() => {}))
    render(<AuthExperience mode="login" />)
    const button = screen.getByRole('button', { name: 'Continue with Google' })

    fireEvent.click(button)
    fireEvent.click(button)

    await waitFor(() => expect(mocks.signIn.sso).toHaveBeenCalledTimes(1))
    expect((screen.getByRole('button', { name: 'Opening Google…' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows an actionable message when Google sign-in is cancelled', () => {
    mocks.search = new URLSearchParams('auth_error=cancelled')
    render(<AuthExperience mode="login" />)

    expect(screen.getByRole('alert').textContent).toContain('Google sign-in was not completed. You can safely try again.')
    expect((screen.getByRole('button', { name: 'Continue with Google' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('redirects an authenticated user without showing a sign-in action', async () => {
    mocks.clerk.isSignedIn = true
    mocks.auth.status = 'authenticated'
    mocks.auth.isAuthenticated = true
    render(<AuthExperience mode="login" />)

    expect(screen.getByRole('heading', { name: 'Opening your workspace…' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).toBeNull()
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/dashboard'))
  })

  it('sends an authenticated multi-workspace user to workspace selection', async () => {
    mocks.clerk.isSignedIn = true
    mocks.auth.status = 'authenticated'
    mocks.auth.isAuthenticated = true
    mocks.auth.organizations = [
      { id: 'org-a', name: 'Alpha', slug: 'alpha', created_at: '2026-01-01T00:00:00Z' },
      { id: 'org-b', name: 'Beta', slug: 'beta', created_at: '2026-01-02T00:00:00Z' },
    ]
    render(<AuthExperience mode="login" />)

    expect(screen.getByRole('heading', { name: 'Choose your workspace' })).toBeTruthy()
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/select-workspace?return_to=%2Fdashboard'))
  })

  it('keeps an existing Clerk session recoverable when the local API fails', () => {
    mocks.clerk.isSignedIn = true
    mocks.auth.status = 'error'
    mocks.auth.error = 'Unable to reach the local GuideKit API.'
    render(<AuthExperience mode="login" />)

    expect(screen.getByRole('alert').textContent).toContain('Unable to reach the local GuideKit API.')
    expect((screen.getByRole('button', { name: 'Retry secure connection' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: 'Sign out and use another Google account' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
