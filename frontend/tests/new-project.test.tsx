import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Organization } from '@/lib/types'

const mockPush = vi.fn()
const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  usePathname: () => '/dashboard/projects/new',
}))

const activeOrganization: Organization = {
  id: 'org-test',
  name: 'Acme Corp',
  slug: 'acme-corp',
  created_at: '2026-01-01T00:00:00Z',
}

vi.mock('@/contexts/DashboardWorkspaceContext', () => ({
  useDashboardWorkspace: () => ({
    activeOrganization,
  }),
}))

const mockCreateProject = vi.fn().mockResolvedValue({
  id: 'proj-123',
  name: 'Acme App',
  slug: 'acme-app',
  framework: 'nextjs',
  default_locale: 'en',
  supported_locales: ['en'],
  environment: 'staging',
  background_id: 'untitled-blend',
})

vi.mock('@/lib/api', () => ({
  api: {
    projects: {
      create: (...args: unknown[]) => mockCreateProject(...args),
    },
  },
}))

vi.mock('@heroui/react/toast', () => ({
  toast: Object.assign(vi.fn().mockReturnValue('toast-id'), {
    update: vi.fn(),
  }),
}))

import NewProjectPage from '@/app/dashboard/projects/new/page'

describe('NewProjectPage (Multi-step)', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.clearAllMocks()
    mockCreateProject.mockResolvedValue({
      id: 'proj-123',
      name: 'Acme App',
      slug: 'acme-app',
      framework: 'nextjs',
      default_locale: 'en',
      supported_locales: ['en'],
      environment: 'staging',
      background_id: 'untitled-blend',
    })
  })

  afterEach(cleanup)

  it('renders Step 1 with project name, framework, and Astryx stepper', () => {
    render(<NewProjectPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'New project' })).toBeDefined()
    expect(screen.getByLabelText(/project name/i)).toBeDefined()
    expect(screen.getByLabelText(/framework/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /continue/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDefined()
  })

  it('validates project name before advancing to Step 2', async () => {
    render(<NewProjectPage />)
    const continueBtn = screen.getByRole('button', { name: /continue/i })
    fireEvent.click(continueBtn)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined()
      expect(screen.getByText(/enter a project name to continue/i)).toBeDefined()
    })
    // Still on step 0
    expect(screen.queryByRole('radiogroup', { name: /environment/i })).toBeNull()
  })

  it('advances to Step 2 when valid name is entered and allows back navigation', () => {
    render(<NewProjectPage />)
    const input = screen.getByLabelText(/project name/i)
    fireEvent.change(input, { target: { value: 'Acme App' } })

    const continueBtn = screen.getByRole('button', { name: /continue/i })
    fireEvent.click(continueBtn)

    // Now on step 1: Environment and Visual Identity
    expect(screen.getByRole('radiogroup', { name: /environment/i })).toBeDefined()
    expect(screen.getByText(/default language/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /create project/i })).toBeDefined()

    // Click Back to return to Step 0
    const backBtn = screen.getByRole('button', { name: /^back$/i })
    fireEvent.click(backBtn)

    expect(screen.getByLabelText(/project name/i)).toBeDefined()
    expect((screen.getByLabelText(/project name/i) as HTMLInputElement).value).toBe('Acme App')
  })

  it('allows clicking environment options seamlessly in Step 2', () => {
    render(<NewProjectPage />)
    const input = screen.getByLabelText(/project name/i)
    fireEvent.change(input, { target: { value: 'Acme App' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    const devOption = screen.getByRole('radio', { name: /development/i })
    const stagingOption = screen.getByRole('radio', { name: /staging/i })
    const prodOption = screen.getByRole('radio', { name: /production/i })

    expect(devOption.getAttribute('aria-checked')).toBe('true')
    expect(stagingOption.getAttribute('aria-checked')).toBe('false')

    // Click Staging
    fireEvent.click(stagingOption)
    expect(stagingOption.getAttribute('aria-checked')).toBe('true')
    expect(devOption.getAttribute('aria-checked')).toBe('false')

    // Click Production
    fireEvent.click(prodOption)
    expect(prodOption.getAttribute('aria-checked')).toBe('true')
    expect(stagingOption.getAttribute('aria-checked')).toBe('false')
  })

  it('supports keyboard navigation across environment options', () => {
    render(<NewProjectPage />)
    const input = screen.getByLabelText(/project name/i)
    fireEvent.change(input, { target: { value: 'Acme App' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    const devOption = screen.getByRole('radio', { name: /development/i })
    expect(devOption.getAttribute('aria-checked')).toBe('true')

    // ArrowRight moves to Staging
    fireEvent.keyDown(devOption, { key: 'ArrowRight' })
    const stagingOption = screen.getByRole('radio', { name: /staging/i })
    expect(stagingOption.getAttribute('aria-checked')).toBe('true')

    // ArrowRight moves to Production
    fireEvent.keyDown(stagingOption, { key: 'ArrowRight' })
    const prodOption = screen.getByRole('radio', { name: /production/i })
    expect(prodOption.getAttribute('aria-checked')).toBe('true')
  })

  it('allows clicking background themes to select them', () => {
    render(<NewProjectPage />)
    const input = screen.getByLabelText(/project name/i)
    fireEvent.change(input, { target: { value: 'Rocket App' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    const themeButtons = screen.getAllByRole('button', { name: /blend|mesh|grid|aurora|orbit/i })
    expect(themeButtons.length).toBeGreaterThan(0)

    // Click on a different theme
    fireEvent.click(themeButtons[0])
    expect(themeButtons[0].getAttribute('aria-pressed')).toBe('true')
  })

  it('submits valid project on Step 2 and redirects to project workspace', async () => {
    render(<NewProjectPage />)
    const input = screen.getByLabelText(/project name/i)
    fireEvent.change(input, { target: { value: 'Acme App' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    const stagingOption = screen.getByRole('radio', { name: /staging/i })
    fireEvent.click(stagingOption)

    const submitBtn = screen.getByRole('button', { name: /create project/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith('org-test', expect.objectContaining({
        name: 'Acme App',
        framework: 'nextjs',
        environment: 'staging',
        default_locale: 'en',
        supported_locales: ['en'],
      }))
      expect(mockReplace).toHaveBeenCalledWith('/dashboard/projects/proj-123')
    })
  })

  it('navigates back when cancel is clicked in Step 1', () => {
    render(<NewProjectPage />)
    const cancelBtn = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelBtn)
    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })
})
