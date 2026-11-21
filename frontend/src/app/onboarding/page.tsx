'use client'

import { FormEvent, Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, Building2, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { loginUrl, safeReturnTo } from '@/lib/auth'
import { AuthRecovery } from '@/components/auth/AuthRecovery'

function OnboardingContent() {
  const { status, isAuthenticated, createWorkspace } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = safeReturnTo(searchParams.get('return_to'))
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.replace(loginUrl(`/onboarding?${new URLSearchParams({ return_to: returnTo })}`))
    if (status === 'authenticated') router.replace(returnTo)
  }, [returnTo, router, status])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const workspaceName = name.trim()
    if (!workspaceName || submitting) return
    setSubmitting(true)
    setError('')
    try {
      await createWorkspace(workspaceName)
      router.replace(returnTo)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Workspace creation failed.')
      setSubmitting(false)
    }
  }

  if (status === 'error') return <AuthRecovery />

  if (!isAuthenticated || status === 'initializing' || status === 'provisioning') {
    return <main className="auth-shell"><Loader2 className="auth-spinner" size={30} /></main>
  }

  return (
    <>
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-neutral-100">
        <section
          className="w-full max-w-sm rounded-2xl   p-8 "
          aria-labelledby="workspace-title"
        >


          <p id="workspace-title" className="text-xl tracking-tight text-white">
            Name your workspace
          </p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">
            This is the organization your dashboard and VS Code projects will share.
          </p>

          {error ? (
            <div
              className="mt-5 flex items-start gap-2 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2.5 text-sm text-red-300"
              role="alert"
            >
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              {error}
            </div>
          ) : null}

          <form onSubmit={submit} className="mt-6 flex flex-col gap-2">
            <label htmlFor="workspace-name" className="text-xs font-medium text-neutral-400">
              Workspace name
            </label>
            <input
              id="workspace-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              placeholder="Acme Product Team"
              autoFocus
              required
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 outline-none transition focus:border-neutral-600 focus:ring-2 focus:ring-neutral-700/50"
            />
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Building2 size={18} />
              )}
              {submitting ? 'Creating workspace…' : 'Create workspace'}
            </button>
          </form>
        </section>
      </main>
    </>
  )
}

export default function OnboardingPage() {
  return <Suspense fallback={<main className="auth-shell"><Loader2 className="auth-spinner" size={30} /></main>}><OnboardingContent /></Suspense>
}
