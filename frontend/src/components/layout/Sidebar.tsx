'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Check, ChevronDown, LayoutDashboard, Plus, Plug, Settings } from 'lucide-react'
import { Dropdown } from '@heroui/react/dropdown'
import { useAuth } from '@/contexts/AuthContext'
import { useDashboardWorkspace } from '@/contexts/DashboardWorkspaceContext'
import { WorkspaceDialog } from '@/components/dashboard/WorkspaceDialog'

interface SidebarProps {
  onNavigate?: () => void
  className?: string
}

export function Sidebar({ onNavigate, className }: SidebarProps) {
  const pathname = usePathname()
  const { organizations } = useAuth()
  const { activeOrganization, setActiveOrganization } = useDashboardWorkspace()
  const [createOpen, setCreateOpen] = useState(false)

  const dashboardActive = pathname === '/dashboard' || pathname.startsWith('/dashboard/projects/')
  const settingsActive = pathname.startsWith('/dashboard/settings')

  const handleWorkspaceAction = (key: React.Key) => {
    if (key === 'create') {
      setCreateOpen(true)
      return
    }
    const organization = organizations.find((item) => item.id === String(key))
    if (organization) setActiveOrganization(organization)
  }

  const navItems = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      isActive: dashboardActive,
    },
    {
      href: '/dashboard/settings',
      label: 'Settings',
      icon: Settings,
      isActive: settingsActive,
    },
  ]

  return (
    <>
      <aside
        className={`relative flex h-full w-full select-none overflow-hidden border-r border-neutral-900 bg-neutral-950 text-white antialiased ${className ?? ''}`}
        aria-label="Sidebar navigation"
      >
        <div className="flex h-full min-h-0 w-full flex-col">
          <div className="border-b border-neutral-900 p-3 max-[899px]:pr-14">
            <Dropdown>
              <Dropdown.Trigger
                className="group flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg bg-transparent px-2 text-left text-white outline-none transition-colors hover:bg-white/[0.06] aria-expanded:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-white/60"
                aria-label="Switch workspace"
              >
                <span className="grid h-7 w-7 flex-none place-items-center text-[11px] font-medium tracking-tight text-neutral-400">
                  {activeOrganization?.name.slice(0, 1).toUpperCase() ?? 'W'}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-none text-neutral-200">
                  {activeOrganization?.name ?? 'Select workspace'}
                </span>
                <ChevronDown
                  size={15}
                  strokeWidth={1.75}
                  className="shrink-0 text-neutral-500 transition-colors group-hover:text-neutral-200"
                  aria-hidden="true"
                />
              </Dropdown.Trigger>
              <Dropdown.Popover
                className="z-50 min-w-[224px] rounded-lg border border-neutral-800 bg-neutral-950 p-1 text-white shadow-xl shadow-black/40"
                placement="bottom start"
              >
                <div className="select-none px-2.5 pb-1 pt-1.5 font-mono text-[10px] text-neutral-400">
                  Switch workspace
                </div>
                <Dropdown.Menu aria-label="Workspaces" onAction={handleWorkspaceAction} className="outline-none">
                  {organizations.map((organization) => (
                    <Dropdown.Item
                      id={organization.id}
                      key={organization.id}
                      className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2.5 text-[13px] text-neutral-300 outline-none transition-colors hover:bg-neutral-900 hover:text-white data-[focused]:bg-neutral-900 data-[focused]:text-white data-[focus-visible=true]:!shadow-none data-[focus-visible=true]:bg-neutral-900"
                      textValue={organization.name}
                    >
                      <span className="min-w-0 flex-1 truncate font-medium leading-none">{organization.name}</span>
                      {organization.id === activeOrganization?.id && (
                        <Check className="ml-auto shrink-0 text-neutral-300" size={14} strokeWidth={2} aria-label="Current workspace" />
                      )}
                    </Dropdown.Item>
                  ))}
                  <Dropdown.Item
                    id="create"
                    className="relative mt-1 flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2.5 pt-1 text-[12px] font-medium text-neutral-400 outline-none transition-colors before:absolute before:inset-x-2.5 before:top-0 before:h-px before:bg-neutral-800 hover:bg-neutral-900 hover:text-white data-[focused]:bg-neutral-900 data-[focused]:text-white data-[focus-visible=true]:!shadow-none data-[focus-visible=true]:bg-neutral-900"
                    textValue="Create workspace"
                  >
                    <Plus size={14} className="shrink-0" strokeWidth={1.75} />
                    <span>Create workspace</span>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>

          <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-3" aria-label="Main navigation">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={item.isActive ? 'page' : undefined}
                  className={`group flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/60 ${item.isActive
                      ? 'bg-white/[0.12] text-white'
                      : 'text-white/50 hover:bg-white/[0.06] hover:text-neutral-200'
                    }`}
                >
                  <Icon
                    size={16}
                    strokeWidth={1.75}
                    className={`shrink-0 transition-colors ${item.isActive
                        ? 'text-white'
                        : 'text-neutral-600 group-hover:text-neutral-300'
                      }`}
                    aria-hidden="true"
                  />
                  <span className="truncate leading-none">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="border-t border-neutral-900 p-3">
            <Link
              className="group flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium text-white/50 outline-none transition-colors hover:bg-white/[0.06] hover:text-neutral-200 focus-visible:ring-2 focus-visible:ring-white/60"
              href="/device"
              onClick={onNavigate}
            >
              <Plug
                size={16}
                strokeWidth={1.75}
                className="shrink-0 text-neutral-600 transition-colors group-hover:text-neutral-300"
                aria-hidden="true"
              />
              <span className="truncate leading-none">Connect VS Code</span>
            </Link>
          </div>
        </div>
      </aside>

      <WorkspaceDialog isOpen={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}
