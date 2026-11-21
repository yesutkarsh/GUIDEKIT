import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Organization } from '@/lib/types'

const organizations: Organization[] = [
  { id: 'org-a', name: 'Alpha', slug: 'alpha', created_at: '2026-01-01T00:00:00Z' },
  { id: 'org-b', name: 'Beta', slug: 'beta', created_at: '2026-01-02T00:00:00Z' },
]

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ organizations, refresh: vi.fn() }),
}))

vi.mock('@/lib/api', () => ({
  api: { orgs: { create: vi.fn(), update: vi.fn() } },
}))

import { DashboardWorkspaceProvider, useDashboardWorkspace } from '@/contexts/DashboardWorkspaceContext'
import { api } from '@/lib/api'

function Probe() {
  const { activeOrganization, setActiveOrganization, createOrganization } = useDashboardWorkspace()
  return (
    <div>
      <output aria-label="active workspace">{activeOrganization?.id ?? 'none'}</output>
      <button onClick={() => setActiveOrganization(organizations[1])}>Choose Beta</button>
      <button onClick={() => void createOrganization('Gamma')}>Create Gamma</button>
    </div>
  )
}

describe('DashboardWorkspaceProvider', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(cleanup)

  it('waits for an explicit selection when multiple workspaces are available', async () => {
    render(<DashboardWorkspaceProvider><Probe /></DashboardWorkspaceProvider>)
    await waitFor(() => expect(screen.getByLabelText('active workspace').textContent).toBe('none'))
    expect(window.localStorage.getItem('guidekit.active_org_id')).toBeNull()
  })

  it('restores a valid persisted workspace', async () => {
    window.localStorage.setItem('guidekit.active_org_id', 'org-b')
    render(<DashboardWorkspaceProvider><Probe /></DashboardWorkspaceProvider>)
    await waitFor(() => expect(screen.getByLabelText('active workspace').textContent).toBe('org-b'))
  })

  it('rejects a stale persisted workspace', async () => {
    window.localStorage.setItem('guidekit.active_org_id', 'missing')
    render(<DashboardWorkspaceProvider><Probe /></DashboardWorkspaceProvider>)
    await waitFor(() => expect(screen.getByLabelText('active workspace').textContent).toBe('none'))
    expect(window.localStorage.getItem('guidekit.active_org_id')).toBeNull()
  })

  it('switches and persists the selected workspace', async () => {
    render(<DashboardWorkspaceProvider><Probe /></DashboardWorkspaceProvider>)
    await waitFor(() => expect(screen.getByLabelText('active workspace').textContent).toBe('none'))
    fireEvent.click(screen.getByRole('button', { name: 'Choose Beta' }))
    expect(screen.getByLabelText('active workspace').textContent).toBe('org-b')
    expect(window.localStorage.getItem('guidekit.active_org_id')).toBe('org-b')
  })

  it('keeps a newly created workspace active while the shared list refreshes', async () => {
    vi.mocked(api.orgs.create).mockResolvedValue({ id: 'org-c', name: 'Gamma', slug: 'gamma', created_at: '2026-01-03T00:00:00Z' })
    render(<DashboardWorkspaceProvider><Probe /></DashboardWorkspaceProvider>)
    await waitFor(() => expect(screen.getByLabelText('active workspace').textContent).toBe('none'))
    fireEvent.click(screen.getByRole('button', { name: 'Create Gamma' }))
    await waitFor(() => expect(screen.getByLabelText('active workspace').textContent).toBe('org-c'))
    expect(window.localStorage.getItem('guidekit.active_org_id')).toBe('org-c')
  })
})
