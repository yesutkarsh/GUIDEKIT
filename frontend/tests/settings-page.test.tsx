import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsPage from '@/app/dashboard/settings/page'

const mocks = vi.hoisted(() => ({
  renameOrganization: vi.fn().mockResolvedValue({
    id: 'org-1',
    name: 'Acme Studio',
    slug: 'acme-studio',
    created_at: '2026-01-01T00:00:00Z',
  }),
  developer: {
    id: 'dev-1',
    email: 'ayush@example.com',
    display_name: 'Ayush Kumar',
    auth_provider: 'google',
    created_at: '2026-01-01T00:00:00Z',
  },
  activeOrganization: {
    id: 'org-1',
    name: 'Acme Studio',
    slug: 'acme-studio',
    created_at: '2026-01-01T00:00:00Z',
  },
  toastSuccess: vi.fn(),
  toastDanger: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    developer: mocks.developer,
  }),
}))

vi.mock('@/contexts/DashboardWorkspaceContext', () => ({
  useDashboardWorkspace: () => ({
    activeOrganization: mocks.activeOrganization,
    renameOrganization: mocks.renameOrganization,
  }),
}))

vi.mock('@heroui/react/toast', () => ({
  toast: {
    success: mocks.toastSuccess,
    danger: mocks.toastDanger,
  },
}))

vi.mock('@/components/dashboard/WorkspaceDialog', () => ({
  WorkspaceDialog: ({ isOpen }: { isOpen: boolean }) => (
    isOpen ? <div role="dialog" aria-label="Create workspace">Create workspace dialog</div> : null
  ),
}))

describe('SettingsPage', () => {
  beforeEach(() => {
    mocks.renameOrganization.mockReset().mockResolvedValue(mocks.activeOrganization)
    mocks.toastSuccess.mockReset()
    mocks.toastDanger.mockReset()
  })

  afterEach(cleanup)

  it('shows Account by default and switches to one settings panel at a time', () => {
    render(<SettingsPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Account' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: 'Workspace' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'VS Code' })).toBeNull()
    expect(screen.getByText('Ayush Kumar')).toBeDefined()
    expect(screen.queryByText('Browser session')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Workspace' }))
    expect(screen.getByRole('heading', { name: 'Workspace' })).toBeDefined()
    expect(screen.getByText('acme-studio')).toBeDefined()
    expect(screen.queryByRole('heading', { name: 'Account' })).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'VS Code' }))
    expect(screen.getByRole('heading', { name: 'VS Code' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: 'Workspace' })).toBeNull()
  })

  it('supports keyboard navigation between settings tabs', () => {
    render(<SettingsPage />)

    const accountTab = screen.getByRole('tab', { name: 'Account' })
    fireEvent.keyDown(accountTab, { key: 'ArrowDown' })

    expect(screen.getByRole('tab', { name: 'Workspace' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('heading', { name: 'Workspace' })).toBeDefined()
  })

  it('enables save only for a changed workspace name', async () => {
    render(<SettingsPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Workspace' }))

    const input = screen.getByLabelText('Workspace name')
    const save = screen.getByRole('button', { name: 'Save changes' })
    expect(save.hasAttribute('disabled')).toBe(true)

    fireEvent.change(input, { target: { value: 'Product Studio' } })
    expect(save.hasAttribute('disabled')).toBe(false)
    fireEvent.click(save)

    await waitFor(() => expect(mocks.renameOrganization).toHaveBeenCalledWith('Product Studio'))
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Workspace name updated.')
  })

  it('keeps a rename failure visible beside the field', async () => {
    mocks.renameOrganization.mockRejectedValueOnce(new Error('Workspace name is unavailable.'))
    render(<SettingsPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Workspace' }))

    fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Taken name' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Workspace name is unavailable.')
  })

  it('opens workspace creation from the workspace panel', () => {
    render(<SettingsPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Workspace' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }))
    expect(screen.getByRole('dialog', { name: 'Create workspace' })).toBeDefined()
  })
})
