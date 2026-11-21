'use client'

import { useState, useEffect } from 'react'
import {
  Bot,
  Send,
  Sparkles,
  Lock,
  Unlock,
  Globe,
  User,
  AlertTriangle,
  CheckCircle2,
  Layers,
  ArrowRight,
  Loader2,
  RefreshCw,
  Zap,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { Project, FeatureSummary, SDKChatResponse, SDKHealResponse } from '@/lib/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface SandboxTabProps {
  projectId: string
  project: Project
  publishableKey?: string
}

interface ChatMessageItem {
  id: string
  sender: 'user' | 'assistant'
  text: string
  routeTaken?: string
  similarity?: number | null
  tourPlan?: SDKChatResponse['tour_plan']
  retrievedChunks?: SDKChatResponse['retrieved_chunks']
}

const QUICK_PROMPTS = [
  { label: '💸 Ask for Money (Logged Out Test)', text: 'How do I ask for money while driving?' },
  { label: '🇮🇳 Hindi Intent Matching', text: 'चलते-फिरते पैसे कैसे निकालें?' },
  { label: '🚖 Book Taxi Flow', text: 'How do I book a taxi?' },
  { label: '📚 Pricing FAQ (RAG)', text: 'What is the commission fee for Silver tier?' },
  { label: '🪐 Out of Scope Guardrail', text: 'What is the capital of Mars?' },
  { label: '👋 Greeting (Smalltalk)', text: 'Hello!' },
]

export function SandboxTab({ projectId, project, publishableKey: initialKey }: SandboxTabProps) {
  const [publishableKey, setPublishableKey] = useState<string | undefined>(initialKey)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [role, setRole] = useState<'passenger' | 'driver'>('driver')
  const [locale, setLocale] = useState<'en' | 'hi'>('en')

  const [inputMsg, setInputMsg] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Welcome to the GuideKit Runtime Sandbox for ${project.name}! Test live conversational intent routing, prerequisite login stitching, and DOM self-healing in real time.`,
    },
  ])

  // Self-Healing Simulator State
  const [features, setFeatures] = useState<FeatureSummary[]>([])
  const [selectedStepId, setSelectedStepId] = useState<string>('')
  const [healLoading, setHealLoading] = useState(false)
  const [healResult, setHealResult] = useState<SDKHealResponse | null>(null)

  // Load Key & Features
  useEffect(() => {
    async function loadData() {
      try {
        if (!publishableKey) {
          const keys = await api.keys.list(projectId)
          const pk = keys.find((k) => k.key_type.includes('publishable') && !k.revoked_at)
          if (pk?.key_plain) {
            setPublishableKey(pk.key_plain)
          } else {
            setPublishableKey('gk_pk_live_demo00000000000000000000000000000')
          }
        }
        const feats = await api.features.list(projectId)
        setFeatures(feats)
      } catch {
        // Fallback default demo key
        if (!publishableKey) {
          setPublishableKey('gk_pk_live_demo00000000000000000000000000000')
        }
      }
    }
    loadData()
  }, [projectId, publishableKey])

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputMsg
    if (!textToSend.trim() || chatLoading) return

    const keyToUse = publishableKey || 'gk_pk_live_demo00000000000000000000000000000'
    const userMsgId = 'usr_' + Date.now()

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        text: textToSend,
      },
    ])
    setInputMsg('')
    setChatLoading(true)

    try {
      const resp = await api.sdk.chat(keyToUse, {
        visitor_id: 'visitor_sandbox_demo',
        message: textToSend,
        locale,
        current_path: '/',
        auth_state: {
          is_logged_in: isLoggedIn,
          role: isLoggedIn ? role : null,
        },
      })

      setMessages((prev) => [
        ...prev,
        {
          id: resp.message_id,
          sender: 'assistant',
          text: resp.reply,
          routeTaken: resp.route_taken,
          similarity: resp.similarity,
          tourPlan: resp.tour_plan,
          retrievedChunks: resp.retrieved_chunks,
        },
      ])
    } catch (err: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          sender: 'assistant',
          text: `⚠️ Request failed: ${err instanceof Error ? err.message : 'Failed to communicate with GuideKit Runtime API'}`,
          routeTaken: 'out_of_scope',
        },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  const handleSimulateHeal = async () => {
    const keyToUse = publishableKey || 'gk_pk_live_demo00000000000000000000000000000'
    setHealLoading(true)
    setHealResult(null)

    // Generate a test candidate with renamed button selector
    const testCandidateId = 'cand_renamed_' + Math.floor(Math.random() * 1000)
    const testDomHash = 'hash_' + Date.now()

    try {
      const resp = await api.sdk.heal(keyToUse, {
        step_id: selectedStepId || '00000000-0000-0000-0000-000000000000',
        page_path: '/driver/dashboard?tab=earnings',
        dom_hash: testDomHash,
        locale,
        candidates: [
          {
            candidate_id: testCandidateId,
            tag: 'button',
            role: 'button',
            text: 'Withdraw Instant Cash',
            accessible_name: 'Instant Driver Earnings Payout',
            css_selector: 'button#renamed-instant-cash-btn',
            attrs: {
              id: 'renamed-instant-cash-btn',
              'data-testid': 'instant-payout-cta',
              class: 'btn-emerald-cta-payout',
            },
            landmark: 'section#driver-payout-hub',
          },
          {
            candidate_id: 'cand_nav_home',
            tag: 'a',
            role: 'link',
            text: 'Back to Home',
            css_selector: 'a.nav-home',
          },
        ],
      })
      setHealResult(resp)
    } catch (err: unknown) {
      alert(`Simulation failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setHealLoading(false)
    }
  }

  const getRouteBadge = (route?: string) => {
    switch (route) {
      case 'feature_match':
        return <Badge variant="primary">🎯 Workflow Matched</Badge>
      case 'rag_answer':
        return <Badge variant="blue">📚 Knowledge RAG</Badge>
      case 'smalltalk':
        return <Badge variant="blue">👋 Greeting / Help</Badge>
      case 'out_of_scope':
        return <Badge variant="amber">🛡️ Guardrail Filter</Badge>
      default:
        return null
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner & Context Controls */}
      <div
        style={{
          backgroundColor: '#121418',
          border: '1px solid #1F2229',
          borderRadius: '12px',
          padding: '16px 20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            marginBottom: '16px',
            paddingBottom: '14px',
            borderBottom: '1px solid #1F2229',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={20} style={{ color: '#10B981' }} />
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>
                Runtime Chat Router & Self-Healing Simulator
              </h2>
            </div>
            <p style={{ fontSize: '13px', color: '#8E929F', margin: '4px 0 0 0' }}>
              Simulate visitor sessions against <code style={{ color: '#10B981' }}>/api/v1/sdk/chat</code> and{' '}
              <code style={{ color: '#10B981' }}>/api/v1/sdk/heal</code>.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#8E929F', textTransform: 'uppercase' }}>Key:</span>
            <code
              style={{
                fontFamily: 'monospace',
                fontSize: '11px',
                padding: '4px 8px',
                backgroundColor: '#0A0A0C',
                border: '1px solid #27272A',
                borderRadius: '4px',
                color: '#10B981',
              }}
            >
              {publishableKey ? `${publishableKey.substring(0, 14)}...` : 'Detecting key...'}
            </code>
          </div>
        </div>

        {/* Visitor Context Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          {/* Auth State Switch */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: '#8E929F', fontWeight: 500 }}>Auth State:</span>
            <button
              onClick={() => setIsLoggedIn(!isLoggedIn)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid',
                backgroundColor: isLoggedIn ? 'rgba(16, 185, 129, 0.15)' : '#1A1C23',
                borderColor: isLoggedIn ? '#10B981' : '#2D3139',
                color: isLoggedIn ? '#10B981' : '#8E929F',
                transition: 'all 0.15s ease',
              }}
            >
              {isLoggedIn ? <Unlock size={14} /> : <Lock size={14} />}
              <span>{isLoggedIn ? 'Logged In' : 'Logged Out (Prereq Test)'}</span>
            </button>
          </div>

          {/* User Role */}
          {isLoggedIn && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#8E929F', fontWeight: 500 }}>Role:</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['driver', 'passenger'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '5px',
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      border: '1px solid',
                      backgroundColor: role === r ? '#2A2D37' : 'transparent',
                      borderColor: role === r ? '#4E5362' : 'transparent',
                      color: role === r ? '#FFFFFF' : '#8E929F',
                    }}
                  >
                    <User size={11} style={{ display: 'inline', marginRight: '4px' }} />
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Locale Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#8E929F', fontWeight: 500 }}>Locale:</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[
                { code: 'en', label: 'English' },
                { code: 'hi', label: 'हिन्दी (Hindi)' },
              ].map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLocale(l.code as 'en' | 'hi')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '5px',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: '1px solid',
                    backgroundColor: locale === l.code ? '#2A2D37' : 'transparent',
                    borderColor: locale === l.code ? '#4E5362' : 'transparent',
                    color: locale === l.code ? '#FFFFFF' : '#8E929F',
                  }}
                >
                  <Globe size={11} style={{ display: 'inline', marginRight: '4px' }} />
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Chat Sandbox on Left, Self-Healing Simulator on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
        {/* Left Column: Chat Sandbox */}
        <div
          style={{
            backgroundColor: '#121418',
            border: '1px solid #1F2229',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            height: '620px',
            overflow: 'hidden',
          }}
        >
          {/* Quick Prompt Chips */}
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#0D0E11',
              borderBottom: '1px solid #1F2229',
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            {QUICK_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(p.text)}
                disabled={chatLoading}
                style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  backgroundColor: '#181A20',
                  border: '1px solid #2A2D36',
                  color: '#D1D5DB',
                  fontSize: '11px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'background-color 0.15s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Message Stream */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                {/* Meta Header for Assistant Messages */}
                {m.sender === 'assistant' && m.routeTaken && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {getRouteBadge(m.routeTaken)}
                    {m.similarity !== undefined && m.similarity !== null && (
                      <span style={{ fontSize: '10px', color: '#8E929F', fontFamily: 'monospace' }}>
                        {(m.similarity * 100).toFixed(0)}% match
                      </span>
                    )}
                  </div>
                )}

                {/* Bubble */}
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    lineHeight: 1.5,
                    backgroundColor: m.sender === 'user' ? '#10B981' : '#1A1C22',
                    color: m.sender === 'user' ? '#0A0A0C' : '#F3F4F6',
                    fontWeight: m.sender === 'user' ? 500 : 400,
                    border: m.sender === 'user' ? 'none' : '1px solid #262933',
                  }}
                >
                  {m.text}
                </div>

                {/* Stitched Tour Plan Visualizer */}
                {m.tourPlan && (
                  <div
                    style={{
                      marginTop: '8px',
                      backgroundColor: '#0A0B0E',
                      border: '1px solid #20232B',
                      borderRadius: '8px',
                      padding: '12px',
                    }}
                  >
                    {/* Prereq Notice */}
                    {m.tourPlan.requires_login_first && (
                      <div
                        style={{
                          backgroundColor: 'rgba(245, 158, 11, 0.1)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          borderRadius: '6px',
                          padding: '8px 10px',
                          marginBottom: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          color: '#FBBF24',
                          fontSize: '11px',
                        }}
                      >
                        <Lock size={14} />
                        <span>
                          <strong>Auth Prerequisite Stitched:</strong> Logged out user is guided through{' '}
                          <code style={{ textDecoration: 'underline' }}>login</code> first, then seamlessly to{' '}
                          <code style={{ textDecoration: 'underline' }}>{m.tourPlan.target_feature_slug}</code>.
                        </span>
                      </div>
                    )}

                    {/* Steps Chain */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          color: '#8E929F',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Stitched Execution Steps ({m.tourPlan.steps.length}):
                      </div>

                      {m.tourPlan.steps.map((s) => (
                        <div
                          key={s.step_id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#12141A',
                            border: '1px solid #222530',
                            borderRadius: '5px',
                            padding: '6px 10px',
                            fontSize: '11px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                backgroundColor: s.feature_slug === 'login' ? '#F59E0B' : '#10B981',
                                color: '#0A0A0C',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                fontWeight: 700,
                              }}
                            >
                              {s.execution_index}
                            </span>
                            <span style={{ color: '#FFFFFF', fontWeight: 500 }}>
                              {s.content?.en?.title || s.guide_id}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontFamily: 'monospace', color: '#8E929F', fontSize: '10px' }}>
                              {s.route_pattern}
                            </span>
                            <Badge variant={s.feature_slug === 'login' ? 'amber' : 'emerald'}>
                              {s.feature_slug}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {chatLoading && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#8E929F',
                  fontSize: '12px',
                }}
              >
                <Loader2 size={16} className="animate-spin" style={{ color: '#10B981' }} />
                <span>Classifying intent & stitching workflow...</span>
              </div>
            )}
          </div>

          {/* Input Box */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#0D0E11',
              borderTop: '1px solid #1F2229',
              display: 'flex',
              gap: '10px',
            }}
          >
            <input
              type="text"
              placeholder="Ask GuideKit a workflow question..."
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={chatLoading}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '6px',
                backgroundColor: '#16181F',
                border: '1px solid #282B36',
                color: '#FFFFFF',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <Button
              variant="primary"
              onClick={() => handleSendMessage()}
              disabled={chatLoading || !inputMsg.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Send size={14} />
              <span>Send</span>
            </Button>
          </div>
        </div>

        {/* Right Column: DOM Self-Healing Simulator */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              backgroundColor: '#121418',
              border: '1px solid #1F2229',
              borderRadius: '12px',
              padding: '18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Zap size={18} style={{ color: '#10B981' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>
                Tier 3 DOM Self-Healing Resolver
              </h3>
            </div>

            <p style={{ fontSize: '12px', color: '#8E929F', lineHeight: 1.4, margin: '0 0 14px 0' }}>
              Simulates what happens in the user&apos;s browser when CSS selectors break due to a UI redesign.
              Sends candidate elements to <code style={{ color: '#10B981' }}>POST /api/v1/sdk/heal</code>.
            </p>

            <div style={{ marginBottom: '14px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#8E929F',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                }}
              >
                Target Workflow Step
              </label>
              <select
                value={selectedStepId}
                onChange={(e) => setSelectedStepId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  backgroundColor: '#0A0A0C',
                  border: '1px solid #27272A',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  outline: 'none',
                }}
              >
                <option value="">(Default: Instant Cash CTA Step)</option>
                {features.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.slug} ({f.step_count} steps)
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="secondary"
              onClick={handleSimulateHeal}
              disabled={healLoading}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              {healLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Resolving DOM Element...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} style={{ color: '#10B981' }} />
                  <span>Simulate Renamed Button (Tier 3 Heal)</span>
                </>
              )}
            </Button>

            {/* Heal Response View */}
            {healResult && (
              <div
                style={{
                  marginTop: '16px',
                  backgroundColor: '#0A0B0E',
                  border: '1px solid #252834',
                  borderRadius: '8px',
                  padding: '14px',
                  fontSize: '12px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                  }}
                >
                  <Badge variant={healResult.status === 'cache_hit' ? 'blue' : 'emerald'}>
                    {healResult.status === 'cache_hit' ? '⚡ 0ms Cache Hit' : '✨ Healed by AI'}
                  </Badge>
                  <span style={{ fontSize: '11px', color: '#10B981', fontFamily: 'monospace', fontWeight: 600 }}>
                    {(healResult.confidence * 100).toFixed(0)}% Confidence
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: '#D1D5DB' }}>
                  <div>
                    <span style={{ color: '#8E929F' }}>Suggested Selector: </span>
                    <code style={{ color: '#10B981', fontFamily: 'monospace' }}>
                      {healResult.suggested_selector || 'None'}
                    </code>
                  </div>
                  <div>
                    <span style={{ color: '#8E929F' }}>Target Tag: </span>
                    <span>{(healResult.resolved_candidate?.tag as string) || 'button'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#8E929F' }}>Matched Text: </span>
                    <span>{(healResult.resolved_candidate?.text as string) || 'Withdraw Instant Cash'}</span>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '12px',
                    paddingTop: '10px',
                    borderTop: '1px solid #1E2129',
                    fontSize: '11px',
                    color: '#8E929F',
                  }}
                >
                  ✓ Cached in <code style={{ color: '#D1D5DB' }}>step_resolution_cache</code> (7-day TTL).
                  <br />✓ Suggestion added to the <strong>Self-Healing Inbox</strong> tab for approval.
                </div>
              </div>
            )}
          </div>

          {/* Info Card */}
          <div
            style={{
              backgroundColor: '#121418',
              border: '1px solid #1F2229',
              borderRadius: '12px',
              padding: '16px',
              fontSize: '12px',
              color: '#8E929F',
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 600, color: '#FFFFFF', marginBottom: '6px' }}>
              How the Self-Healing Ladder Works:
            </div>
            <ol style={{ paddingLeft: '16px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>
                <strong>Tier 1:</strong> Primary <code style={{ color: '#10B981' }}>data-guide-id</code> (~0ms).
              </li>
              <li>
                <strong>Tier 2:</strong> Deterministic client fingerprint scoring (~2ms).
              </li>
              <li>
                <strong>Tier 3:</strong> Pruned candidate AI resolution + 7-day server cache (~15ms).
              </li>
              <li>
                <strong>Tier 4:</strong> Graceful text instruction fallback (never crashes).
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

