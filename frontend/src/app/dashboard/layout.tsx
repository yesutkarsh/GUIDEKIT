'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AppShell } from '@astryxdesign/core/AppShell'
import { Spinner } from '@heroui/react/spinner'
import { Toast } from '@heroui/react/toast'
import { useAuth } from '@/contexts/AuthContext'
import { DashboardWorkspaceProvider } from '@/contexts/DashboardWorkspaceContext'
import { loginUrl, onboardingUrl, workspaceSelectionUrl } from '@/lib/auth'
import {
  clearStoredWorkspaceId,
  getValidStoredWorkspaceId,
  storeWorkspaceId,
} from '@/lib/workspaceStorage'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { AuthRecovery } from '@/components/auth/AuthRecovery'
import styles from '@/components/dashboard/DashboardShell.module.css'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, organizations, status } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [isMobile, setIsMobile] = useState(false)
  const [workspaceAccessReady, setWorkspaceAccessReady] = useState(false)
  const isProjectRoute = pathname.startsWith('/dashboard/projects')

  useEffect(() => {
    const media = window.matchMedia('(max-width: 899px)')
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    document.documentElement.classList.add('dashboard-active')
    document.body.classList.add('dashboard-active')
    return () => {
      document.documentElement.classList.remove('dashboard-active')
      document.body.classList.remove('dashboard-active')
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.replace(loginUrl('/dashboard'))
    if (status === 'onboarding_required') router.replace(onboardingUrl('/dashboard'))
  }, [router, status])

  useEffect(() => {
    if (status !== 'authenticated' || !isAuthenticated) {
      setWorkspaceAccessReady(false)
      return
    }

    const returnTo = `${pathname}${window.location.search}${window.location.hash}`

    if (organizations.length === 0) {
      clearStoredWorkspaceId()
      setWorkspaceAccessReady(false)
      router.replace(workspaceSelectionUrl(returnTo))
      return
    }

    if (organizations.length === 1) {
      storeWorkspaceId(organizations[0].id)
      setWorkspaceAccessReady(true)
      return
    }

    if (getValidStoredWorkspaceId(organizations)) {
      setWorkspaceAccessReady(true)
      return
    }

    clearStoredWorkspaceId()
    setWorkspaceAccessReady(false)
    router.replace(workspaceSelectionUrl(returnTo))
  }, [isAuthenticated, organizations, pathname, router, status])

  if (status === 'error') return <AuthRecovery />
  if (isLoading || (isAuthenticated && !workspaceAccessReady)) {
    return <div className={styles.shell} style={{ display: 'grid', minHeight: '100vh', placeItems: 'center' }}><Spinner aria-label="Loading dashboard" /></div>
  }
  if (!isAuthenticated) return null

  return (
    <DashboardWorkspaceProvider>
      <Toast.Provider placement="bottom end" maxVisibleToasts={3} />
      <AppShell
        className={styles.shell}
        data-astryx-theme="neutral"
        variant="surface"
        height="fill"
        contentPadding={0}
        mobileNav={false}
        sideNav={isMobile || isProjectRoute ? undefined : <div className={styles.desktopSide}><Sidebar /></div>}
        topNav={<TopBar />}
      >
        <div className={`${styles.main} ${isProjectRoute ? styles.projectMain : ''}`}>{children}</div>
      </AppShell>
    </DashboardWorkspaceProvider>
  )
}
