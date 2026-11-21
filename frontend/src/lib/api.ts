'use client'

import { withTimeout } from './timeout'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1'
const REQUEST_TIMEOUT_MS = 10_000

type AuthTokenProvider = () => Promise<string | null>
let authTokenProvider: AuthTokenProvider = async () => null

export function setAuthTokenProvider(provider: AuthTokenProvider) {
  authTokenProvider = provider
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  skipAuth = false,
  explicitToken?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  const controller = new AbortController()
  try {
    return await withTimeout((async () => {
      if (!skipAuth) {
        const token = explicitToken || await authTokenProvider()
        if (token) headers['Authorization'] = `Bearer ${token}`
      }
      const res = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText })) as {
          detail?: string | { code?: string; message?: string }
        }
        const detail = body.detail
        const message = typeof detail === 'string' ? detail : detail?.message
        const code = typeof detail === 'object' ? detail?.code : undefined
        throw new ApiError(res.status, message || 'Request failed', code)
      }
      if (res.status === 204) return undefined as T
      return await res.json() as T
    })(), REQUEST_TIMEOUT_MS, 'request_timeout')
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof Error && (error.message === 'request_timeout' || error.name === 'AbortError')) {
      throw new ApiError(408, 'The request timed out. Check that the local API is running.', 'timeout')
    }
    throw new ApiError(0, 'Unable to reach the local GuideKit API.', 'network_error')
  } finally {
    controller.abort()
  }
}

export const api = {
  auth: {
    me: (token?: string) => request<import('./types').MeResponse>('/auth/me', {}, false, token),
  },
  orgs: {
    list: () => request<import('./types').Organization[]>('/orgs'),
    create: (data: { name: string; slug?: string }) =>
      request<import('./types').Organization>('/orgs', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: { name: string }) =>
      request<import('./types').Organization>(`/orgs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },
  projects: {
    list: (orgId?: string) =>
      request<import('./types').Project[]>(`/projects${orgId ? `?org_id=${encodeURIComponent(orgId)}` : ''}`),
    get: (id: string) => request<import('./types').Project>(`/projects/${id}`),
    patch: (id: string, data: Partial<import('./types').Project>) =>
      request<import('./types').Project>(`/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    create: (
      orgId: string,
      data: {
        name: string
        framework: string
        supported_locales: string[]
        default_locale: string
        environment?: import('./types').ProjectEnvironment
        background_id?: import('./types').ProjectBackgroundId
      }
    ) =>
      request<import('./types').Project>(`/orgs/${orgId}/projects`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  origins: {
    list: (projectId: string) =>
      request<import('./types').ProjectOrigin[]>(`/projects/${projectId}/origins`),
    create: (projectId: string, data: { origin: string; environment: string }) =>
      request<import('./types').ProjectOrigin>(`/projects/${projectId}/origins`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (projectId: string, originId: string) =>
      request<void>(`/projects/${projectId}/origins/${originId}`, { method: 'DELETE' }),
  },
  keys: {
    list: (projectId: string) =>
      request<import('./types').ApiKey[]>(`/projects/${projectId}/keys`),
    create: (projectId: string, data: { key_type: string; label?: string }) =>
      request<{ key: import('./types').ApiKey; full_key: string }>(`/projects/${projectId}/keys`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    revoke: (projectId: string, keyId: string) =>
      request<void>(`/projects/${projectId}/keys/${keyId}`, { method: 'DELETE' }),
  },
  deviceAuth: {
    inspect: (user_code: string) =>
      request<import('./types').DeviceAuthRequest>(
        `/device-auth/requests/${encodeURIComponent(user_code)}`
      ),
    approve: (user_code: string) =>
      request<{ status: string }>('/device-auth/approve', {
        method: 'POST',
        body: JSON.stringify({ user_code }),
      }),
    deny: (user_code: string) =>
      request<{ status: string }>('/device-auth/deny', {
        method: 'POST',
        body: JSON.stringify({ user_code }),
      }),
  },
  features: {
    list: (projectId: string) =>
      request<import('./types').FeatureSummary[]>(`/projects/${projectId}/features`),
    get: (projectId: string, featureId: string) =>
      request<import('./types').FeatureDetail>(`/projects/${projectId}/features/${featureId}`),
    patchVersion: (
      projectId: string,
      featureId: string,
      versionId: string,
      data: object
    ) =>
      request<import('./types').FeatureVersion>(
        `/projects/${projectId}/features/${featureId}/versions/${versionId}`,
        { method: 'PATCH', body: JSON.stringify(data) }
      ),
  },
  healSuggestions: {
    list: (projectId: string, status?: string) =>
      request<import('./types').HealSuggestion[]>(
        `/projects/${projectId}/heal-suggestions${status ? `?status=${status}` : ''}`
      ),
    review: (projectId: string, suggestionId: string, action: 'approve' | 'reject') =>
      request<{ id: string; status: string }>(
        `/projects/${projectId}/heal-suggestions/${suggestionId}/review`,
        { method: 'POST', body: JSON.stringify({ action }) }
      ),
  },
  analytics: {
    get: (projectId: string) =>
      request<import('./types').Analytics>(`/projects/${projectId}/analytics`),
  },
  publisher: {
    publish: (projectId: string, featureIds?: string[]) =>
      request<import('./types').ManifestPublishResult>(`/projects/${projectId}/publish`, {
        method: 'POST',
        body: JSON.stringify(featureIds ? { feature_ids: featureIds } : {}),
      }),
    syncWorkflows: (projectId: string, payload: unknown) =>
      request<import('./types').WorkflowSyncResult>(`/projects/${projectId}/workflows/sync`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },
  knowledge: {
    list: (projectId: string) =>
      request<import('./types').KnowledgeSourceItem[]>(`/projects/${projectId}/knowledge`),
    indexText: (projectId: string, data: { title: string; content: string; locale?: string }) =>
      request<{ indexed_chunks: number; source_id: string }>(
        `/projects/${projectId}/knowledge/text`,
        { method: 'POST', body: JSON.stringify(data) }
      ),
    upload: async (projectId: string, file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const token = await authTokenProvider()
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      let res: Response
      try {
        res = await fetch(`${API_URL}/projects/${projectId}/knowledge/upload`, {
          method: 'POST',
          headers,
          body: formData,
          signal: controller.signal,
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new ApiError(408, 'The upload timed out. Try again.', 'timeout')
        }
        throw new ApiError(0, 'Unable to reach the local GuideKit API.', 'network_error')
      } finally {
        window.clearTimeout(timeout)
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Upload failed' })) as { detail?: string }
        throw new ApiError(res.status, err.detail || 'Upload failed')
      }
      return res.json() as Promise<{ indexed_chunks: number; source_id: string; title: string }>
    },
    delete: (projectId: string, sourceId: string) =>
      request<void>(`/projects/${projectId}/knowledge/${sourceId}`, { method: 'DELETE' }),
  },
  sdk: {
    chat: (
      publishableKey: string,
      payload: {
        visitor_id: string
        session_id?: string
        message: string
        locale?: string
        current_path?: string
        auth_state?: { is_logged_in: boolean; role?: string | null }
      }
    ) =>
      request<import('./types').SDKChatResponse>(
        '/sdk/chat',
        {
          method: 'POST',
          headers: {
            'X-GuideKit-Key': publishableKey,
          },
          body: JSON.stringify(payload),
        },
        true
      ),
    heal: (
      publishableKey: string,
      payload: {
        step_id: string
        page_path: string
        dom_hash?: string
        locale?: string
        candidates: Array<{
          candidate_id: string
          tag: string
          role?: string
          text?: string
          accessible_name?: string
          css_selector: string
          attrs?: Record<string, unknown>
          landmark?: string
        }>
      }
    ) =>
      request<import('./types').SDKHealResponse>(
        '/sdk/heal',
        {
          method: 'POST',
          headers: {
            'X-GuideKit-Key': publishableKey,
          },
          body: JSON.stringify(payload),
        },
        true
      ),
  },
}

export const publishProjectManifest = api.publisher.publish
export const syncProjectWorkflows = api.publisher.syncWorkflows
