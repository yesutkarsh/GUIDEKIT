import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import DevicePage from '@/app/device/page'
import OnboardingPage from '@/app/onboarding/page'

const mocks = vi.hoisted(() => ({
  clerk: { isLoaded: true, isSignedIn: true, getToken: vi.fn() },
  signOut: vi.fn(),
  replace: vi.fn(),
}))

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => mocks.clerk,
  useClerk: () => ({ signOut: mocks.signOut }),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams('code=ABCD-1234'),
}))
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a> }))

const profile = {
  developer: { id: 'dev-1', email: 'alice@example.com' },
  organizations: [{ id: 'org-1', name: 'Workspace' }],
  onboarding_required: false,
}
const device = { client: 'vscode_extension', status: 'pending', expires_at: '2099-01-01T00:00:00Z' }
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

function mount() {
  return render(<AuthProvider><DevicePage /></AuthProvider>)
}

function LogoutProbe() {
  const { logout } = useAuth()
  return <button onClick={() => void logout()}>Sign out</button>
}

beforeEach(() => {
  mocks.clerk.isLoaded = true
  mocks.clerk.isSignedIn = true
  mocks.clerk.getToken.mockReset().mockResolvedValue('clerk-test-token')
  mocks.signOut.mockReset().mockResolvedValue(undefined)
  mocks.replace.mockReset()
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('device authorization recovery', () => {
  it('uses the GuideKit extension visual system on the confirmation screen', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response(profile))
      .mockResolvedValueOnce(response(device)))
    mount()

    await screen.findByText('Connect GuideKit for VS Code?')

    expect(screen.getByRole('heading', { level: 1, name: 'GuideKit' })).toBeTruthy()
    expect(screen.getByText('Implement chatbots with ease.')).toBeTruthy()
    expect(screen.getByRole('main').className).toContain('bg-[#0b0e13]')
    expect(screen.getByRole('button', { name: 'Confirm and connect' }).className).toContain('bg-[#182d50]')
  })

  it('shows the backend failure instead of hiding it behind the initial device spinner', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ detail: 'Unable to load the verified Google profile' }, 503)))
    mount()
    await screen.findByText('Unable to load the verified Google profile')
    expect(screen.queryByText('Checking your connection request…')).toBeNull()
    expect(screen.getByRole('button', { name: 'Retry connection' })).toBeTruthy()
  })

  it('retries a failed session check and reaches the original device confirmation', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(response(profile))
      .mockResolvedValueOnce(response(device))
    vi.stubGlobal('fetch', fetchMock)
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Retry connection' }))
    await screen.findByText('Connect GuideKit for VS Code?')
    expect(screen.getByText('alice@example.com')).toBeTruthy()
    expect(screen.getByText('ABCD-1234')).toBeTruthy()
    expect(fetchMock.mock.calls[2][0]).toContain('/device-auth/requests/ABCD-1234')
  })

  it('shows recovery if Clerk never initializes', async () => {
    vi.useFakeTimers()
    mocks.clerk.isLoaded = false
    mount()
    await act(async () => { await vi.advanceTimersByTimeAsync(15000) })
    expect(screen.getByText('Google sign-in could not load. Check your connection, then reload this page.')).toBeTruthy()
    expect(screen.queryByText('Checking your connection request…')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry connection' }))
    await act(async () => {})
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeTruthy()
  })

  it('times out a Clerk token promise that never resolves', async () => {
    vi.useFakeTimers()
    mocks.clerk.getToken.mockImplementation(() => new Promise(() => {}))
    mount()
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(screen.getByText('Google session verification timed out. Check your connection and retry.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry connection' })).toBeTruthy()
  })

  it('times out the complete API request even if a backend response never arrives', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(() => {})))
    mount()
    await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
    expect(screen.getByText('The request timed out. Check that the local API is running.')).toBeTruthy()
  })

  it('also times out a response body that stalls after headers arrive', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => new Promise(() => {}) }))
    mount()
    await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
    expect(screen.getByText('The request timed out. Check that the local API is running.')).toBeTruthy()
  })

  it('shows a retryable device error when inspection fails after a valid session', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response(profile))
      .mockRejectedValueOnce(new TypeError('offline')))
    mount()
    await screen.findByText('Couldn’t connect VS Code')
    expect(screen.getByText('Unable to reach the local GuideKit API.')).toBeTruthy()
    expect(screen.queryByText('Checking your connection request…')).toBeNull()
  })

  it('refreshes a rejected token once then displays the real auth error', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => response({ detail: 'Invalid or expired Clerk session token' }, 401))
    vi.stubGlobal('fetch', fetchMock)
    mount()
    await screen.findByText('Invalid or expired Clerk session token')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(mocks.clerk.getToken).toHaveBeenLastCalledWith({ skipCache: true })
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('preserves the device destination when workspace onboarding is needed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...profile, organizations: [], onboarding_required: true })))
    mount()
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/onboarding?return_to=%2Fdevice%3Fcode%3DABCD-1234'))
  })

  it('returns signed-out users to Google sign-in with the device code preserved', async () => {
    mocks.clerk.isSignedIn = false
    mount()
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/login?return_to=%2Fdevice%3Fcode%3DABCD-1234'))
  })

  it('also exposes authentication errors on the onboarding page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    render(<AuthProvider><OnboardingPage /></AuthProvider>)
    await screen.findByText('Unable to reach the local GuideKit API.')
    expect(screen.getByRole('button', { name: 'Retry connection' })).toBeTruthy()
  })

  it('clears the selected workspace when the user signs out', async () => {
    window.localStorage.setItem('guidekit.active_org_id', 'org-1')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(profile)))
    render(<AuthProvider><LogoutProbe /></AuthProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledWith({ redirectUrl: '/login' }))
    expect(window.localStorage.getItem('guidekit.active_org_id')).toBeNull()
  })
})
