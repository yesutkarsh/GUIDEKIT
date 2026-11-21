'use client'

import { useState, useEffect } from 'react'
import Script from 'next/script'
import Link from 'next/link'
import {
  Car,
  ShieldCheck,
  Zap,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  User,
  ExternalLink,
  Flame,
  Radio,
} from 'lucide-react'

type DemoRoute = '/' | '/login' | '/book' | '/driver/register' | '/driver/dashboard'
type AuthState = 'logged_out' | 'passenger' | 'driver'
type ChaosMode = 1 | 2 | 3 | 4 // 1: Healthy (0ms), 2: Stripped (Fingerprint), 3: Mutated (AI Heal), 4: Deleted (Text Fallback)

export default function TaxiSanchalakDemoPage() {
  const [activeRoute, setActiveRoute] = useState<DemoRoute>('/')
  const [authState, setAuthState] = useState<AuthState>('logged_out')
  const [chaosMode, setChaosMode] = useState<ChaosMode>(1)
  const [pickup, setPickup] = useState('')
  const [dropoff, setDropoff] = useState('')
  const [vehicle, setVehicle] = useState('sedan')
  const [booked, setBooked] = useState(false)
  const [payoutAmount, setPayoutAmount] = useState('2500')
  const [payoutSuccess, setPayoutSuccess] = useState(false)
  const [phone, setPhone] = useState('9876543210')
  const [loginRole, setLoginRole] = useState<'driver' | 'passenger'>('driver')
  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [publishableKey, setPublishableKey] = useState('gk_pk_live_demo00000000000000000000000000000')

  // Fetch publishable key for Taxi Sanchalak project on mount
  useEffect(() => {
    async function resolveKey() {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/v1/projects')
        if (res.ok) {
          const projects = await res.json()
          const taxiProject = projects.find((p: any) => p.slug === 'taxi-sanchalak') || projects[0]
          if (taxiProject?.publishable_key) {
            setPublishableKey(taxiProject.publishable_key)
          }
        }
      } catch {
        // Use default fallback key
      }
    }
    resolveKey()
  }, [])

  // Sync auth state to localStorage for SDK authDetector
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (authState === 'logged_out') {
      localStorage.removeItem('token')
      localStorage.removeItem('driver_token')
      localStorage.removeItem('passenger_token')
      localStorage.removeItem('role')
    } else if (authState === 'driver') {
      localStorage.setItem('token', 'mock_driver_jwt_token')
      localStorage.setItem('driver_token', 'mock_driver_jwt_token')
      localStorage.setItem('role', 'driver')
    } else if (authState === 'passenger') {
      localStorage.setItem('token', 'mock_passenger_jwt_token')
      localStorage.setItem('passenger_token', 'mock_passenger_jwt_token')
      localStorage.setItem('role', 'passenger')
    }
  }, [authState])

  // Handle virtual route transition
  const handleRouteChange = (route: DemoRoute) => {
    setActiveRoute(route)
    setBooked(false)
    setPayoutSuccess(false)
    if (typeof window !== 'undefined' && (window as any).GuideKit) {
      (window as any).GuideKit.notifyRouteChange(route)
    }
  }

  // Handle Login submission
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setAuthState(loginRole)
    // Check if an active tour was waiting for sign-in prerequisite
    const activeTourRaw = sessionStorage.getItem('guidekit_active_tour')
    if (activeTourRaw) {
      try {
        const tour = JSON.parse(activeTourRaw)
        // If tour has remaining steps, navigate to driver dashboard or book
        if (tour.tourPlan?.target_feature_slug === 'ask-money-on-the-go') {
          handleRouteChange('/driver/dashboard')
          return
        }
      } catch {}
    }
    handleRouteChange(loginRole === 'driver' ? '/driver/dashboard' : '/book')
  }

  // Handle Payout request
  const handlePayoutSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPayoutSuccess(true)
  }

  return (
    <div
      data-current-route={activeRoute}
      data-guidekit-route={activeRoute}
      style={{
        minHeight: '100vh',
        backgroundColor: '#0A0A0C',
        color: '#FFFFFF',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Load Universal Web SDK */}
      <Script
        src="/sdk/guidekit-sdk.js"
        data-guidekit-key={publishableKey}
        data-api-url="http://127.0.0.1:8000/api/v1"
        data-locale="en"
        strategy="afterInteractive"
        onLoad={() => {
          setSdkLoaded(true)
          if ((window as any).GuideKit) {
            const guideKit = (window as any).GuideKit
            void guideKit.init({
              apiKey: publishableKey,
              apiUrl: 'http://127.0.0.1:8000/api/v1',
              locale: 'en',
            }).then(() => {
              if (new URLSearchParams(window.location.search).get('guide') === 'open') {
                guideKit.openWidget()
              }
            })
          }
        }}
      />

      {/* ========================================================================= */}
      {/* 1. TOP SPARKATHON LIVE DEMO & CHAOS CONTROLLER BAR                        */}
      {/* ========================================================================= */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          backgroundColor: '#0F1117',
          borderBottom: '1px solid #232836',
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
          padding: '10px 20px',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Badge & Portal Link */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#10B981',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <Radio size={12} className="animate-pulse" />
              <span>Sparkathon Live Pitch Simulator</span>
            </div>

            <Link
              href="/dashboard"
              target="_blank"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: '#8E929F',
                fontSize: '11px',
                textDecoration: 'none',
              }}
            >
              <span>Developer Admin Portal</span>
              <ExternalLink size={11} />
            </Link>
          </div>

          {/* Simulated Route Switcher Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#181B24', padding: '3px', borderRadius: '8px', border: '1px solid #282D3D' }}>
            {(
              [
                { route: '/', label: '🏠 Home' },
                { route: '/login', label: '🔑 Sign In' },
                { route: '/book', label: '🚖 Book Taxi' },
                { route: '/driver/register', label: '📝 Become Driver' },
                { route: '/driver/dashboard', label: '🎛️ Driver Console' },
              ] as const
            ).map((item) => (
              <button
                key={item.route}
                data-route={item.route}
                onClick={() => handleRouteChange(item.route)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: activeRoute === item.route ? '#10B981' : 'transparent',
                  color: activeRoute === item.route ? '#0A0A0C' : '#9CA3AF',
                  transition: 'all 0.15s ease',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Auth State Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#8E929F', fontWeight: 600 }}>Auth:</span>
            <button
              onClick={() => setAuthState('logged_out')}
              style={{
                padding: '4px 8px',
                borderRadius: '5px',
                fontSize: '11px',
                cursor: 'pointer',
                border: '1px solid',
                backgroundColor: authState === 'logged_out' ? '#2A181A' : '#1A1C24',
                borderColor: authState === 'logged_out' ? '#F43F5E' : '#2B303E',
                color: authState === 'logged_out' ? '#F43F5E' : '#8E929F',
              }}
            >
              Logged Out
            </button>
            <button
              onClick={() => setAuthState('passenger')}
              style={{
                padding: '4px 8px',
                borderRadius: '5px',
                fontSize: '11px',
                cursor: 'pointer',
                border: '1px solid',
                backgroundColor: authState === 'passenger' ? '#14233D' : '#1A1C24',
                borderColor: authState === 'passenger' ? '#3B82F6' : '#2B303E',
                color: authState === 'passenger' ? '#60A5FA' : '#8E929F',
              }}
            >
              Passenger
            </button>
            <button
              onClick={() => setAuthState('driver')}
              style={{
                padding: '4px 8px',
                borderRadius: '5px',
                fontSize: '11px',
                cursor: 'pointer',
                border: '1px solid',
                backgroundColor: authState === 'driver' ? '#142921' : '#1A1C24',
                borderColor: authState === 'driver' ? '#10B981' : '#2B303E',
                color: authState === 'driver' ? '#10B981' : '#8E929F',
              }}
            >
              Driver
            </button>
          </div>
        </div>

        {/* Chaos Modes Row */}
        <div
          style={{
            maxWidth: '1280px',
            margin: '8px auto 0 auto',
            paddingTop: '8px',
            borderTop: '1px solid #1E222D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Flame size={14} style={{ color: '#F59E0B' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase' }}>
              DOM Self-Healing Chaos Modes:
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setChaosMode(1)}
              style={{
                padding: '4px 10px',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid',
                backgroundColor: chaosMode === 1 ? 'rgba(16, 185, 129, 0.2)' : '#161820',
                borderColor: chaosMode === 1 ? '#10B981' : '#282C3A',
                color: chaosMode === 1 ? '#10B981' : '#9CA3AF',
              }}
            >
              Mode 1: Healthy DOM (Tier 1 · 0ms)
            </button>

            <button
              onClick={() => setChaosMode(2)}
              style={{
                padding: '4px 10px',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid',
                backgroundColor: chaosMode === 2 ? 'rgba(59, 130, 246, 0.2)' : '#161820',
                borderColor: chaosMode === 2 ? '#3B82F6' : '#282C3A',
                color: chaosMode === 2 ? '#60A5FA' : '#9CA3AF',
              }}
            >
              Mode 2: Stripped IDs (Tier 2 · Fingerprint)
            </button>

            <button
              onClick={() => setChaosMode(3)}
              style={{
                padding: '4px 10px',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid',
                backgroundColor: chaosMode === 3 ? 'rgba(245, 158, 11, 0.2)' : '#161820',
                borderColor: chaosMode === 3 ? '#F59E0B' : '#282C3A',
                color: chaosMode === 3 ? '#FBBF24' : '#9CA3AF',
              }}
            >
              Mode 3: Mutated Button (Tier 3 · Cloud AI Heal)
            </button>

            <button
              onClick={() => setChaosMode(4)}
              style={{
                padding: '4px 10px',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid',
                backgroundColor: chaosMode === 4 ? 'rgba(239, 68, 68, 0.2)' : '#161820',
                borderColor: chaosMode === 4 ? '#EF4444' : '#282C3A',
                color: chaosMode === 4 ? '#F87171' : '#9CA3AF',
              }}
            >
              Mode 4: Deleted Button (Tier 4 · Text Fallback)
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CUSTOMER APP NAVBAR                                                    */}
      {/* ========================================================================= */}
      <nav
        style={{
          borderBottom: '1px solid #1C202B',
          backgroundColor: '#111319',
          padding: '14px 28px',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Logo */}
          <div
            onClick={() => handleRouteChange('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#F59E0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0A0A0C',
                fontWeight: 900,
              }}
            >
              <Car size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '-0.02em', color: '#FFFFFF' }}>
                Taxi Sanchalak
              </div>
              <div style={{ fontSize: '10px', color: '#10B981', fontWeight: 600 }}>
                India&apos;s Driver-First Mobility Platform
              </div>
            </div>
          </div>

          {/* Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button
              onClick={() => handleRouteChange('/')}
              style={{
                background: 'none',
                border: 'none',
                color: activeRoute === '/' ? '#10B981' : '#9CA3AF',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Home
            </button>

            <button
              onClick={() => handleRouteChange('/book')}
              style={{
                background: 'none',
                border: 'none',
                color: activeRoute === '/book' ? '#10B981' : '#9CA3AF',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Book Cab
            </button>

            <button
              onClick={() => handleRouteChange('/driver/register')}
              style={{
                background: 'none',
                border: 'none',
                color: activeRoute === '/driver/register' ? '#10B981' : '#9CA3AF',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Partner With Us
            </button>

            <button
              onClick={() => handleRouteChange('/driver/dashboard')}
              style={{
                background: 'none',
                border: 'none',
                color: activeRoute === '/driver/dashboard' ? '#10B981' : '#9CA3AF',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Driver Console
            </button>

            {/* User Profile / Menu */}
            {authState !== 'logged_out' ? (
              <div
                data-user-menu="true"
                data-user-role={authState}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#1C202C',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: '1px solid #2B3244',
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: authState === 'driver' ? '#10B981' : '#3B82F6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    color: '#0A0A0C',
                    fontWeight: 700,
                  }}
                >
                  <User size={12} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>
                  {authState === 'driver' ? 'Rajesh (Driver)' : 'Priya (Passenger)'}
                </span>
              </div>
            ) : (
              <button
                onClick={() => handleRouteChange('/login')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  backgroundColor: '#F59E0B',
                  color: '#0A0A0C',
                  fontWeight: 700,
                  fontSize: '12px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* 3. DYNAMIC SCREEN CONTENT                                                 */}
      {/* ========================================================================= */}
      <main style={{ maxWidth: '1000px', margin: '40px auto', padding: '0 20px' }}>
        {/* ROUTE 1: HOME (/) */}
        {activeRoute === '/' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <h1 style={{ fontSize: '38px', fontWeight: 800, margin: '0 0 12px 0', letterSpacing: '-0.02em' }}>
                Instant Rides. Zero Commission Payouts.
              </h1>
              <p style={{ fontSize: '16px', color: '#9CA3AF', maxWidth: '600px', margin: '0 auto' }}>
                Welcome to Taxi Sanchalak. Open &quot;Ask Guide&quot; at the bottom of the page for guided walkthroughs.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              <div
                onClick={() => handleRouteChange('/book')}
                style={{
                  backgroundColor: '#12141A',
                  border: '1px solid #222634',
                  borderRadius: '12px',
                  padding: '24px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <Car size={22} style={{ color: '#FFFFFF' }} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px 0' }}>Book a Taxi</h3>
                <p style={{ fontSize: '13px', color: '#8E929F', margin: 0 }}>
                  Guaranteed cabs in Delhi NCR, Mumbai & Bengaluru with upfront flat fares.
                </p>
              </div>

              <div
                onClick={() => handleRouteChange('/driver/dashboard')}
                style={{
                  backgroundColor: '#12141A',
                  border: '1px solid #222634',
                  borderRadius: '12px',
                  padding: '24px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <DollarSign size={22} style={{ color: '#0A0A0C' }} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px 0' }}>Driver Earnings Console</h3>
                <p style={{ fontSize: '13px', color: '#8E929F', margin: 0 }}>
                  Withdraw instant earnings on the go with zero transfer fees.
                </p>
              </div>

              <div
                onClick={() => handleRouteChange('/driver/register')}
                style={{
                  backgroundColor: '#12141A',
                  border: '1px solid #222634',
                  borderRadius: '12px',
                  padding: '24px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <ShieldCheck size={22} style={{ color: '#0A0A0C' }} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px 0' }}>Driver Partner Signup</h3>
                <p style={{ fontSize: '13px', color: '#8E929F', margin: 0 }}>
                  Join 45,000+ verified drivers across India. Keep 100% of customer tips.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ROUTE 2: SIGN IN (/login) */}
        {activeRoute === '/login' && (
          <div style={{ maxWidth: '440px', margin: '40px auto', backgroundColor: '#12141A', border: '1px solid #222634', borderRadius: '14px', padding: '32px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 8px 0' }}>Sign In to Taxi Sanchalak</h2>
            <p style={{ fontSize: '13px', color: '#8E929F', margin: '0 0 24px 0' }}>
              Access your rides, driver payouts, and account settings.
            </p>

            <form onSubmit={handleLoginSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8E929F', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Mobile Number
                </label>
                <input
                  id="mobile-number-input"
                  data-guide-id={chaosMode === 1 ? 'login-phone-step' : undefined}
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0A0A0D', border: '1px solid #282C3A', color: '#FFFFFF', fontSize: '14px' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8E929F', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Account Role
                </label>
                <select
                  value={loginRole}
                  onChange={(e) => setLoginRole(e.target.value as any)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0A0A0D', border: '1px solid #282C3A', color: '#FFFFFF', fontSize: '13px' }}
                >
                  <option value="driver">Driver Partner</option>
                  <option value="passenger">Passenger Rider</option>
                </select>
              </div>

              <button
                type="submit"
                id="login-submit-btn"
                data-guide-id={chaosMode === 1 ? 'login-submit-step' : undefined}
                data-testid="login-submit-btn"
                style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: '#10B981', color: '#0A0A0C', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer', marginTop: '8px' }}
              >
                Sign In & Continue
              </button>
            </form>
          </div>
        )}

        {/* ROUTE 3: BOOK TAXI (/book) */}
        {activeRoute === '/book' && (
          <div style={{ maxWidth: '520px', margin: '0 auto', backgroundColor: '#12141A', border: '1px solid #222634', borderRadius: '14px', padding: '32px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 6px 0' }}>Book a Taxi</h2>
            <p style={{ fontSize: '13px', color: '#8E929F', margin: '0 0 20px 0' }}>
              Real-time drivers ready nearby.
            </p>

            {booked ? (
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10B981', borderRadius: '10px', padding: '24px', textAlign: 'center' }}>
                <CheckCircle2 size={36} style={{ color: '#10B981', margin: '0 auto 12px auto' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0' }}>Driver En Route!</h3>
                <p style={{ fontSize: '13px', color: '#D1D5DB', margin: 0 }}>
                  Your sedan is arriving in 4 minutes.
                </p>
                <button
                  onClick={() => setBooked(false)}
                  style={{ marginTop: '16px', padding: '6px 14px', backgroundColor: '#1A1D27', border: '1px solid #2D3346', borderRadius: '6px', color: '#FFF', fontSize: '12px', cursor: 'pointer' }}
                >
                  Book Another Ride
                </button>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setBooked(true) }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8E929F', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Pickup Location
                  </label>
                  <input
                    id="pickup-location"
                    data-guide-id={chaosMode === 1 ? 'book-pickup-step' : undefined}
                    type="text"
                    placeholder="e.g. Connaught Place, New Delhi"
                    value={pickup}
                    onChange={(e) => setPickup(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0A0A0D', border: '1px solid #282C3A', color: '#FFFFFF', fontSize: '13px' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8E929F', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Dropoff Destination
                  </label>
                  <input
                    id="dropoff-location"
                    data-guide-id={chaosMode === 1 ? 'book-dropoff-step' : undefined}
                    type="text"
                    placeholder="e.g. IGI Airport Terminal 3"
                    value={dropoff}
                    onChange={(e) => setDropoff(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0A0A0D', border: '1px solid #282C3A', color: '#FFFFFF', fontSize: '13px' }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8E929F', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Vehicle Category
                  </label>
                  <select
                    id="vehicle-type"
                    data-guide-id={chaosMode === 1 ? 'custom-flow-step-1' : undefined}
                    data-testid="vehicle-type-select"
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0A0A0D', border: '1px solid #282C3A', color: '#FFFFFF', fontSize: '13px' }}
                  >
                    <option value="hatchback">Mini / Hatchback (4 seats) - ₹240</option>
                    <option value="sedan">Sedan Comfort (4 seats) - ₹320</option>
                    <option value="suv">SUV XL (6 seats) - ₹480</option>
                  </select>
                </div>

                <button
                  type="submit"
                  id="confirm-booking-btn"
                  data-guide-id={chaosMode === 1 ? 'book-confirm-step' : undefined}
                  data-testid="confirm-booking-btn"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: '#10B981', color: '#0A0A0C', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer' }}
                >
                  Book Taxi Now
                </button>
              </form>
            )}
          </div>
        )}

        {/* ROUTE 4: BECOME DRIVER (/driver/register) */}
        {activeRoute === '/driver/register' && (
          <div style={{ maxWidth: '520px', margin: '0 auto', backgroundColor: '#12141A', border: '1px solid #222634', borderRadius: '14px', padding: '32px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 6px 0' }}>Driver Partner Onboarding</h2>
            <p style={{ fontSize: '13px', color: '#8E929F', margin: '0 0 20px 0' }}>
              Fast verification in 24 hours. Start earning with zero commission!
            </p>

            <form onSubmit={(e) => { e.preventDefault(); alert('Driver Application Submitted!') }}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8E929F', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Full Name
                </label>
                <input
                  id="driver-name"
                  type="text"
                  placeholder="e.g. Rajesh Kumar"
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0A0A0D', border: '1px solid #282C3A', color: '#FFFFFF', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8E929F', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Commercial Driving License No.
                </label>
                <input
                  id="driver-dl"
                  type="text"
                  placeholder="e.g. DL-0420110012345"
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0A0A0D', border: '1px solid #282C3A', color: '#FFFFFF', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8E929F', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Vehicle Registration Number
                </label>
                <input
                  id="driver-rc"
                  type="text"
                  placeholder="e.g. DL 1T A 9876"
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0A0A0D', border: '1px solid #282C3A', color: '#FFFFFF', fontSize: '13px' }}
                />
              </div>

              <button
                type="submit"
                id="driver-register-btn"
                data-guide-id={chaosMode === 1 ? 'driver-register-submit' : undefined}
                data-testid="driver-register-btn"
                style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: '#F59E0B', color: '#0A0A0C', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer' }}
              >
                Submit Driver Application
              </button>
            </form>
          </div>
        )}

        {/* ROUTE 5: DRIVER DASHBOARD (/driver/dashboard) */}
        {activeRoute === '/driver/dashboard' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h1 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 4px 0' }}>Driver Partner Hub</h1>
                <p style={{ fontSize: '13px', color: '#8E929F', margin: 0 }}>
                  Delhi NCR Fleet • Active Vehicle: DL 1T A 9876
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ backgroundColor: '#13151D', border: '1px solid #242838', borderRadius: '8px', padding: '10px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: '#8E929F', textTransform: 'uppercase' }}>Today&apos;s Earnings</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#10B981' }}>₹3,450</div>
                </div>
                <div style={{ backgroundColor: '#13151D', border: '1px solid #242838', borderRadius: '8px', padding: '10px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: '#8E929F', textTransform: 'uppercase' }}>Trips</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF' }}>14</div>
                </div>
              </div>
            </div>

            {/* Instant Payout Card ("Ask for Money on the Go") */}
            <div
              id="driver-payout-card"
              style={{
                backgroundColor: '#12141A',
                border: '1px solid #232838',
                borderRadius: '14px',
                padding: '28px',
                marginBottom: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                    <DollarSign size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Ask for Money on the Go (Instant Payout)</h3>
                    <p style={{ fontSize: '12px', color: '#8E929F', margin: 0 }}>
                      Transfer balance directly to UPI or bank account in 2 seconds.
                    </p>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: '#10B981', fontWeight: 600 }}>Available: ₹3,450.00</div>
              </div>

              {payoutSuccess ? (
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10B981', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                  <CheckCircle2 size={28} style={{ color: '#10B981', margin: '0 auto 8px auto' }} />
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>₹{payoutAmount} Transferred Successfully!</div>
                  <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>Sent to rajesh@okhdfcbank via IMPS</div>
                  <button
                    onClick={() => setPayoutSuccess(false)}
                    style={{ marginTop: '12px', padding: '6px 12px', backgroundColor: '#1A1D27', border: '1px solid #2B3040', borderRadius: '6px', color: '#FFF', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePayoutSubmit}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8E929F', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Payout Amount (₹)
                    </label>
                    <input
                      id="driver-payout-amount"
                      type="number"
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0A0A0D', border: '1px solid #282C3A', color: '#FFFFFF', fontSize: '14px' }}
                    />
                  </div>

                  {/* Chaos Modes Rendering of the Action Button */}
                  {chaosMode === 1 && (
                    <button
                      type="submit"
                      id="instant-payout-cta"
                      data-guide-id="driver-payout-cta-step"
                      data-testid="instant-payout-cta"
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        backgroundColor: '#10B981',
                        color: '#0A0A0C',
                        fontWeight: 700,
                        fontSize: '14px',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Request Instant Cash (Tier 1 Healthy)
                    </button>
                  )}

                  {chaosMode === 2 && (
                    <button
                      type="submit"
                      id="btn-stripped-payout"
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        backgroundColor: '#3B82F6',
                        color: '#FFFFFF',
                        fontWeight: 700,
                        fontSize: '14px',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Request Instant Cash (Tier 2 Stripped IDs)
                    </button>
                  )}

                  {chaosMode === 3 && (
                    <button
                      type="submit"
                      id="renamed-instant-cash-btn"
                      className="btn-mutated-emerald"
                      data-testid="instant-payout-cta"
                      aria-label="Withdraw earnings on the go"
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        backgroundColor: '#F59E0B',
                        color: '#0A0A0C',
                        fontWeight: 700,
                        fontSize: '14px',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Withdraw Instant Cash (Tier 3 AI Mutated)
                    </button>
                  )}

                  {chaosMode === 4 && (
                    <div style={{ padding: '16px', border: '1px dashed #EF4444', borderRadius: '8px', textAlign: 'center', color: '#F87171', fontSize: '13px' }}>
                      <AlertTriangle size={20} style={{ margin: '0 auto 6px auto' }} />
                      Target Payout Button was completely deleted! (Testing Tier 4 Graceful Text Fallback in Chatbot)
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

