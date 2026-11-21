import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardPage from '@/app/dashboard/page'
import type { Project } from '@/lib/types'

const mocks = vi.hoisted(() => {
  const initialProjects: Project[] = [
    {
      id: 'proj-1',
      org_id: 'org-1',
      name: 'Marketing Site',
      slug: 'marketing-site',
      framework: 'nextjs',
      default_locale: 'en',
      supported_locales: ['en', 'es'],
      auth_detection_config: {},
      chat_settings: {},
      environment: 'production',
      background_id: 'blue-sky',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      archived_at: null,
    },
    {
      id: 'proj-2',
      org_id: 'org-1',
      name: 'Customer Portal',
      slug: 'customer-portal',
      framework: 'react',
      default_locale: 'en',
      supported_locales: ['en', 'fr'],
      auth_detection_config: {},
      chat_settings: {},
      environment: 'development',
      background_id: 'citron',
      created_at: '2026-01-03T00:00:00Z',
      updated_at: '2026-01-04T00:00:00Z',
      archived_at: null,
    },
  ]

  return {
    initialProjects,
    projects: initialProjects,
    isLoading: false,
    error: null as string | null,
    refetch: vi.fn().mockResolvedValue(true),
    developer: {
      id: 'dev-1',
      email: 'marco@guidekit.dev',
      display_name: 'Marco Rossi',
      auth_provider: 'google',
      created_at: '2026-01-01T00:00:00Z',
    },
    activeOrganization: {
      id: 'org-1',
      name: 'Acme Studio',
      slug: 'acme-studio',
      created_at: '2026-01-01T00:00:00Z',
    },
  }
})

vi.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({
    projects: mocks.projects,
    isLoading: mocks.isLoading,
    error: mocks.error,
    refetch: mocks.refetch,
  }),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    developer: mocks.developer,
    organizations: [mocks.activeOrganization],
    refresh: vi.fn(),
  }),
}))

vi.mock('@/contexts/DashboardWorkspaceContext', () => ({
  useDashboardWorkspace: () => ({
    activeOrganization: mocks.activeOrganization,
    setActiveOrganization: vi.fn(),
    createOrganization: vi.fn(),
  }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, className, ...props }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/dashboard/ProjectBackground', () => ({
  ProjectBackground: () => <div data-testid="project-background" />,
}))

describe('DashboardPage', () => {
  beforeEach(() => {
    mocks.projects = mocks.initialProjects
    mocks.isLoading = false
    mocks.error = null
  })

  afterEach(cleanup)

  it('greets the user by first name and shows the active workspace', () => {
    render(<DashboardPage />)

    expect(screen.getByText('Hi, Marco!')).toBeDefined()
    expect(screen.getByText('Acme Studio')).toBeDefined()
  })

  it('keeps the project list focused without overview metric cards', () => {
    render(<DashboardPage />)

    expect(screen.queryByText('Total Projects')).toBeNull()
    expect(screen.queryByText('Deployments')).toBeNull()
    expect(screen.queryByText('Localization')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeDefined()
  })

  it('renders project cards with framework and environment details', () => {
    render(<DashboardPage />)

    expect(screen.getByText('Marketing Site')).toBeDefined()
    expect(screen.getByText('marketing-site')).toBeDefined()
    expect(screen.getByText('Next.js')).toBeDefined()
    expect(screen.getByText('production')).toBeDefined()

    expect(screen.getByText('Customer Portal')).toBeDefined()
    expect(screen.getByText('customer-portal')).toBeDefined()
    expect(screen.getByText('React')).toBeDefined()
    expect(screen.getByText('development')).toBeDefined()
  })

  it('filters projects by search term', () => {
    render(<DashboardPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Search projects' }))
    const searchInput = screen.getByRole('searchbox', { name: 'Search projects' })
    fireEvent.change(searchInput, { target: { value: 'marketing' } })

    expect(screen.getByText('Marketing Site')).toBeDefined()
    expect(screen.queryByText('Customer Portal')).toBeNull()
  })

  it('triggers refresh when refresh button is pressed', async () => {
    render(<DashboardPage />)

    const refreshButton = screen.getByRole('button', { name: 'Refresh projects' })
    fireEvent.click(refreshButton)

    expect(mocks.refetch).toHaveBeenCalled()
  })
})
