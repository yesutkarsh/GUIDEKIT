'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronRight, LogOut, Menu, Settings, X } from 'lucide-react'
import { Avatar } from '@heroui/react/avatar'
import { Drawer } from '@heroui/react/drawer'
import { Dropdown } from '@heroui/react/dropdown'
import { useAuth } from '@/contexts/AuthContext'
import { Sidebar } from './Sidebar'
import styles from '@/components/dashboard/DashboardShell.module.css'

function titleForPath(pathname: string) {
  if (pathname.startsWith('/dashboard/settings')) return 'Settings'
  if (pathname === '/dashboard/projects/new') return 'New project'
  if (pathname.startsWith('/dashboard/projects/')) return 'Project'
  return 'Dashboard'
}

export function TopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { developer, logout } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isProjectRoute = pathname.startsWith('/dashboard/projects')
  const title = titleForPath(pathname)
  const displayName = developer?.display_name || developer?.email || 'Developer'
  const initials = displayName.slice(0, 2).toUpperCase()

  const handleProfileAction = async (key: React.Key) => {
    if (key === 'settings') router.push('/dashboard/settings#account')
    if (key === 'logout') {
      await logout()
      router.replace('/login')
    }
  }

  return (
    <header className={styles.topBar}>
      <div className={styles.pageContext}>
        {!isProjectRoute && (
          <Drawer isOpen={drawerOpen} onOpenChange={setDrawerOpen}>
            <Drawer.Trigger className={styles.mobileMenuButton} aria-label="Open navigation"><Menu size={18} strokeWidth={1.75} /></Drawer.Trigger>
            <Drawer.Backdrop className={styles.drawerBackdrop} isDismissable>
              <Drawer.Content className={styles.drawerContent} placement="left">
                <Drawer.Dialog className={styles.drawerDialog} aria-label="Dashboard navigation">
                  <Drawer.Header style={{ position: 'absolute', right: 6, top: 6, zIndex: 2 }}>
                    <Drawer.CloseTrigger className={styles.drawerCloseButton} aria-label="Close navigation"><X size={18} strokeWidth={1.75} /></Drawer.CloseTrigger>
                  </Drawer.Header>
                  <Drawer.Body className={styles.drawerBody}><Sidebar onNavigate={() => setDrawerOpen(false)} /></Drawer.Body>
                </Drawer.Dialog>
              </Drawer.Content>
            </Drawer.Backdrop>
          </Drawer>
        )}
        <Link href="/dashboard" className={styles.pageContextLink}>GuideKit</Link>
        <ChevronRight className={styles.pageContextMuted} size={14} aria-hidden="true" />
        {isProjectRoute ? (
          <>
            <Link href="/dashboard" className={styles.pageContextLink}>Projects</Link>
            <ChevronRight className={styles.pageContextMuted} size={14} aria-hidden="true" />
            <span className={styles.pageTitle}>{title}</span>
          </>
        ) : (
          <span className={styles.pageTitle}>{title}</span>
        )}
      </div>

      <Dropdown>
        <Dropdown.Trigger className={styles.avatarButton} aria-label="Open account menu">
          <Avatar className={styles.avatar} size="sm"><Avatar.Fallback>{initials}</Avatar.Fallback></Avatar>
        </Dropdown.Trigger>
        <Dropdown.Popover className={styles.menuPopover} placement="bottom end">
          <div className={styles.profileHeader}>
            <div className={styles.profileName}>{displayName}</div>
            <div className={styles.profileEmail}>{developer?.email}</div>
          </div>
          <Dropdown.Menu aria-label="Account" onAction={handleProfileAction}>
            <Dropdown.Item id="settings" className={styles.menuItem} textValue="Account settings"><Settings size={16} /> Account settings</Dropdown.Item>
            <Dropdown.Item id="logout" className={`${styles.menuItem} ${styles.menuItemDanger}`} textValue="Sign out"><LogOut size={16} /> Sign out</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </header>
  )
}
