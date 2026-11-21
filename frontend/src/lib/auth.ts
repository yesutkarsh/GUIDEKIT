export function safeReturnTo(value: string | null | undefined, fallback = '/dashboard') {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback
  try {
    const url = new URL(value, 'http://localhost:3000')
    if (url.origin !== 'http://localhost:3000') return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

export function loginUrl(returnTo: string) {
  return `/login?${new URLSearchParams({ return_to: safeReturnTo(returnTo) }).toString()}`
}

export function onboardingUrl(returnTo: string) {
  return `/onboarding?${new URLSearchParams({ return_to: safeReturnTo(returnTo) }).toString()}`
}

export function workspaceSelectionUrl(returnTo: string) {
  return `/select-workspace?${new URLSearchParams({ return_to: safeReturnTo(returnTo) }).toString()}`
}
