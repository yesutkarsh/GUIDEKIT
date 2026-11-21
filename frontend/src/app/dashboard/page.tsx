'use client'

import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  FolderKanban,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { Alert } from '@heroui/react/alert'
import { Button } from '@heroui/react/button'
import { Tooltip } from '@heroui/react/tooltip'
import { toast } from '@heroui/react/toast'
import { useProjects } from '@/hooks/useProjects'
import { useDashboardWorkspace } from '@/contexts/DashboardWorkspaceContext'
import { useAuth } from '@/contexts/AuthContext'
import { ProjectCard } from '@/components/dashboard/ProjectCard'

export default function DashboardPage() {
  const { developer } = useAuth()
  const { activeOrganization } = useDashboardWorkspace()
  const { projects, isLoading, error, refetch } = useProjects(activeOrganization?.id ?? null)
  const [query, setQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const rawName = developer?.display_name || (developer?.email ? developer.email.split('@')[0] : 'there')
  const firstName = rawName.split(' ')[0]
  const capitalizedName = firstName.charAt(0).toUpperCase() + firstName.slice(1)

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return projects
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(normalized) ||
        project.slug.toLowerCase().includes(normalized)
    )
  }, [projects, query])

  const handleRefresh = async () => {
    const succeeded = await refetch()
    if (succeeded) toast.success('Projects refreshed.')
    else toast.danger('Projects could not be refreshed.')
  }

  const openSearch = () => {
    setIsSearchOpen(true)
    window.requestAnimationFrame(() => searchInputRef.current?.focus())
  }

  const closeSearch = () => {
    setQuery('')
    setIsSearchOpen(false)
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div>
          {/* <div className="mb-3 inline-flex items-center gap-2 font-mono text-[11px] text-[#8d97a8] select-none">
            <span className="h-1.5 w-1.5 rounded-full bg-[#52a9ff]" />
            <span>{activeOrganization?.name ?? 'Workspace'}</span>
          </div>
          <h1 className="text-[32px] font-medium leading-none tracking-[-0.025em] text-[#f1f4f9] sm:text-[38px]">
            Hi, {capitalizedName}!
          </h1> */}
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#b8c0ce]">
            {projects.length > 0
              ? `Manage your connected apps, translations, and environments in ${activeOrganization?.name ?? 'your workspace'}.`
              : `Welcome to ${activeOrganization?.name ?? 'your workspace'}. Connect your first app to get started.`}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          <div
            className={`relative h-11 overflow-hidden rounded-lg transition-[width] duration-200 ease-out ${isSearchOpen ? 'min-w-0 flex-1 sm:w-64 sm:flex-none' : 'w-11'
              }`}
          >
            {isSearchOpen ? (
              <>
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8d97a8]"
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') closeSearch()
                  }}
                  placeholder="Search projects"
                  aria-label="Search projects"
                  className="h-11 w-full rounded-lg border border-white/[0.12] bg-[#131820] pl-10 pr-10 text-[13px] text-[#f1f4f9] outline-none transition-colors placeholder:text-[#788395] hover:border-white/[0.2] focus:border-[#52a9ff] focus:ring-2 focus:ring-[#52a9ff]/20"
                />
                <button
                  type="button"
                  onClick={closeSearch}
                  className="absolute right-0 top-0 flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-[#8d97a8] transition-colors hover:bg-white/[0.07] hover:text-[#f1f4f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#52a9ff]/45"
                  aria-label="Close project search"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </>
            ) : (
              <Tooltip>
                <Tooltip.Trigger>
                  <Button
                    className="flex h-11 w-11 min-w-0 cursor-pointer items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] p-0 text-[#8d97a8] outline-none transition-colors hover:border-white/[0.14] hover:bg-white/[0.08] hover:text-white active:scale-95 focus-visible:ring-2 focus-visible:ring-[#52a9ff]/40"
                    isIconOnly
                    aria-label="Search projects"
                    onPress={openSearch}
                  >
                    <Search size={16} strokeWidth={1.75} aria-hidden="true" />
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content className="rounded border border-white/10 bg-[#181c24] px-2 py-1 text-xs text-white shadow-xl">
                  Search projects
                </Tooltip.Content>
              </Tooltip>
            )}
          </div>

          <Tooltip>
            <Tooltip.Trigger>
              <Button
                className="flex h-11 w-11 min-w-0 cursor-pointer items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] p-0 text-[#8d97a8] outline-none transition-colors hover:border-white/[0.14] hover:bg-white/[0.08] hover:text-white active:scale-95 focus-visible:ring-2 focus-visible:ring-[#52a9ff]/40 disabled:opacity-50"
                isIconOnly
                aria-label="Refresh projects"
                onPress={handleRefresh}
                isDisabled={isLoading}
              >
                <RefreshCw
                  size={15}
                  strokeWidth={1.75}
                  className={isLoading ? 'animate-spin text-[#52a9ff]' : ''}
                />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content className="rounded border border-white/10 bg-[#181c24] px-2 py-1 text-xs text-white shadow-xl">
              Refresh projects
            </Tooltip.Content>
          </Tooltip>

          {activeOrganization && (isLoading || projects.length > 0) ? (
            <Link
              href="/dashboard/projects/new"
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-[#182d50] px-3.5 text-[13px] font-semibold text-white outline-none transition-colors hover:bg-[#203d67] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[#52a9ff]/45"
            >
              <Plus size={15} strokeWidth={2} />
              <span>New project</span>
            </Link>
          ) : !activeOrganization ? (
            <Button
              isDisabled
              className="inline-flex h-11 shrink-0 cursor-not-allowed items-center gap-2 rounded-lg bg-[#353c49] px-3.5 text-[13px] font-medium text-white/45"
            >
              <Plus size={15} strokeWidth={2} />
              <span>New project</span>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex items-end justify-between gap-4 border-b border-[#2b3442] pb-3 pt-2">
        <h2 className="text-2xl font-medium tracking-[-0.02em] text-[#f1f4f9]">Projects</h2>
        <div className="flex items-center gap-2 text-xs font-medium text-[#b8c0ce] select-none">
          <span>
            {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'}
          </span>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Alert className="flex flex-col items-stretch justify-between gap-4 rounded-xl border border-red-400/25 bg-red-500/[0.08] p-4 text-red-200 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="shrink-0 text-red-300" />
            <div>
              <span className="block font-semibold text-sm">Projects could not be loaded</span>
              <span className="block text-xs text-red-200/75">{error}</span>
            </div>
          </div>
          <Button
            className="min-h-11 rounded-lg border border-red-300/20 bg-red-400/10 px-4 text-xs font-semibold text-red-100 transition-colors hover:bg-red-400/20"
            onPress={handleRefresh}
          >
            Retry
          </Button>
        </Alert>
      )}

      {/* Content Area */}
      {isLoading ? (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          aria-label="Loading projects"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-56 animate-pulse overflow-hidden rounded-xl border border-[#56657a] bg-[#171c25] p-0 motion-reduce:animate-none"
            >
              <div className="h-28 bg-[#283140]" />
              <div className="p-4 space-y-3">
                <div className="h-4 w-3/4 rounded bg-[#283140]" />
                <div className="h-3 w-1/2 rounded bg-[#222a36]" />
                <div className="flex justify-between border-t border-[#2b3442] pt-2">
                  <div className="h-3 w-16 rounded bg-[#222a36]" />
                  <div className="h-3 w-12 rounded bg-[#222a36]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.15] bg-white/[0.025] p-12 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#52a9ff]/[0.13] text-[#b9d9ff]">
            <FolderKanban size={22} strokeWidth={1.75} />
          </div>
          <h2 className="text-lg font-semibold text-[#f1f4f9]">
            No projects in {activeOrganization?.name ?? 'this workspace'}
          </h2>
          <p className="mt-1 mb-5 max-w-md text-sm text-[#b8c0ce]">
            Use the New project action to connect your website, SaaS, or app to GuideKit.
          </p>
          {activeOrganization && (
            <Link
              href="/dashboard/projects/new"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#182d50] px-4 text-[13px] font-semibold text-white outline-none transition-colors hover:bg-[#203d67] focus-visible:ring-2 focus-visible:ring-[#52a9ff]/45"
            >
              <Plus size={15} strokeWidth={2} />
              <span>Create your first project</span>
            </Link>
          )}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.15] bg-white/[0.025] p-10 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.05] text-[#b8c0ce]">
            <Search size={20} strokeWidth={1.75} />
          </div>
          <h2 className="text-base font-semibold text-[#f1f4f9]">No matching projects</h2>
          <p className="mt-1 mb-4 max-w-sm text-xs text-[#b8c0ce]">
            We couldn&apos;t find anything matching &ldquo;{query}&rdquo;. Check the spelling or try a different term.
          </p>
          <button
            type="button"
            onClick={() => setQuery('')}
            className="min-h-11 cursor-pointer rounded-lg border border-white/[0.1] bg-[#171c25] px-4 text-xs font-medium text-[#f1f4f9] outline-none transition-colors hover:bg-[#1b222d] focus-visible:ring-2 focus-visible:ring-[#52a9ff]/45"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
