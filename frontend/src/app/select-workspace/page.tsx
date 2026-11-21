'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Skeleton } from '@heroui/react/skeleton'
import { ArrowRight, Building2, Check, LogOut, Search } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { loginUrl, onboardingUrl, safeReturnTo } from '@/lib/auth'
import {
  getValidStoredWorkspaceId,
  storeWorkspaceId,
} from '@/lib/workspaceStorage'
import type { Organization } from '@/lib/types'
import styles from './WorkspaceSelection.module.css'

import { AlertCircle, Loader2 } from 'lucide-react'

const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40'

const secondaryButton =
  'inline-flex items-center justify-center rounded-lg border border-neutral-800 bg-transparent px-4 py-2 text-sm font-medium text-neutral-300 transition hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'

function WorkspaceSelectionFallback() {
  return (
    <main className={styles.page} data-theme="dark" aria-busy="true" aria-label="Loading workspaces">
      <section className={styles.panel}>
        <div className={styles.header}>
          <div>
            <Skeleton className={styles.loadingBrand} />
            <Skeleton className={styles.loadingTitle} />
          </div>
        </div>
        <Skeleton className={styles.loadingSearch} />
        <div className={styles.workspaceScrollArea} data-testid="workspace-scroll-area">
          <div className={styles.workspaceList}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className={styles.loadingWorkspace} />
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

function WorkspaceSelection() {
  const {
    status,
    organizations,
    error,
    retry,
    logout,
    isAuthenticated,
  } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = safeReturnTo(searchParams.get('return_to'))
  const [lastUsedId, setLastUsedId] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    setLastUsedId(getValidStoredWorkspaceId(organizations))
  }, [organizations])

  useEffect(() => {
    if (status === 'initializing' || status === 'provisioning' || status === 'redirecting_to_google') return
    if (status === 'error') return
    if (status === 'onboarding_required') {
      router.replace(onboardingUrl(returnTo))
      return
    }
    if (!isAuthenticated || status === 'unauthenticated') {
      router.replace(loginUrl(returnTo))
      return
    }
    if (organizations.length === 1) {
      storeWorkspaceId(organizations[0].id)
      router.replace(returnTo)
    }
  }, [isAuthenticated, organizations, returnTo, router, status])

  const filteredOrganizations = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return organizations
    return organizations.filter((organization) => (
      organization.name.toLowerCase().includes(normalized)
      || organization.slug.toLowerCase().includes(normalized)
    ))
  }, [organizations, query])

  const chooseWorkspace = (organization: Organization) => {
    if (openingId) return
    setOpeningId(organization.id)
    storeWorkspaceId(organization.id)
    router.replace(returnTo)
  }

  const loading = status === 'initializing'
    || status === 'provisioning'
    || status === 'redirecting_to_google'
    || (isAuthenticated && organizations.length === 1 && status !== 'error')

  if (loading) return <WorkspaceSelectionFallback />

  return (
    <>

      <main className="flex min-h-screen w-full items-center justify-center bg-neutral-950 px-6 py-10 antialiased">
        <section
          className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6"
          aria-labelledby="workspace-title"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs text-neutral-600">GuideKit</p>
              <h1 id="workspace-title" className="mt-1 text-2xl font-semibold tracking-tight text-white">
                Select workspace
              </h1>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              aria-label="Sign out"
              className="inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-white"
            >
              <LogOut size={15} strokeWidth={1.8} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>

          <label className="relative mt-6 flex items-center">
            <Search
              size={16}
              strokeWidth={1.75}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 text-neutral-600"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setQuery('')
              }}
              placeholder="Search workspaces"
              aria-label="Search workspaces"
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 py-2.5 pl-9 pr-10 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-neutral-600 focus:ring-2 focus:ring-neutral-700/50 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {status !== 'error' ? (
              <span
                className="pointer-events-none absolute right-3 font-mono text-xs text-neutral-600"
                aria-live="polite"
              >
                {filteredOrganizations.length}
              </span>
            ) : null}
          </label>

          <div className="mt-4 max-h-80 overflow-y-auto" data-testid="workspace-scroll-area">
            {status === 'error' ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2.5 text-sm text-red-300"
              >
                <AlertCircle size={16} strokeWidth={1.8} aria-hidden="true" className="mt-0.5 shrink-0" />
                <div className="flex flex-col gap-1">
                  <p className="font-medium text-red-300">Workspaces could not be loaded</p>
                  <p className="text-red-400">{error ?? 'Check your connection and try again.'}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={primaryButton} onClick={() => void retry()}>
                      Try again
                    </button>
                    <button type="button" className={secondaryButton} onClick={() => void logout()}>
                      Use another account
                    </button>
                  </div>
                </div>
              </div>
            ) : organizations.length === 0 ? (
              <div className="flex flex-col items-start gap-1 py-6">
                <Building2 size={21} strokeWidth={1.75} aria-hidden="true" className="mb-2 text-neutral-600" />
                <h2 className="text-sm font-medium text-white">No workspace is available</h2>
                <p className="text-sm leading-relaxed text-neutral-500">
                  Refresh your account access or use another Google account.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className={primaryButton} onClick={() => void retry()}>
                    Refresh access
                  </button>
                  <button type="button" className={secondaryButton} onClick={() => void logout()}>
                    Use another account
                  </button>
                </div>
              </div>
            ) : filteredOrganizations.length === 0 ? (
              <div className="flex flex-col items-start gap-1 py-6">
                <Search size={21} strokeWidth={1.75} aria-hidden="true" className="mb-2 text-neutral-600" />
                <h2 className="text-sm font-medium text-white">No matching workspaces</h2>
                <p className="text-sm leading-relaxed text-neutral-500">
                  Try a different workspace name or slug.
                </p>
                <button type="button" className={`${secondaryButton} mt-4`} onClick={() => setQuery('')}>
                  Clear search
                </button>
              </div>
            ) : (
              <ul
                className="divide-y divide-neutral-800 border-y border-neutral-800"
                aria-label="Available workspaces"
              >
                {filteredOrganizations.map((organization) => {
                  const isLastUsed = lastUsedId === organization.id
                  const isOpening = openingId === organization.id

                  return (
                    <li key={organization.id}>
                      <button
                        type="button"
                        onClick={() => chooseWorkspace(organization)}
                        disabled={openingId !== null}
                        aria-label={`Open ${organization.name} workspace`}
                        data-last-used={isLastUsed ? 'true' : undefined}
                        data-opening={isOpening ? 'true' : undefined}
                        className={`group flex w-full items-center justify-between gap-3 px-1 py-3 text-left transition-colors hover:bg-neutral-800/50 disabled:cursor-not-allowed ${isOpening ? 'disabled:opacity-100' : 'disabled:opacity-40'
                          }`}
                      >
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-sm font-medium text-white">{organization.name}</span>
                          <span className="truncate font-mono text-xs text-neutral-600">/{organization.slug}</span>
                        </span>
                        <span className="shrink-0 text-neutral-600 transition-colors group-hover:text-white" aria-hidden="true">
                          {isOpening ? (
                            <Loader2 size={17} strokeWidth={1.8} className="animate-spin text-neutral-300" />
                          ) : isLastUsed ? (
                            <Check size={17} strokeWidth={2} className="text-emerald-400" />
                          ) : (
                            <ArrowRight size={17} strokeWidth={1.8} />
                          )}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      </main>
    </>
  )
}

export default function SelectWorkspacePage() {
  return (
    <Suspense fallback={<WorkspaceSelectionFallback />}>
      <WorkspaceSelection />
    </Suspense>
  )
}
