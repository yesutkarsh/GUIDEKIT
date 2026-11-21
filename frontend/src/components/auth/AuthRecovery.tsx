'use client'

import { useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export function AuthRecovery() {
  const { error, retry } = useAuth()
  const [retrying, setRetrying] = useState(false)

  const reconnect = async () => {
    setRetrying(true)
    try { await retry() } finally { setRetrying(false) }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" role="alert">
        <AlertCircle size={34} className="auth-danger-icon" />
        <h1>We couldn’t connect your account</h1>
        <p>{error || 'Please retry to continue signing in.'}</p>
        <button className="google-button" disabled={retrying} onClick={() => void reconnect()}>
          {retrying ? <Loader2 className="auth-spinner" size={18} /> : null}
          {retrying ? 'Reconnecting…' : 'Retry connection'}
        </button>
        <button className="secondary-auth-button" onClick={() => window.location.reload()}>Reload page</button>
      </section>
    </main>
  )
}
