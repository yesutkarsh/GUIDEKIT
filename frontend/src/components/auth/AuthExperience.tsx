'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Alert } from '@heroui/react/alert'
import { Button } from '@heroui/react/button'
import { Spinner } from '@heroui/react/spinner'
import { useAuth as useClerkAuth, useSignIn } from '@clerk/nextjs'
import { useAuth } from '@/contexts/AuthContext'
import { onboardingUrl, safeReturnTo, workspaceSelectionUrl } from '@/lib/auth'
import { withTimeout } from '@/lib/timeout'
import styles from './AuthExperience.module.css'

export type AuthExperienceMode = 'login' | 'signup'

interface AuthExperienceProps {
  mode: AuthExperienceMode
}

const copy = {
  login: {
    eyebrow: 'GuideKit workspace',
    title: 'Welcome back',
    description: 'Sign in with Google to continue to your GuideKit workspace.',
    switchText: 'New to GuideKit?',
    switchLabel: 'Create an account',
    switchPath: '/signup',
  },
  signup: {
    eyebrow: 'Start with GuideKit',
    title: 'Create your GuideKit account',
    description: 'Continue with Google to create your account and set up your workspace.',
    switchText: 'Already have an account?',
    switchLabel: 'Sign in',
    switchPath: '/login',
  },
} as const

function queryErrorMessage(value: string | null) {
  if (value === 'incomplete') {
    return 'Google needs additional account information. Check your sign-in settings or try another Google account.'
  }
  if (value === 'cancelled') {
    return 'Google sign-in was not completed. You can safely try again.'
  }
  return ''
}

function switchUrl(path: string, returnTo: string) {
  return `${path}?${new URLSearchParams({ return_to: returnTo }).toString()}`
}

function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.formPane}>
          {children}
        </div>
        <div className={styles.photoPane} aria-hidden="true">
          <Image
            className={styles.photo}
            src="/images/auth/guidekit-team.png"
            alt=""
            fill
            priority
            sizes="(max-width: 767px) 100vw, (max-width: 1023px) 47vw, 45vw"
          />
          <div className={styles.photoVeil} />
        </div>
      </section>
    </main>
  )
}

export function AuthExperienceFallback({ mode }: AuthExperienceProps) {
  const pageCopy = copy[mode]
  return (
    <AuthFrame>
      <div className={styles.content} aria-live="polite">
        <p className={styles.eyebrow}>{pageCopy.eyebrow}</p>
        <h1 className={styles.title}>{pageCopy.title}</h1>
        <p className={styles.description}>{pageCopy.description}</p>
        <div className={styles.messageRegion}>
          <p className={styles.status}>
            <Spinner className={styles.statusSpinner} size="sm" aria-hidden="true" />
            Preparing secure sign-in…
          </p>
        </div>
        <Button className={styles.googleButton} size="lg" fullWidth isDisabled>
          Continue with Google
        </Button>
      </div>
    </AuthFrame>
  )
}

export function AuthExperience({ mode }: AuthExperienceProps) {
  const { signIn, fetchStatus } = useSignIn()
  const { isLoaded: isClerkLoaded, isSignedIn: isClerkSignedIn } = useClerkAuth()
  const {
    status,
    error: authError,
    isAuthenticated,
    organizations,
    markRedirecting,
    retry,
    logout,
  } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = safeReturnTo(searchParams.get('return_to'))
  const queryError = queryErrorMessage(searchParams.get('auth_error'))
  const [submitting, setSubmitting] = useState(false)
  const [takingLonger, setTakingLonger] = useState(false)
  const [localError, setLocalError] = useState(() => queryError)
  const pageCopy = copy[mode]
  const isSignInLoaded = signIn !== null
  const isFetchingClerk = fetchStatus === 'fetching'
  const hasExistingSession = Boolean(isClerkSignedIn)

  const operationActive = !isClerkLoaded
    || submitting
    || isFetchingClerk
    || status === 'initializing'
    || status === 'redirecting_to_google'
    || status === 'provisioning'
    || isAuthenticated

  useEffect(() => {
    if (!isAuthenticated || (status !== 'authenticated' && status !== 'onboarding_required')) return
    const destination = status === 'onboarding_required'
      ? onboardingUrl(returnTo)
      : organizations.length > 1
        ? workspaceSelectionUrl(returnTo)
        : returnTo
    router.replace(destination)
  }, [isAuthenticated, organizations.length, returnTo, router, status])

  useEffect(() => {
    setLocalError(queryError)
  }, [mode, queryError])

  useEffect(() => {
    if (!operationActive) {
      setTakingLonger(false)
      return
    }
    const timer = window.setTimeout(() => setTakingLonger(true), 4000)
    return () => window.clearTimeout(timer)
  }, [operationActive])

  const continueWithGoogle = async () => {
    if (!isClerkLoaded || submitting || isFetchingClerk || isAuthenticated) return
    setSubmitting(true)
    setLocalError('')

    if (isClerkSignedIn) {
      try {
        await retry()
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!isSignInLoaded || !signIn) {
      setSubmitting(false)
      setLocalError('Google sign-in is still initializing. Please wait a moment and try again.')
      return
    }

    markRedirecting()
    try {
      const result = await withTimeout(signIn.sso({
        strategy: 'oauth_google',
        redirectUrl: returnTo,
        redirectCallbackUrl: `/sso-callback?${new URLSearchParams({ return_to: returnTo })}`,
      }), 10000, 'Google could not be opened. Check your connection and try again.')
      if (result.error) throw new Error(result.error.message)
    } catch (caught) {
      setSubmitting(false)
      setLocalError(caught instanceof Error ? caught.message : 'Google sign-in could not be started.')
      await retry()
    }
  }

  const displayedError = localError || (status === 'error' ? authError : '')
  const buttonBusy = operationActive && status !== 'error'
  const showStatusSpinner = takingLonger
    || !isClerkLoaded
    || status === 'initializing'
    || (hasExistingSession && (submitting || status === 'provisioning'))
  const buttonDisabled = !isClerkLoaded
    || (!hasExistingSession && !isSignInLoaded)
    || buttonBusy
  const buttonLabel = hasExistingSession
    ? buttonBusy ? 'Connecting your account…' : 'Retry secure connection'
    : submitting || status === 'redirecting_to_google' || isFetchingClerk
      ? 'Opening Google…'
      : 'Continue with Google'

  let statusMessage = ''
  if (takingLonger) {
    statusMessage = hasExistingSession
      ? 'Your local GuideKit API is taking longer than expected. We’ll keep trying until the request times out.'
      : 'Google is taking a little longer than expected. If no window opens, retry when the button becomes available.'
  } else if (!isClerkLoaded || status === 'initializing') {
    statusMessage = 'Preparing secure sign-in…'
  } else if (isAuthenticated) {
    statusMessage = organizations.length > 1 ? 'Preparing your workspaces…' : 'Opening your workspace…'
  } else if (hasExistingSession && (submitting || status === 'provisioning')) {
    statusMessage = 'Connecting your Google account to GuideKit…'
  } else if (hasExistingSession && status === 'error') {
    statusMessage = 'Your Google session is active, but GuideKit could not finish connecting it.'
  }

  if (isAuthenticated) {
    const choosingWorkspace = organizations.length > 1
    return (
      <AuthFrame>
        <div className={`${styles.content} ${styles.redirectState}`} aria-live="polite">
          <div className={styles.redirectProgress} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className={styles.eyebrow}>Sign-in complete</p>
          <h1 className={styles.title}>{choosingWorkspace ? 'Choose your workspace' : 'Opening your workspace…'}</h1>
          <p className={styles.description}>
            {choosingWorkspace
              ? 'Your account is ready. Choose where you want to work next.'
              : 'Your Google account is ready. GuideKit is taking you to the right place.'}
          </p>
        </div>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame>
      <div className={styles.content}>
        <p className={styles.eyebrow}>{pageCopy.eyebrow}</p>
        <h1 className={styles.title}>{pageCopy.title}</h1>
        <p className={styles.description}>{pageCopy.description}</p>

        <div className={styles.messageRegion}>
          {displayedError ? (
            <Alert className={styles.alert} status="danger" role="alert">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title className={styles.alertTitle}>We couldn’t sign you in</Alert.Title>
                <Alert.Description className={styles.alertDescription}>{displayedError}</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : (
            <p className={styles.status} aria-live="polite">
              {showStatusSpinner ? <Spinner className={styles.statusSpinner} size="sm" aria-hidden="true" /> : null}
              <span>{statusMessage}</span>
            </p>
          )}
        </div>

        <Button
          className={styles.googleButton}
          size="lg"
          fullWidth
          isDisabled={buttonDisabled}
          onPress={() => void continueWithGoogle()}
        >
          {buttonBusy ? (
            <Spinner size="sm" color="current" aria-hidden="true" />
          ) : (
            <span className={styles.googleIconWrap} aria-hidden="true">
              <Image src="/images/auth/google.svg" alt="" width={18} height={18} />
            </span>
          )}
          <span>{buttonLabel}</span>
        </Button>

        {hasExistingSession && status === 'error' ? (
          <Button className={styles.secondaryButton} variant="outline" fullWidth onPress={() => void logout()}>
            Sign out and use another Google account
          </Button>
        ) : null}

        <p className={styles.switchPrompt}>
          {pageCopy.switchText}{' '}
          <Link className={styles.switchLink} href={switchUrl(pageCopy.switchPath, returnTo)}>
            {pageCopy.switchLabel}
          </Link>
        </p>
      </div>
    </AuthFrame>
  )
}
