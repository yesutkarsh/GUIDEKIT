'use client'

import { useState, useEffect, useCallback } from 'react'
import { Activity, Hash, Clock, MapPin, Sparkles, CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { HoldButton } from '@/components/ui/HoldButton'
import { FuseButton } from '@/components/ui/FuseButton'
import { Skeleton } from '@heroui/react/skeleton'
import { Alert } from '@heroui/react/alert'
import { toast } from '@heroui/react/toast'
import { HealDiffViewer } from './HealDiffViewer'
import type { HealSuggestion } from '@/lib/types'

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected'

interface HealSuggestionsTabProps {
  projectId: string
}

export function HealSuggestionsTab({ projectId }: HealSuggestionsTabProps) {
  const [suggestions, setSuggestions] = useState<HealSuggestion[]>([])
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.healSuggestions.list(
        projectId,
        filter === 'all' ? undefined : filter
      )
      setSuggestions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load heal suggestions')
    } finally {
      setLoading(false)
    }
  }, [projectId, filter])

  useEffect(() => {
    load()
  }, [load])

  const handleReview = async (id: string, action: 'approve' | 'reject') => {
    setReviewingId(id)
    try {
      await api.healSuggestions.review(projectId, id, action)
      toast.success(action === 'approve' ? 'Suggestion approved into draft.' : 'Suggestion rejected.')
      await load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to ${action} suggestion`
      toast.danger(msg)
    } finally {
      setReviewingId(null)
    }
  }

  const filterTabs: { id: FilterStatus; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending Review' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
  ]

  return (
    <div className="flex flex-col gap-5">


      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filterTabs.map((tab) => {
          const isActive = filter === tab.id
          const count =
            tab.id === 'all'
              ? suggestions.length
              : suggestions.filter((s) => s.status === tab.id).length

          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 -mb-[1px] ${isActive
                ? 'border-[#52a9ff]/[0.5] text-[#75bbef] bg-[#171c25]'
                : 'border-transparent text-[#8d97a8] hover:text-[#f1f4f9]'
                }`}
            >
              <span>{tab.label}</span>
              {count > 0 && (
                <span
                  className={`px-1.5 py-0.5 text-[11px] rounded-full font-bold ${isActive ? 'bg-[#52a9ff]/[0.12] text-[#75bbef]' : 'bg-[#1b222d] text-[#b8c0ce]'
                    }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <Alert status="danger" className="border border-red-400/25 bg-red-500/[0.08] text-red-200 rounded-xl p-4">
          <Alert.Indicator>
            <Activity size={18} />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title className="text-sm font-semibold">Error Loading Inbox</Alert.Title>
            <Alert.Description className="text-xs mt-1">{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {/* Empty State */}
      {!loading && !error && suggestions.length === 0 && (
        <div className="py-16 px-6 text-center bg-[#171c25] border border-white/[0.11] rounded-xl text-[#b8c0ce]">
          <div className="w-12 h-12 rounded-xl bg-[#52a9ff]/[0.12] text-[#75bbef] flex items-center justify-center mx-auto mb-3">
            <Sparkles size={22} strokeWidth={2} />
          </div>
          <p className="text-sm font-semibold text-[#f1f4f9] m-0 mb-1">
            No heal suggestions in this category
          </p>
          <p className="text-xs text-[#8d97a8] max-w-md mx-auto m-0">
            When customer web apps encounter altered DOM trees, the Tier 3 AI engine repairs them and posts 1-click approvals here.
          </p>
        </div>
      )}

      {/* Suggestions List */}
      {!loading && !error && (
        <div className="flex flex-col gap-3">
          {suggestions.map((s) => {
            const confidence = s.confidence ?? 0
            const isReviewed = s.status === 'approved' || s.status === 'rejected'
            const isReviewing = reviewingId === s.id

            return (
              <div
                key={s.id}
                className="bg-[#171c25] border border-white/[0.11] rounded-xl p-5 flex flex-col gap-3 shadow-[0_1px_3px_rgba(23,26,24,0.02)] transition-all hover:border-white/[0.24]"
              >
                {/* Header */}
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {s.feature_slug && (
                      <code className="text-xs font-mono font-semibold bg-[#1b222d] px-2 py-0.5 rounded border border-white/[0.11] text-[#f1f4f9]">
                        {s.feature_slug}
                      </code>
                    )}
                    {s.guide_id && (
                      <span className="text-[11px] font-mono text-[#75bbef] bg-[#52a9ff]/[0.12] px-1.5 py-0.5 rounded">
                        {s.guide_id}
                      </span>
                    )}
                    {s.route_pattern && (
                      <div className="flex items-center gap-1 text-xs text-[#b8c0ce]">
                        <MapPin size={12} className="text-[#8d97a8]" />
                        <span>{s.route_pattern}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={confidence >= 0.85 ? 'emerald' : 'amber'}>
                      {Math.round(confidence * 100)}% confidence
                    </Badge>
                    {isReviewed && (
                      <Badge variant={s.status === 'approved' ? 'emerald' : 'rose'}>
                        {s.status}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Diff Viewer */}
                <HealDiffViewer
                  oldSelector={null}
                  newSelector={s.suggested_selector}
                />

                {/* Footer Metadata & Actions */}
                <div className="flex items-center justify-between flex-wrap gap-3 pt-1 border-t border-white/[0.08]">
                  <div className="flex items-center gap-3.5 text-xs text-[#8d97a8]">
                    <span className="flex items-center gap-1">
                      <Hash size={12} />
                      <span>{s.occurrences} occurrence{s.occurrences !== 1 ? 's' : ''}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      <span>{new Date(s.last_seen_at).toLocaleDateString()}</span>
                    </span>
                  </div>

                  {!isReviewed && (
                    <div className="flex items-center gap-2">
                      {/* React Bits HoldButton to reject safely */}
                      <HoldButton
                        onHoldComplete={() => handleReview(s.id, 'reject')}
                        disabled={isReviewing}
                        label="Hold to Reject"
                        size="sm"
                      />

                      {/* React Bits FuseButton to approve into draft */}
                      <FuseButton
                        variant="primary"
                        size="sm"
                        isLoading={isReviewing}
                        loadingText="Approving..."
                        icon={<CheckCircle2 size={13} />}
                        onClick={() => handleReview(s.id, 'approve')}
                      >
                        Approve into Draft
                      </FuseButton>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
