'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  MessageSquare,
  Compass,
  Sparkles,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Zap,
  Bot,
  Layers,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@heroui/react/spinner'
import { Alert } from '@heroui/react/alert'
import { Skeleton } from '@heroui/react/skeleton'
import type { Analytics } from '@/lib/types'

interface AnalyticsTabProps {
  projectId: string
}

export function AnalyticsTab({ projectId }: AnalyticsTabProps) {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setIsRefreshing(true)
    setError(null)
    try {
      const res = await api.analytics.get(projectId)
      setData(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchAnalytics()
  }, [projectId, fetchAnalytics])

  // Calculations
  const metrics = useMemo(() => {
    if (!data) return null

    const tourStarted = data.tours.started || 0
    const tourCompleted = data.tours.completed || 0
    const completionRate =
      tourStarted > 0 ? Math.round((tourCompleted / tourStarted) * 100) : 0

    const totalChatMessages = data.chat.total_messages || 0
    const routeMatch = data.chat.by_route?.['feature_match'] || 0
    const routeRag = data.chat.by_route?.['rag_answer'] || 0
    const routeOther = Math.max(0, totalChatMessages - (routeMatch + routeRag))

    const featureMatchPct =
      totalChatMessages > 0 ? Math.round((routeMatch / totalChatMessages) * 100) : 0
    const ragPct =
      totalChatMessages > 0 ? Math.round((routeRag / totalChatMessages) * 100) : 0
    const otherPct = Math.max(0, 100 - (featureMatchPct + ragPct))

    const resPrimary = data.resolution.matched_primary || 0
    const resFingerprint = data.resolution.matched_fingerprint || 0
    const resAi = data.resolution.healed_by_ai || 0
    const resFallback = data.resolution.fallback_to_text || 0
    const resTotal = resPrimary + resFingerprint + resAi + resFallback || 1

    const primaryPct = Math.round((resPrimary / resTotal) * 100)
    const fingerprintPct = Math.round((resFingerprint / resTotal) * 100)
    const aiPct = Math.round((resAi / resTotal) * 100)
    const fallbackPct = Math.max(0, 100 - (primaryPct + fingerprintPct + aiPct))

    return {
      tourStarted,
      tourCompleted,
      completionRate,
      totalChatMessages,
      routeMatch,
      routeRag,
      routeOther,
      featureMatchPct,
      ragPct,
      otherPct,
      resPrimary,
      resFingerprint,
      resAi,
      resFallback,
      resTotal,
      primaryPct,
      fingerprintPct,
      aiPct,
      fallbackPct,
    }
  }, [data])

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (error || !data || !metrics) {
    return (
      <Alert status="danger" className="border border-red-400/25 bg-red-500/[0.08] text-red-200 rounded-xl p-4">
        <Alert.Indicator>
          <AlertCircle size={18} />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title className="font-semibold text-sm">Failed to Load Analytics</Alert.Title>
          <Alert.Description className="text-xs mt-1">{error || 'Data unavailable'}</Alert.Description>
        </Alert.Content>
      </Alert>
    )
  }

  // Donut chart stroke circumference for 2 * PI * 40 ~= 251.2
  const circumference = 251.2
  const primaryOffset = circumference * (1 - metrics.primaryPct / 100)
  const fingerprintOffset = circumference * (1 - metrics.fingerprintPct / 100)
  const aiOffset = circumference * (1 - metrics.aiPct / 100)

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header & Refresh */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#f1f4f9] m-0">
            Analytics & Runtime Health
          </h2>
          <p className="text-xs text-[#b8c0ce] m-0 mt-0.5">
            Real-time telemetry on guided tour completions, chat inquiries, and Tier 1–4 resolution health.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {data.latest_manifest && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#52a9ff]/[0.12] border border-[#52a9ff]/[0.28] text-[#75bbef] rounded-lg text-xs font-semibold">
              <Zap size={13} />
              <span>Manifest v{data.latest_manifest.manifest_version}</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => fetchAnalytics(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#171c25] border border-white/[0.11] text-[#f1f4f9] rounded-lg text-xs font-semibold hover:bg-[#1b222d] transition-colors"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Integrated Telemetry Summary Strip (High-Density Developer Dashboard Pattern) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-[#171c25] border border-white/[0.11] rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(23,26,24,0.02)] divide-y sm:divide-y-0 sm:divide-x divide-white/[0.08]">
        {/* Metric 1 */}
        <div className="p-5 flex flex-col justify-between hover:bg-[#131820] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#8d97a8] uppercase tracking-wider">
              Tour Completion
            </span>
            <Compass size={15} className="text-[#75bbef]" aria-hidden="true" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#f1f4f9] tracking-tight font-mono">
              {metrics.completionRate}%
            </div>
            <p className="m-0 mt-1 text-xs text-[#b8c0ce]">
              {metrics.tourCompleted} finished of {metrics.tourStarted} started
            </p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-5 flex flex-col justify-between hover:bg-[#131820] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#8d97a8] uppercase tracking-wider">
              GuideBot Chats
            </span>
            <MessageSquare size={15} className="text-[#2563eb]" aria-hidden="true" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#f1f4f9] tracking-tight font-mono">
              {metrics.totalChatMessages}
            </div>
            <p className="m-0 mt-1 text-xs text-[#b8c0ce]">
              Across {data.chat.total_sessions || 0} user sessions
            </p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-5 flex flex-col justify-between hover:bg-[#131820] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#8d97a8] uppercase tracking-wider">
              AI DOM Auto-Heals
            </span>
            <Sparkles size={15} className="text-[#d97706]" aria-hidden="true" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#f1f4f9] tracking-tight font-mono">
              {metrics.resAi}
            </div>
            <p className="m-0 mt-1 text-xs text-[#b8c0ce]">
              {metrics.aiPct}% of total step resolutions
            </p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5 flex flex-col justify-between hover:bg-[#131820] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#8d97a8] uppercase tracking-wider">
              Healthy Resolution
            </span>
            <ShieldCheck size={15} className="text-[#75bbef]" aria-hidden="true" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#f1f4f9] tracking-tight font-mono">
              {metrics.primaryPct + metrics.fingerprintPct}%
            </div>
            <p className="m-0 mt-1 text-xs text-[#b8c0ce]">
              Tier 1 & Tier 2 direct DOM matches
            </p>
          </div>
        </div>
      </div>

      {/* ShadCN-style Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart 1: ShadCN-style Donut Chart (Resolution Ladder) */}
        <div className="p-6 bg-[#171c25] border border-white/[0.11] rounded-xl shadow-[0_1px_3px_rgba(23,26,24,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="m-0 text-sm font-semibold text-[#f1f4f9]">
                Resolution Health Ladder
              </h3>
              <span className="text-xs text-[#8d97a8]">{metrics.resTotal} steps tracked</span>
            </div>
            <p className="m-0 text-xs text-[#b8c0ce] mb-5">
              Breakdown of how the SDK resolved DOM elements across the 4 resilience tiers.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 my-2">
            {/* SVG Donut */}
            <div className="relative w-44 h-44 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#252c38"
                  strokeWidth="10"
                />
                {/* Primary Arc (Tier 1 Emerald) */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#52a9ff"
                  strokeWidth="10"
                  strokeDasharray={circumference}
                  strokeDashoffset={primaryOffset}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
                {/* Fingerprint Arc (Tier 2 Blue) */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#2563eb"
                  strokeWidth="10"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - (metrics.primaryPct + metrics.fingerprintPct) / 100)}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
                {/* AI Arc (Tier 3 Amber) */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#d97706"
                  strokeWidth="10"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - (metrics.primaryPct + metrics.fingerprintPct + metrics.aiPct) / 100)}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              </svg>

              {/* Center Donut Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold text-[#f1f4f9]">
                  {metrics.primaryPct}%
                </span>
                <span className="text-[11px] font-medium text-[#8d97a8]">
                  Healthy T1
                </span>
              </div>
            </div>

            {/* Legend Breakdown */}
            <div className="flex flex-col gap-2.5 w-full sm:w-auto">
              <div className="flex items-center justify-between gap-6 text-xs p-2 rounded-lg bg-[#131820] border border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#52a9ff]" />
                  <span className="font-medium text-[#f1f4f9]">Tier 1 · Primary Match</span>
                </div>
                <span className="font-semibold text-[#f1f4f9]">{metrics.primaryPct}% ({metrics.resPrimary})</span>
              </div>

              <div className="flex items-center justify-between gap-6 text-xs p-2 rounded-lg bg-[#131820] border border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" />
                  <span className="font-medium text-[#f1f4f9]">Tier 2 · Fingerprint Fallback</span>
                </div>
                <span className="font-semibold text-[#f1f4f9]">{metrics.fingerprintPct}% ({metrics.resFingerprint})</span>
              </div>

              <div className="flex items-center justify-between gap-6 text-xs p-2 rounded-lg bg-[#131820] border border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#d97706]" />
                  <span className="font-medium text-[#f1f4f9]">Tier 3 · AI Auto-Healed</span>
                </div>
                <span className="font-semibold text-[#f1f4f9]">{metrics.aiPct}% ({metrics.resAi})</span>
              </div>

              <div className="flex items-center justify-between gap-6 text-xs p-2 rounded-lg bg-[#131820] border border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#e11d48]" />
                  <span className="font-medium text-[#f1f4f9]">Tier 4 · Text Banner</span>
                </div>
                <span className="font-semibold text-[#f1f4f9]">{metrics.fallbackPct}% ({metrics.resFallback})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart 2: ShadCN-style Stacked Horizontal Intent Bars */}
        <div className="p-6 bg-[#171c25] border border-white/[0.11] rounded-xl shadow-[0_1px_3px_rgba(23,26,24,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="m-0 text-sm font-semibold text-[#f1f4f9]">
                GuideBot Intent Routing
              </h3>
              <span className="text-xs text-[#8d97a8]">{metrics.totalChatMessages} queries</span>
            </div>
            <p className="m-0 text-xs text-[#b8c0ce] mb-5">
              How user inquiries were routed between interactive tours and knowledge base RAG answers.
            </p>
          </div>

          <div className="flex flex-col gap-5 my-2">
            {/* Horizontal Bar Breakdown */}
            <div>
              <div className="h-3.5 w-full bg-[#1b222d] rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${metrics.featureMatchPct}%` }}
                  className="bg-[#52a9ff] h-full transition-all duration-700 ease-out"
                  title={`Workflow Matches: ${metrics.featureMatchPct}%`}
                />
                <div
                  style={{ width: `${metrics.ragPct}%` }}
                  className="bg-[#2563eb] h-full transition-all duration-700 ease-out"
                  title={`RAG Knowledge Answers: ${metrics.ragPct}%`}
                />
                <div
                  style={{ width: `${metrics.otherPct}%` }}
                  className="bg-[#9ca3af] h-full transition-all duration-700 ease-out"
                  title={`Other Conversational: ${metrics.otherPct}%`}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-[#8d97a8] mt-2">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Intent Cards */}
            <div className="flex flex-col gap-2.5">
              <div className="p-3 bg-[#131820] border border-white/[0.11] rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#52a9ff]" />
                  <div>
                    <span className="text-xs font-semibold text-[#f1f4f9] block">
                      Procedural Tour Matches
                    </span>
                    <span className="text-[11px] text-[#8d97a8]">
                      Triggered Driver.js spotlight flows directly from chat
                    </span>
                  </div>
                </div>
                <span className="text-sm font-bold text-[#75bbef]">
                  {metrics.featureMatchPct}%
                </span>
              </div>

              <div className="p-3 bg-[#131820] border border-white/[0.11] rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" />
                  <div>
                    <span className="text-xs font-semibold text-[#f1f4f9] block">
                      RAG Knowledge Answers
                    </span>
                    <span className="text-[11px] text-[#8d97a8]">
                      Answered using Mercury 3 LLM and indexed markdown/PDF chunks
                    </span>
                  </div>
                </div>
                <span className="text-sm font-bold text-[#2563eb]">
                  {metrics.ragPct}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
