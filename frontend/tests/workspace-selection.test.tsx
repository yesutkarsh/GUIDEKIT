import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SelectWorkspacePage from '@/app/select-workspace/page'

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  search: new URLSearchParams(),
  retry: vi.fn(),
  logout: vi.fn(),
  auth: {
    status: 'authenticated',
    organizations: [
      { id: 'org-a', name: 'Alpha Studio', slug: 'alpha-studio', created_at: '2026-01-01T00:00:00Z' },
      { id: 'org-b', name: 'Beta Labs', slug: 'beta-labs', created_at: '2026-01-02T00:00:00Z' },
    ],
    error: null as string | null,
    isAuthenticated: true,
    developer: {
      id: 'dev-a',
      email: 'alex@example.com',
      display_name: 'Alex Morgan',
      auth_provider: 'google',
      created_at: '2026-01-01T00:00:00Z',
    },
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.search,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ ...mocks.auth, retry: mocks.retry, logout: mocks.logout }),
}))

describe('Workspace selection', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mocks.replace.mockReset()
    mocks.retry.mockReset().mockResolvedValue(undefined)
    mocks.logout.mockReset().mockResolvedValue(undefined)
    mocks.search = new URLSearchParams()
    mocks.auth.status = 'authenticated'
    mocks.auth.error = null
    mocks.auth.isAuthenticated = true
    mocks.auth.organizations = [
      { id: 'org-a', name: 'Alpha Studio', slug: 'alpha-studio', created_at: '2026-01-01T00:00:00Z' },
      { id: 'org-b', name: 'Beta Labs', slug: 'beta-labs', created_at: '2026-01-02T00:00:00Z' },
    ]
  })

  afterEach(cleanup)

  it('persists the chosen workspace and continues to the requested page', async () => {
    mocks.search = new URLSearchParams('return_to=%2Fdashboard%2Fsettings')
    render(<SelectWorkspacePage />)

    fireEvent.click(screen.getByRole('button', { name: /Beta Labs/ }))

    expect(window.localStorage.getItem('guidekit.active_org_id')).toBe('org-b')
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/dashboard/settings'))
  })

  it('shows the previous valid workspace without opening it automatically', async () => {
    window.localStorage.setItem('guidekit.active_org_id', 'org-b')
    render(<SelectWorkspacePage />)

    const previousWorkspace = await screen.findByRole('button', { name: 'Open Beta Labs workspace' })
    expect(previousWorkspace.getAttribute('data-last-used')).toBe('true')
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('filters workspaces and keeps the results in a dedicated scroll area', () => {
    render(<SelectWorkspacePage />)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search workspaces' }), {
      target: { value: 'alpha' },
    })

    expect(screen.getByRole('button', { name: 'Open Alpha Studio workspace' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Open Beta Labs workspace' })).toBeNull()
    expect(screen.getByTestId('workspace-scroll-area').className).toContain('workspaceScrollArea')
  })

  it('skips selection when the account has one workspace', async () => {
    mocks.auth.organizations = [mocks.auth.organizations[0]]
    render(<SelectWorkspacePage />)

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/dashboard'))
    expect(window.localStorage.getItem('guidekit.active_org_id')).toBe('org-a')
  })

  it('keeps a failed workspace request recoverable', () => {
    mocks.auth.status = 'error'
    mocks.auth.error = 'The workspace service is unavailable.'
    mocks.auth.isAuthenticated = false
    mocks.auth.organizations = []
    render(<SelectWorkspacePage />)

    expect(screen.getByRole('alert').textContent).toContain('The workspace service is unavailable.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(mocks.retry).toHaveBeenCalledTimes(1)
  })
})
