import type { Organization } from '@/lib/types'

export const ACTIVE_WORKSPACE_STORAGE_KEY = 'guidekit.active_org_id'

export function getStoredWorkspaceId() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)
  } catch {
    return null
  }
}

export function storeWorkspaceId(organizationId: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, organizationId)
  } catch {
    // A blocked storage API should not prevent the user from opening a workspace.
  }
}

export function clearStoredWorkspaceId() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY)
  } catch {
    // Sign-out should still complete if browser storage is unavailable.
  }
}

export function getValidStoredWorkspaceId(organizations: Organization[]) {
  const storedId = getStoredWorkspaceId()
  return storedId && organizations.some((organization) => organization.id === storedId)
    ? storedId
    : null
}
