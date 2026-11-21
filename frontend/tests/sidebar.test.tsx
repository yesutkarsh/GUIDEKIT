import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Sidebar } from '@/components/layout/Sidebar'

const mocks = vi.hoisted(() => ({
  pathname: '/dashboard',
  organizations: [
    { id: 'org-1', name: 'Alpha Org', slug: 'alpha-org', created_at: '2026-01-01T00:00:00Z' },
    { id: 'org-2', name: 'Beta Org', slug: 'beta-org', created_at: '2026-01-02T00:00:00Z' },
  ],
  activeOrganization: { id: 'org-1', name: 'Alpha Org', slug: 'alpha-org', created_at: '2026-01-01T00:00:00Z' },
  setActiveOrganization: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, onClick, className, ...props }: React.ComponentProps<'a'> & { href: string }) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault()
        onClick?.(e)
      }}
      className={className}
      {...props}
    >
      {children}
    </a>
  ),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    organizations: mocks.organizations,
    refresh: vi.fn(),
  }),
}))

vi.mock('@/contexts/DashboardWorkspaceContext', () => ({
  useDashboardWorkspace: () => ({
    activeOrganization: mocks.activeOrganization,
    setActiveOrganization: mocks.setActiveOrganization,
    createOrganization: vi.fn(),
  }),
}))

describe('Sidebar component', () => {
  beforeEach(() => {
    mocks.pathname = '/dashboard'
  })

  afterEach(cleanup)

  it('renders workspace details and navigation links', () => {
    render(<Sidebar />)

    expect(screen.getByText('Alpha Org')).toBeDefined()
    expect(screen.queryByText('alpha-org')).toBeNull()

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeDefined()
    expect(screen.getByRole('link', { name: /settings/i })).toBeDefined()
    expect(screen.getByRole('link', { name: /connect vs code/i })).toBeDefined()
  })

  it('keeps the workspace selector visually minimal', () => {
    render(<Sidebar />)

    const trigger = screen.getByRole('button', { name: 'Switch workspace' })
    expect(trigger.className).toContain('bg-transparent')
    expect(trigger.className).not.toContain('border-neutral')
  })

  it('highlights Dashboard as active when on /dashboard with minimal non-card active styling', () => {
    mocks.pathname = '/dashboard'
    render(<Sidebar />)

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i })
    const settingsLink = screen.getByRole('link', { name: /settings/i })

    expect(dashboardLink.getAttribute('aria-current')).toBe('page')
    expect(settingsLink.getAttribute('aria-current')).toBeNull()

    // Active navigation follows the reference sidebar's translucent dark surface.
    expect(dashboardLink.className).toContain('bg-white/[0.12]')
    expect(dashboardLink.className).not.toContain('shadow')
    expect(dashboardLink.className).not.toContain('border-')

    // Inactive links remain readable without competing with the active route.
    expect(settingsLink.className).toContain('text-white/50')
  })

  it('highlights Settings as active when on /dashboard/settings', () => {
    mocks.pathname = '/dashboard/settings'
    render(<Sidebar />)

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i })
    const settingsLink = screen.getByRole('link', { name: /settings/i })

    expect(settingsLink.getAttribute('aria-current')).toBe('page')
    expect(dashboardLink.getAttribute('aria-current')).toBeNull()

    expect(settingsLink.className).toContain('bg-white/[0.12]')
    expect(settingsLink.className).not.toContain('shadow')
  })

  it('calls onNavigate callback when links are clicked', () => {
    const onNavigate = vi.fn()
    render(<Sidebar onNavigate={onNavigate} />)

    fireEvent.click(screen.getByRole('link', { name: /dashboard/i }))
    expect(onNavigate).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('link', { name: /connect vs code/i }))
    expect(onNavigate).toHaveBeenCalledTimes(2)
  })

  it('uses the minimal dark Tailwind shell without a decorative gradient', () => {
    const { container } = render(<Sidebar />)
    const aside = container.querySelector('aside')
    expect(aside).toBeDefined()
    expect(aside?.className).toContain('relative')
    expect(aside?.className).toContain('overflow-hidden')
    expect(aside?.className).toContain('bg-neutral-950')
    expect(aside?.querySelector('linearGradient')).toBeNull()
  })
})
