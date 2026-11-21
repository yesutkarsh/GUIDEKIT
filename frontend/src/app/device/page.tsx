'use client'

import { FormEvent, ReactNode, Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, ShieldCheck, Terminal, XCircle } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { DeviceAuthRequest } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'
import { loginUrl, onboardingUrl } from '@/lib/auth'

const VSCODE_RETURN_URI = 'vscode://guidekit.guidekit-vscode/auth-complete'

const primaryAction = 'inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-lg border border-[#182d50] bg-[#182d50] px-4 text-[13px] font-medium text-white no-underline transition-colors duration-150 hover:border-[#203d67] hover:bg-[#203d67] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52a9ff] disabled:cursor-wait disabled:border-white/[0.12] disabled:bg-[#131820] disabled:text-[#8d97a8] motion-reduce:transform-none motion-reduce:transition-none'
const secondaryAction = 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/[0.16] bg-[#171c25] px-4 text-[12px] font-medium text-[#f1f4f9] no-underline transition-colors duration-150 hover:bg-[#1b222d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52a9ff] disabled:cursor-not-allowed disabled:text-[#8d97a8] motion-reduce:transition-none'

function formatCode(value: string) {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8)
  return cleaned.length > 4 ? `${cleaned.slice(0, 4)}-${cleaned.slice(4)}` : cleaned
}

function GuideKitMark() {
  return (
    <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.10] bg-[#131820] text-[#52a9ff]" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="m15.8 8.2-2 5.6-5.6 2 2-5.6 5.6-2Z" fill="currentColor" stroke="none" />
      </svg>
    </div>
  )
}

function DeviceShell({ children, live = true }: { children: ReactNode; live?: boolean }) {
  return (
    <main className="min-h-screen min-h-[100dvh] overflow-x-hidden bg-[#0b0e13] px-6 py-8 font-[var(--font-inter)] text-[#f1f4f9] antialiased [--font-family-body:var(--font-inter)]">
      <section className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[420px] flex-col items-center justify-center text-center">

        <div className="mt-10 w-full" aria-live={live ? 'polite' : undefined}>
          {children}
        </div>
      </section>
    </main>
  )
}

function StateIcon({ tone, children }: { tone: 'blue' | 'red'; children: ReactNode }) {
  return (
    <span className={`mx-auto grid h-10 w-10 place-items-center rounded-full ${tone === 'red' ? 'bg-red-400/[0.10] text-[#f87171]' : 'bg-[rgba(82,169,255,0.14)] text-[#52a9ff]'}`} aria-hidden="true">
      {children}
    </span>
  )
}

function StateHeading({ children }: { children: ReactNode }) {
  return <h2 className="mt-5 !font-sans text-[20px] !font-medium tracking-[-0.025em] text-[#f1f4f9]">{children}</h2>
}

function StateDescription({ children }: { children: ReactNode }) {
  return <p className="mx-auto mt-2 max-w-[380px] text-[13px] leading-5 text-[#b8c0ce]">{children}</p>
}

function LoadingState({ takingLonger = false }: { takingLonger?: boolean }) {
  return (
    <div className="flex min-h-[148px] flex-col items-center justify-center" role="status">
      <Loader2 className="h-5 w-5 animate-spin text-[#52a9ff] motion-reduce:animate-none" aria-hidden="true" />
      <StateHeading>Checking your connection request…</StateHeading>
      <StateDescription>
        {takingLonger
          ? 'This is taking longer than usual. Your connection code will stay in the address bar.'
          : 'Verifying your Google session and VS Code code.'}
      </StateDescription>
      {takingLonger ? (
        <button className={`${secondaryAction} mt-5`} onClick={() => window.location.reload()}>Reload page</button>
      ) : null}
    </div>
  )
}

function DeviceContent() {
  const { status: authStatus, developer, error: authError, retry: retryAuth } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const code = formatCode(searchParams.get('code') || '')
  const returnTo = code ? `/device?${new URLSearchParams({ code })}` : '/device'
  const [enteredCode, setEnteredCode] = useState(code)
  const [request, setRequest] = useState<DeviceAuthRequest | null>(null)
  const [view, setView] = useState<'loading' | 'confirm' | 'success' | 'denied' | 'error'>(code ? 'loading' : 'confirm')
  const [submitting, setSubmitting] = useState(false)
  const [retryingAuth, setRetryingAuth] = useState(false)
  const [error, setError] = useState('')
  const [takingLonger, setTakingLonger] = useState(false)

  const loading = authStatus === 'initializing' || authStatus === 'provisioning' ||
    (authStatus === 'authenticated' && Boolean(code) && view === 'loading')

  useEffect(() => {
    setTakingLonger(false)
    if (!loading) return
    const timer = window.setTimeout(() => setTakingLonger(true), 4000)
    return () => window.clearTimeout(timer)
  }, [loading])

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace(loginUrl(returnTo))
    if (authStatus === 'onboarding_required') router.replace(onboardingUrl(returnTo))
  }, [authStatus, returnTo, router])

  const loadRequest = useCallback(async () => {
    if (!code || authStatus !== 'authenticated') return
    setView('loading')
    setError('')
    try {
      const result = await api.deviceAuth.inspect(code)
      setRequest(result)
      if (result.status === 'expired') {
        setError('This connection request expired. Start sign-in again from VS Code.')
        setView('error')
      } else if (result.status === 'denied') {
        setView('denied')
      } else if (result.status === 'approved' || result.status === 'consumed') {
        setView('success')
      } else {
        setView('confirm')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this device request.')
      setView('error')
    }
  }, [authStatus, code])

  useEffect(() => {
    void loadRequest()
  }, [loadRequest])

  useEffect(() => {
    if (view !== 'success') return
    const timer = window.setTimeout(() => {
      window.location.href = VSCODE_RETURN_URI
    }, 700)
    return () => window.clearTimeout(timer)
  }, [view])

  const useEnteredCode = (event: FormEvent) => {
    event.preventDefault()
    const normalized = formatCode(enteredCode)
    if (normalized.length !== 9) return
    router.replace(`/device?${new URLSearchParams({ code: normalized })}`)
  }

  const approve = async () => {
    if (!code || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const result = await api.deviceAuth.approve(code)
      if (result.status !== 'approved' && result.status !== 'already_consumed') {
        throw new Error(`Authorization returned ${result.status}.`)
      }
      setView('success')
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'onboarding_required') {
        router.replace(onboardingUrl(returnTo))
        return
      }
      setError(caught instanceof Error ? caught.message : 'Unable to approve VS Code.')
      setView('error')
    } finally {
      setSubmitting(false)
    }
  }

  const deny = async () => {
    if (!code || submitting) return
    setSubmitting(true)
    try {
      await api.deviceAuth.deny(code)
      setView('denied')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to deny this request.')
      setView('error')
    } finally {
      setSubmitting(false)
    }
  }

  const reconnect = async () => {
    setRetryingAuth(true)
    try {
      await retryAuth()
    } finally {
      setRetryingAuth(false)
    }
  }

  if (authStatus === 'error') {
    return (
      <div role="alert">
        <StateIcon tone="red"><AlertCircle size={20} /></StateIcon>
        <StateHeading>We couldn’t connect your account</StateHeading>
        <StateDescription>{authError || 'Please retry to continue signing in.'}</StateDescription>
        <button className={`${primaryAction} mt-6`} disabled={retryingAuth} onClick={() => void reconnect()}>
          {retryingAuth ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
          {retryingAuth ? 'Reconnecting…' : 'Retry connection'}
        </button>
        <button className={`${secondaryAction} mt-3`} onClick={() => window.location.reload()}>Reload page</button>
      </div>
    )
  }

  if (loading) return <LoadingState takingLonger={takingLonger} />

  if (authStatus !== 'authenticated') {
    return (
      <div className="flex min-h-[180px] flex-col items-center justify-center" role="status">
        <Loader2 className="h-5 w-5 animate-spin text-[#52a9ff] motion-reduce:animate-none" aria-hidden="true" />
        <StateDescription>Taking you to Google sign-in…</StateDescription>
        <Link className={`${primaryAction} mt-6`} href={authStatus === 'onboarding_required' ? onboardingUrl(returnTo) : loginUrl(returnTo)}>Continue to sign-in</Link>
      </div>
    )
  }

  return (
    <DeviceShell live={view !== 'error'}>
      {view === 'success' ? (
        <>
          <StateIcon tone="blue"><CheckCircle2 size={20} /></StateIcon>
          <StateHeading>VS Code connected</StateHeading>
          <StateDescription>The extension is receiving its secure session now. We’ll try to focus VS Code automatically.</StateDescription>
          <a className={`${primaryAction} mt-6`} href={VSCODE_RETURN_URI}><ExternalLink size={16} aria-hidden="true" />Open VS Code</a>
          <Link className={`${secondaryAction} mt-3`} href="/dashboard">Go to dashboard</Link>
        </>
      ) : view === 'denied' ? (
        <div role="status">
          <StateIcon tone="red"><XCircle size={20} /></StateIcon>
          <StateHeading>Connection denied</StateHeading>
          <StateDescription>No extension session was created. You can close this tab or start again from VS Code.</StateDescription>
        </div>
      ) : view === 'error' ? (
        <div role="alert">
          <StateIcon tone="red"><AlertCircle size={20} /></StateIcon>
          <StateHeading>Couldn’t connect VS Code</StateHeading>
          <div className="mt-5 rounded-xl border border-red-400/25 bg-red-400/[0.07] px-4 py-3.5 text-left">
            <p className="text-[12px] font-medium text-red-100">Connection failed</p>
            <p className="mt-1.5 text-[12px] leading-5 text-red-200/90">{error}</p>
          </div>
          {code ? <button className={`${primaryAction} mt-5`} onClick={() => void loadRequest()}>Retry request</button> : null}
          <Link className={`${secondaryAction} mt-3`} href="/dashboard">Go to dashboard</Link>
        </div>
      ) : !code ? (
        <>
          <StateIcon tone="blue"><Terminal size={20} /></StateIcon>
          <StateHeading>Connect VS Code</StateHeading>
          <StateDescription>Enter the code shown by the GuideKit extension.</StateDescription>
          <form className="mt-6 text-left" onSubmit={useEnteredCode}>
            <label className="block text-[12px] font-medium text-[#b8c0ce]" htmlFor="device-code">Device code</label>
            <input
              id="device-code"
              className="mt-2 min-h-12 w-full rounded-lg border border-white/[0.24] bg-[#131820] px-3 text-center font-mono text-[17px] font-medium uppercase tracking-[0.16em] text-[#f1f4f9] outline-none transition-colors placeholder:text-[#8d97a8] placeholder:opacity-100 focus:border-[#52a9ff] focus:ring-2 focus:ring-[#52a9ff]/25 motion-reduce:transition-none"
              value={enteredCode}
              onChange={(event) => setEnteredCode(formatCode(event.target.value))}
              placeholder="ABCD-1234"
              maxLength={9}
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              autoFocus
            />
            <button className={`${primaryAction} mt-4`} disabled={enteredCode.length !== 9}>Continue with code</button>
          </form>
        </>
      ) : (
        <>
          <StateIcon tone="blue"><ShieldCheck size={20} /></StateIcon>
          <StateHeading>Connect GuideKit for VS Code?</StateHeading>
          <StateDescription>Confirm that you started this request in your editor.</StateDescription>
          <dl className="mt-6 overflow-hidden rounded-xl border border-white/[0.10] bg-[#131820] text-left">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-4 border-b border-white/[0.10] px-4 py-3">
              <dt className="text-[12px] text-[#8d97a8]">Google account</dt>
              <dd className="m-0 [overflow-wrap:anywhere] text-right text-[12px] text-[#f1f4f9]">{developer?.email}</dd>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-4 border-b border-white/[0.10] px-4 py-3">
              <dt className="text-[12px] text-[#8d97a8]">Client</dt>
              <dd className="m-0 text-right text-[12px] text-[#f1f4f9]">{request?.client === 'cli' ? 'GuideKit CLI' : 'GuideKit VS Code extension'}</dd>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-4 border-b border-white/[0.10] px-4 py-3">
              <dt className="text-[12px] text-[#8d97a8]">Code</dt>
              <dd className="m-0 text-right font-mono text-[12px] font-medium tracking-[0.12em] text-[#f1f4f9]">{code}</dd>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-4 px-4 py-3">
              <dt className="text-[12px] text-[#8d97a8]">Expires</dt>
              <dd className="m-0 text-right text-[12px] text-[#f1f4f9]">{request ? new Date(request.expires_at).toLocaleTimeString() : 'Soon'}</dd>
            </div>
          </dl>
          <button className={`${primaryAction} mt-5`} onClick={() => void approve()} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}
            {submitting ? 'Connecting…' : 'Confirm and connect'}
          </button>
          <button className="mt-3 min-h-11 appearance-none rounded-md border-0 bg-transparent px-2 text-[12px] font-medium text-[#8d97a8] underline-offset-4 hover:text-[#f87171] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52a9ff] disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void deny()} disabled={submitting}>Deny request</button>
        </>
      )}
    </DeviceShell>
  )
}

export default function DevicePage() {
  return <Suspense fallback={<LoadingState />}><DeviceContent /></Suspense>
}
