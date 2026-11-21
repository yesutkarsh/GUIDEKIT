'use client'

import { Suspense, useEffect, useState } from 'react'
import { HandleSSOCallback } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { loginUrl, safeReturnTo } from '@/lib/auth'

function CallbackContent() {
  const router = useRouter()
  const params = useSearchParams()
  const returnTo = safeReturnTo(params.get('return_to'))
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 15000)
    return () => window.clearTimeout(timer)
  }, [])

  const recover = (reason: string) => router.replace(`${loginUrl(returnTo)}&auth_error=${reason}`)

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-live="polite">
        <div className="auth-logo">GK</div>
        <h1>{slow ? 'Sign-in is taking longer than expected' : 'Finishing Google sign-in…'}</h1>
        <p>{slow ? 'Your sign-in has not finished. You can safely return and try again.' : 'We’re securely returning you to GuideKit.'}</p>
        {slow ? <Link className="google-button" href={loginUrl(returnTo)}>Return to sign-in</Link> : <div className="auth-spinner auth-spinner-large" aria-hidden="true" />}
        <HandleSSOCallback
          navigateToApp={() => router.replace(returnTo)}
          navigateToSignIn={() => recover('cancelled')}
          navigateToSignUp={() => recover('incomplete')}
        />
      </section>
    </main>
  )
}

export default function SsoCallbackPage() {
  return <Suspense fallback={<main className="auth-shell"><p>Finishing Google sign-in…</p></main>}><CallbackContent /></Suspense>
}
