import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardLayout from '@/app/dashboard/layout'

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  pathname: '/dashboard',
  auth: {
    isAuthenticated: true,
    isLoading: false,
    status: 'authenticated',
    organizations: [
      { id: 'org-a', name: 'Alpha', slug: 'alpha', created_at: '2026-01-01T00:00:00Z' },
      { id: 'org-b', name: 'Beta', slug: 'beta', created_at: '2026-01-02T00:00:00Z' },
    ],
  },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mocks.auth,
}))

vi.mock('@/contexts/DashboardWorkspaceContext', () => ({
  DashboardWorkspaceProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@astryxdesign/core/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@heroui/react/toast', () => ({
  Toast: { Provider: () => null },
}))

vi.mock('@/components/layout/Sidebar', () => ({ Sidebar: () => <div>Sidebar</div> }))
vi.mock('@/components/layout/TopBar', () => ({ TopBar: () => <div>Top bar</div> }))
vi.mock('@/components/auth/AuthRecovery', () => ({ AuthRecovery: () => <div>Auth recovery</div> }))

describe('Dashboard workspace access', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mocks.replace.mockReset()
    mocks.pathname = '/dashboard'
    mocks.auth.isAuthenticated = true
    mocks.auth.isLoading = false
    mocks.auth.status = 'authenticated'
    mocks.auth.organizations = [
      { id: 'org-a', name: 'Alpha', slug: 'alpha', created_at: '2026-01-01T00:00:00Z' },
      { id: 'org-b', name: 'Beta', slug: 'beta', created_at: '2026-01-02T00:00:00Z' },
    ]
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('requires a choice when a multi-workspace account has no saved selection', async () => {
    render(<DashboardLayout><div>Dashboard content</div></DashboardLayout>)

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/select-workspace?return_to=%2Fdashboard')
    })
    expect(screen.queryByText('Dashboard content')).toBeNull()
  })

  it('restores a valid saved workspace on refresh', async () => {
    window.localStorage.setItem('guidekit.active_org_id', 'org-b')
    render(<DashboardLayout><div>Dashboard content</div></DashboardLayout>)

    expect(await screen.findByText('Dashboard content')).toBeTruthy()
    expect(mocks.replace).not.toHaveBeenCalledWith(expect.stringContaining('/select-workspace'))
  })

  it('opens and remembers the only available workspace', async () => {
    mocks.auth.organizations = [mocks.auth.organizations[0]]
    render(<DashboardLayout><div>Dashboard content</div></DashboardLayout>)

    expect(await screen.findByText('Dashboard content')).toBeTruthy()
    expect(window.localStorage.getItem('guidekit.active_org_id')).toBe('org-a')
  })
})
