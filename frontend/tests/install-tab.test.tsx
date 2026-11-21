import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiKey, Project, ProjectOrigin } from '@/lib/types'

const listKeys = vi.fn()
const listOrigins = vi.fn()

vi.mock('@/lib/api', () => ({
  api: {
    keys: {
      list: (...args: unknown[]) => listKeys(...args),
      create: vi.fn(),
      revoke: vi.fn(),
    },
    origins: {
      list: (...args: unknown[]) => listOrigins(...args),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('@heroui/react/toast', () => ({
  toast: { success: vi.fn(), danger: vi.fn() },
}))

import { InstallTab } from '@/components/project/InstallTab'

const project: Project = {
  id: 'project-1',
  org_id: 'org-1',
  name: 'Documentation demo',
  slug: 'documentation-demo',
  framework: 'nextjs',
  default_locale: 'en',
  supported_locales: ['en'],
  auth_detection_config: {},
  chat_settings: {},
  environment: 'development',
  background_id: 'blue-sky',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  archived_at: null,
}

const websiteKey: ApiKey = {
  id: 'key-1', project_id: project.id, key_type: 'publishable',
  key_prefix: 'gk_pk_live_test', key_plain: 'gk_pk_live_test_key',
  label: 'Website SDK', created_at: '2026-01-02T00:00:00Z',
  last_used_at: null, revoked_at: null,
}

const websiteOrigin: ProjectOrigin = {
  id: 'origin-1', project_id: project.id, origin: 'https://app.example.com',
  environment: 'production', created_at: '2026-01-02T00:00:00Z',
}

describe('InstallTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listKeys.mockResolvedValue([])
    listOrigins.mockResolvedValue([])
  })

  afterEach(cleanup)

  it('announces its loading state', () => {
    listKeys.mockReturnValue(new Promise(() => {}))
    listOrigins.mockReturnValue(new Promise(() => {}))
    render(<InstallTab project={project} />)
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true')
  })

  it('shows a focused empty setup flow', async () => {
    render(<InstallTab project={project} />)
    expect(await screen.findByRole('heading', { name: 'Install GuideKit' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Create website key' })).toBeDefined()
    expect(screen.getByLabelText('Origin URL')).toBeDefined()
    expect(screen.getByRole('tab', { name: 'npm package' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByText(/visitor auth|auth detection/i)).toBeNull()
  })

  it('keeps the error recoverable', async () => {
    listKeys.mockRejectedValueOnce(new Error('Network unavailable'))
    render(<InstallTab project={project} />)
    expect(await screen.findByText('Installation settings could not load')).toBeDefined()
    expect(screen.getByText('Network unavailable')).toBeDefined()
    expect(screen.getByRole('button', { name: /retry loading/i })).toBeDefined()
  })

  it('uses the project key in both installation methods when setup is ready', async () => {
    listKeys.mockResolvedValue([websiteKey])
    listOrigins.mockResolvedValue([websiteOrigin])
    render(<InstallTab project={project} />)

    await waitFor(() => expect(screen.getAllByText('gk_pk_live_test_key').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('tab', { name: 'CDN script' }))
    expect(screen.getByText(/data-guidekit-key="gk_pk_live_test_key"/)).toBeDefined()
    expect(screen.getByRole('tab', { name: 'CDN script' }).getAttribute('aria-selected')).toBe('true')
  })
})
