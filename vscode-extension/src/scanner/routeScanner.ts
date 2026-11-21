import * as fs from 'fs'
import * as path from 'path'

export interface ScannedRoute {
  filePath: string
  routePattern: string
  requiresAuth: boolean
  requiredRole: string | null
  frameworkHint: 'sveltekit' | 'nextjs' | 'react' | 'generic'
}

/**
 * Normalizes a file path inside a web project into a standard web route pattern.
 */
export function fileToRoutePattern(relPath: string): string {
  // Normalize Windows slashes
  let p = relPath.replace(/\\/g, '/')

  // Remove common prefix dirs (src/routes, src/app, app, pages, src/pages)
  p = p.replace(/^(src\/routes|src\/app|app|pages|src\/pages)\/?/i, '')

  // Remove filename if it is +page.svelte, page.tsx, index.tsx, etc.
  p = p.replace(/\/?\+?page\.(svelte|tsx|jsx|js|ts)$/i, '')
  p = p.replace(/\/?index\.(svelte|tsx|jsx|js|ts|html)$/i, '')
  p = p.replace(/\.(svelte|tsx|jsx|js|ts|html)$/i, '')

  // SvelteKit route groups (e.g. (app)/dashboard -> dashboard)
  p = p.replace(/\([^)]+\)\/?/g, '')

  // SvelteKit rest params / dynamic params [id] -> :id or [id]
  let route = p ? (p.startsWith('/') ? p : `/${p}`) : '/'
  return route.replace(/\/+/g, '/')
}

/**
 * Scans file contents for client or server auth guards.
 */
export function detectAuthAndRole(content: string): { requiresAuth: boolean; requiredRole: string | null } {
  let requiresAuth = false
  let requiredRole: string | null = null

  // Auth guard indicators: session check, token check, redirect to /login, goto('/login')
  const authPatterns = [
    /goto\s*\(\s*['"]\/login['"]\s*\)/i,
    /redirect\s*\(\s*\d+\s*,\s*['"]\/login['"]\s*\)/i,
    /location\.href\s*=\s*['"]\/login['"]/i,
    /localStorage\.getItem\s*\(\s*['"](passenger_token|user_token|token|session|auth)['"]\s*\)/i,
    /if\s*\(\s*!session/i,
    /if\s*\(\s*!auth/i,
    /requires_auth|protected/i,
  ]

  for (const pat of authPatterns) {
    if (pat.test(content)) {
      requiresAuth = true
      break
    }
  }

  // Role indicators
  if (/role\s*[!=]==?\s*['"]driver['"]/i.test(content) || /['"]driver['"]\s*[!=]==?\s*role/i.test(content)) {
    requiredRole = 'driver'
    requiresAuth = true
  } else if (/role\s*[!=]==?\s*['"]passenger['"]/i.test(content) || /['"]passenger['"]\s*[!=]==?\s*role/i.test(content)) {
    requiredRole = 'passenger'
    requiresAuth = true
  } else if (/role\s*[!=]==?\s*['"]admin['"]/i.test(content)) {
    requiredRole = 'admin'
    requiresAuth = true
  }

  return { requiresAuth, requiredRole }
}

/**
 * Recursively scans directory for route files.
 */
export function scanRoutes(dirPath: string, rootDir: string = dirPath): ScannedRoute[] {
  const routes: ScannedRoute[] = []
  if (!fs.existsSync(dirPath)) return routes

  const entries = fs.readdirSync(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.svelte-kit' || entry.name === '.next' || entry.name === 'dist') {
        continue
      }
      routes.push(...scanRoutes(fullPath, rootDir))
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (['.svelte', '.tsx', '.jsx', '.html', '.vue'].includes(ext)) {
        const relPath = path.relative(rootDir, fullPath)
        const content = fs.readFileSync(fullPath, 'utf-8')
        const routePattern = fileToRoutePattern(relPath)
        const { requiresAuth, requiredRole } = detectAuthAndRole(content)

        let frameworkHint: ScannedRoute['frameworkHint'] = 'generic'
        if (relPath.includes('+page') || relPath.endsWith('.svelte')) frameworkHint = 'sveltekit'
        else if (relPath.includes('app/') || relPath.includes('pages/')) frameworkHint = 'nextjs'
        else if (ext === '.tsx' || ext === '.jsx') frameworkHint = 'react'

        routes.push({
          filePath: fullPath,
          routePattern,
          requiresAuth,
          requiredRole,
          frameworkHint,
        })
      }
    }
  }

  return routes.sort((a, b) => a.routePattern.localeCompare(b.routePattern))
}

