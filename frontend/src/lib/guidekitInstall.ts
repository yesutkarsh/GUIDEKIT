const dashboardApiUrl =
  process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1'

function sdkScriptFromApi(apiUrl: string): string {
  try {
    const url = new URL(apiUrl)
    return `${url.origin}/sdk/guidekit-sdk.js`
  } catch {
    return 'http://127.0.0.1:8000/sdk/guidekit-sdk.js'
  }
}

export const GUIDEKIT_PACKAGE_NAME = '@guidekit/sdk'
export const GUIDEKIT_API_URL = dashboardApiUrl.replace(/\/+$/, '')
export const GUIDEKIT_SCRIPT_URL =
  process.env.NEXT_PUBLIC_GUIDEKIT_SCRIPT_URL || sdkScriptFromApi(GUIDEKIT_API_URL)

export function originEnvironment(origin: string): 'development' | 'production' {
  try {
    const hostname = new URL(origin).hostname
    return hostname === 'localhost' || hostname === '127.0.0.1'
      ? 'development'
      : 'production'
  } catch {
    return 'production'
  }
}
