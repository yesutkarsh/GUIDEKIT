'use client'

import { useEffect, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import Link from 'next/link'
import { Plus, Plug } from 'lucide-react'
import { Avatar } from '@heroui/react/avatar'
import { Button } from '@heroui/react/button'
import { Input } from '@heroui/react/input'
import { toast } from '@heroui/react/toast'
import { useAuth } from '@/contexts/AuthContext'
import { useDashboardWorkspace } from '@/contexts/DashboardWorkspaceContext'
import { WorkspaceDialog } from '@/components/dashboard/WorkspaceDialog'

const settingsSections = [
  { id: 'account', label: 'Account' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'vscode', label: 'VS Code' },
] as const

type SettingsSection = (typeof settingsSections)[number]['id']

export default function SettingsPage() {
  const { developer } = useAuth()
  const { activeOrganization, renameOrganization } = useDashboardWorkspace()
  const [activeSection, setActiveSection] = useState<SettingsSection>('account')
  const [name, setName] = useState(activeOrganization?.name ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [renameError, setRenameError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    setName(activeOrganization?.name ?? '')
    setRenameError('')
  }, [activeOrganization])

  const normalizedName = name.trim()
  const canRename = Boolean(
    activeOrganization &&
    normalizedName &&
    normalizedName !== activeOrganization.name &&
    !isSaving
  )

  const handleRename = async (event: FormEvent) => {
    event.preventDefault()
    if (!canRename) return

    setIsSaving(true)
    setRenameError('')
    try {
      await renameOrganization(normalizedName)
      toast.success('Workspace name updated.')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to rename workspace.'
      setRenameError(message)
      toast.danger(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) => {
    let nextIndex: number | null = null

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % settingsSections.length
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + settingsSections.length) % settingsSections.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = settingsSections.length - 1
    }

    if (nextIndex === null) return

    event.preventDefault()
    const nextSection = settingsSections[nextIndex]
    setActiveSection(nextSection.id)
    document.getElementById(`settings-tab-${nextSection.id}`)?.focus()
  }

  const displayName = developer?.display_name || developer?.email || 'Developer'
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div className="mx-auto w-full max-w-5xl pb-12">
      <header className="pb-6">
        <h1 className="text-[32px] font-medium leading-none tracking-[-0.025em] text-[#f1f4f9] sm:text-[38px]">
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#b8c0ce]">
          Manage your account, workspace details, and editor connection.
        </p>
      </header>

      <div className="grid gap-6 pt-4 lg:grid-cols-[176px_minmax(0,1fr)] lg:items-start lg:gap-10 lg:pt-6">
        <div
          className="relative flex gap-1 overflow-x-auto pb-3 lg:h-fit lg:flex-col lg:overflow-visible lg:pb-0"
          role="tablist"
          aria-label="Settings sections"
        >
          <span className="absolute inset-x-0 bottom-0 h-px bg-[#2b3442] lg:hidden" aria-hidden="true" />
          {settingsSections.map((section, index) => {
            const isActive = activeSection === section.id

            return (
              <button
                key={section.id}
                type="button"
                id={`settings-tab-${section.id}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`settings-panel-${section.id}`}
                tabIndex={isActive ? 0 : -1}
                className={`relative inline-flex min-h-11 shrink-0 items-center justify-start rounded-none bg-transparent px-3 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#52a9ff] lg:w-full lg:px-4 ${isActive
                  ? 'text-[#f1f4f9]'
                  : 'text-[#8d97a8] hover:bg-white/[0.04] hover:text-[#d7dce5]'
                  }`}
                onClick={() => setActiveSection(section.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-3 -bottom-3 h-px bg-[#52a9ff] transition-opacity lg:inset-x-auto lg:inset-y-2 lg:left-0 lg:h-auto lg:w-px ${isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                />
                {section.label}
              </button>
            )
          })}
        </div>

        <div className="min-w-0 max-w-3xl">
          {activeSection === 'account' && (
            <section
              id="settings-panel-account"
              role="tabpanel"
              aria-labelledby="settings-tab-account"
              tabIndex={0}
              className="outline-none focus-visible:ring-2 focus-visible:ring-[#52a9ff]"
            >
              <header className="flex min-h-11 items-center">
                <h2 className="text-base font-medium text-[#f1f4f9]">Account</h2>
              </header>

              <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#b8c0ce]">
                Your GuideKit identity and sign-in details.
              </p>

              <div className="mt-8 flex min-w-0 items-center gap-3">
                <Avatar className="h-11 w-11 shrink-0 bg-[#263246] text-sm font-medium text-[#d8ebff]" size="lg">
                  <Avatar.Fallback>{initials}</Avatar.Fallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[#f1f4f9]">{displayName}</div>
                  <div className="mt-1 truncate text-xs text-[#8d97a8]">{developer?.email}</div>
                </div>
              </div>

              <dl className="mt-8 grid max-w-2xl gap-6 border-t border-[#2b3442] pt-6 sm:grid-cols-2 sm:gap-8">
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-[#8d97a8]">Verified email</dt>
                  <dd className="mt-2 truncate text-[13px] text-[#f1f4f9]">{developer?.email || 'Not available'}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-[#8d97a8]">Sign-in provider</dt>
                  <dd className="mt-2 text-[13px] text-[#f1f4f9]">Google</dd>
                </div>
              </dl>
            </section>
          )}

          {activeSection === 'workspace' && (
            <section
              id="settings-panel-workspace"
              role="tabpanel"
              aria-labelledby="settings-tab-workspace"
              tabIndex={0}
              className="outline-none focus-visible:ring-2 focus-visible:ring-[#52a9ff]"
            >
              <header className="flex min-h-11 items-center">
                <h2 className="text-base font-medium text-[#f1f4f9]">Workspace</h2>
              </header>
              <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#b8c0ce]">
                Update the active workspace or create another for a separate product or team.
              </p>

              {!activeOrganization && (
                <p className="mt-6 border-y border-[#2b3442] py-4 text-[13px] text-[#b8c0ce]" role="status">
                  No active workspace is selected. Create one to manage its settings here.
                </p>
              )}

              <form className="mt-8 max-w-2xl" onSubmit={handleRename} noValidate>
                <label
                  htmlFor="settings-workspace-name"
                  className="text-xs font-medium text-[#b8c0ce]"
                >
                  Workspace name
                </label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <Input
                      id="settings-workspace-name"
                      className="min-h-11 w-full rounded-lg border border-[#3f4c60] bg-[#0b0e13] px-3 text-sm text-[#f1f4f9] outline-none transition-colors placeholder:text-[#8d97a8] hover:border-[#56657a] focus:border-[#52a9ff] focus:ring-2 focus:ring-[#52a9ff]/25 disabled:cursor-not-allowed disabled:bg-[#131820] disabled:text-[#8d97a8]"
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value)
                        if (renameError) setRenameError('')
                      }}
                      maxLength={120}
                      disabled={!activeOrganization || isSaving}
                      aria-invalid={Boolean(renameError)}
                      aria-describedby={renameError ? 'workspace-name-error' : 'workspace-name-hint'}
                    />
                  </div>
                  <Button
                    className="min-h-11 w-full shrink-0 rounded-lg bg-[#182d50] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#203d67] focus-visible:ring-2 focus-visible:ring-[#52a9ff] disabled:cursor-not-allowed disabled:bg-[#283140] disabled:text-[#8d97a8] sm:w-auto"
                    type="submit"
                    isDisabled={!canRename}
                  >
                    {isSaving ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
                {renameError ? (
                  <p id="workspace-name-error" className="mt-2 text-xs text-red-300" role="alert">
                    {renameError}
                  </p>
                ) : (
                  <p id="workspace-name-hint" className="mt-2 text-[11px] text-[#8d97a8]">
                    Up to 120 characters.
                  </p>
                )}
              </form>



              <div className="mt-8 flex max-w-2xl flex-col gap-4 border-t border-[#2b3442] pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[#f1f4f9]">Create another workspace</p>
                  <p className="mt-1 text-xs leading-5 text-[#8d97a8]">Keep products or teams separated.</p>
                </div>
                <Button
                  className="min-h-11 w-full shrink-0 rounded-lg bg-transparent px-4 text-[13px] font-medium text-[#d4d4d4] transition-colors hover:bg-[#1b222d] hover:text-white focus-visible:ring-2 focus-visible:ring-[#52a9ff] sm:w-auto"
                  onPress={() => setCreateOpen(true)}
                >
                  <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
                  Create workspace
                </Button>
              </div>
            </section>
          )}

          {activeSection === 'vscode' && (
            <section
              id="settings-panel-vscode"
              role="tabpanel"
              aria-labelledby="settings-tab-vscode"
              tabIndex={0}
              className="outline-none focus-visible:ring-2 focus-visible:ring-[#52a9ff]"
            >
              <header className="flex min-h-11 items-center">
                <h2 className="text-base font-medium text-[#f1f4f9]" data-guide-id="untitled-flow-step-2">VS Code</h2>
              </header>
              <div className="mt-1 flex max-w-2xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <p className="max-w-xl text-[13px] leading-5 text-[#b8c0ce]" data-guide-id="untitled-flow-step-1">
                  Connect the GuideKit extension through the secure browser authorization flow. Website and extension sessions stay independent.
                </p>
                <Link
                  href="/device"
                  className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-[#182d50] px-4 text-[13px] font-medium text-white outline-none transition-colors hover:bg-[#203d67] focus-visible:ring-2 focus-visible:ring-[#52a9ff] sm:w-auto"
                >
                  <Plug size={16} strokeWidth={1.75} aria-hidden="true" />
                  Connect VS Code
                </Link>
              </div>
            </section>
          )}
        </div>
      </div>

      <WorkspaceDialog isOpen={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
