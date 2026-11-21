'use client'

import { useState, useEffect, useCallback, KeyboardEvent } from 'react'
import {
  Lock,
  Layers,
  ChevronRight,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  X,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { FuseButton } from '@/components/ui/FuseButton'
import { Spinner } from '@heroui/react/spinner'
import { Alert } from '@heroui/react/alert'
import { Skeleton } from '@heroui/react/skeleton'
import { Tooltip } from '@heroui/react/tooltip'
import { toast } from '@heroui/react/toast'
import { StepDrawer } from './StepDrawer'
import type { FeatureSummary, FeatureDetail, ManifestPublishResult } from '@/lib/types'
import styles from './ProjectWorkspace.module.css'

interface FeaturesTabProps {
  projectId: string
  onPublished?: (result: ManifestPublishResult) => void
}

export function FeaturesTab({ projectId, onPublished }: FeaturesTabProps) {
  const [features, setFeatures] = useState<FeatureSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFeature, setSelectedFeature] = useState<FeatureDetail | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerLoading, setDrawerLoading] = useState(false)

  // Publishing state
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<ManifestPublishResult | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)

  const loadFeatures = useCallback(async () => {
    try {
      const data = await api.features.list(projectId)
      setFeatures(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load features')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadFeatures()
  }, [loadFeatures])

  const handleOpen = async (feature: FeatureSummary) => {
    setDrawerOpen(true)
    setDrawerLoading(true)
    try {
      const detail = await api.features.get(projectId, feature.id)
      setSelectedFeature(detail)
    } catch {
      setSelectedFeature(null)
      toast.danger('Failed to load workflow steps.')
    } finally {
      setDrawerLoading(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent, feature: FeatureSummary) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleOpen(feature)
    }
  }

  const handlePublish = async () => {
    setPublishing(true)
    setPublishError(null)
    setPublishResult(null)
    try {
      const res = await api.publisher.publish(projectId)
      setPublishResult(res)
      toast.success(`Manifest v${res.manifest_version} published to CDN.`)
      if (onPublished) onPublished(res)
      await loadFeatures()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to publish manifest'
      setPublishError(msg)
      toast.danger(msg)
    } finally {
      setPublishing(false)
    }
  }

  const draftCount = features.filter((f) => !!f.draft_version).length
  const publishedCount = features.filter((f) => !!f.published_version).length

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert status="danger" className="border border-red-400/25 bg-red-500/[0.08] text-red-200 rounded-xl p-4">
        <Alert.Indicator>
          <AlertCircle size={18} />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title className="font-semibold text-sm">Failed to load workflows</Alert.Title>
          <Alert.Description className="text-xs mt-1">{error}</Alert.Description>
        </Alert.Content>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Top Metrics & Action Bar */}
      <div className={styles.featuresTopBar}>
        <div className={styles.featuresMetrics}>
          <span className={styles.featuresCount}>
            {features.length} Workflow{features.length !== 1 ? 's' : ''}
          </span>
          {draftCount > 0 ? (
            <span className={styles.statusPillDraft}>
              <Clock size={12} aria-hidden="true" />
              <span>{draftCount} Pending Draft{draftCount !== 1 ? 's' : ''}</span>
            </span>
          ) : (
            <span className={styles.statusPillPublished}>
              <CheckCircle2 size={12} aria-hidden="true" />
              <span>All Workflows Published</span>
            </span>
          )}
        </div>

        <Tooltip>
          <Tooltip.Trigger>
            <div>
              <FuseButton
                variant="primary"
                size="md"
                onClick={handlePublish}
                disabled={publishing || features.length === 0}
                isLoading={publishing}
                loadingText="Compiling & Publishing..."
                icon={<UploadCloud size={15} strokeWidth={2} aria-hidden="true" />}
              >
                Publish Manifest to CDN {draftCount > 0 ? `(${draftCount} Drafts)` : ''}
              </FuseButton>
            </div>
          </Tooltip.Trigger>
          <Tooltip.Content>
            {draftCount > 0
              ? 'Compile and deploy pending draft workflows to production CDN'
              : 'Manifest is up to date with live CDN'}
          </Tooltip.Content>
        </Tooltip>
      </div>

      {/* Publish Success Banner */}
      {publishResult && (
        <div className="flex items-center justify-between p-4 bg-[#52a9ff]/[0.12] border border-[#52a9ff]/[0.5] rounded-xl text-[#75bbef]">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={18} className="text-[#75bbef] shrink-0" aria-hidden="true" />
            <div className="text-xs text-[#f1f4f9]">
              <span className="font-semibold text-[#75bbef]">
                Manifest v{publishResult.manifest_version} successfully deployed!
              </span>{' '}
              Compiled {publishResult.feature_count} features ({publishResult.byte_size} bytes).
              ETag: <code className="font-mono bg-[#171c25] px-1.5 py-0.5 rounded border border-white/[0.11] text-[#f1f4f9]">{publishResult.etag}</code>
            </div>
          </div>
          <button
            onClick={() => setPublishResult(null)}
            className="text-[#8d97a8] hover:text-[#f1f4f9] p-1 rounded transition-colors"
            aria-label="Dismiss success message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Publish Error Banner */}
      {publishError && (
        <div className="flex items-center justify-between p-4 bg-red-500/[0.08] border border-red-400/25 rounded-xl text-red-200">
          <div className="flex items-center gap-2 text-xs">
            <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
            <span>{publishError}</span>
          </div>
          <button
            onClick={() => setPublishError(null)}
            className="text-red-200 hover:opacity-75 p-1"
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Features List */}
      {features.length === 0 ? (
        <div className={styles.emptyStateCard}>
          <div className={styles.emptyStateIcon}>
            <Layers size={22} strokeWidth={2} aria-hidden="true" />
          </div>
          <h2 className={styles.emptyStateTitle}>No workflows captured yet</h2>
          <p className={styles.emptyStateText}>
            Open your project in the GuideKit VS Code extension. Highlight any UI element in your source code and press{' '}
            <kbd className={styles.kbdPill}>Cmd + Shift + G</kbd> to capture procedural tour steps.
          </p>
        </div>
      ) : (
        <div className="bg-[#171c25] border border-white/[0.11] rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(23,26,24,0.02)]">
          {/* Table Header Row */}
          <div className="hidden sm:grid grid-cols-[1fr_120px_100px_40px] items-center px-5 py-3 bg-[#131820] border-b border-white/[0.11] text-xs font-semibold text-[#8d97a8] uppercase tracking-wider">
            <span>Workflow / Identifier</span>
            <span>Status</span>
            <span>Steps</span>
            <span className="text-right sr-only">View</span>
          </div>

          <div role="list" aria-label="Workflow list" className="divide-y divide-white/[0.08]">
            {features.map((feature) => {
              const isPublished = !!feature.published_version
              const isDraft = !!feature.draft_version
              const requiresAuth =
                feature.published_version?.requires_auth || feature.draft_version?.requires_auth

              return (
                <div
                  key={feature.id}
                  role="listitem"
                  tabIndex={0}
                  onClick={() => handleOpen(feature)}
                  onKeyDown={(e) => handleKeyDown(e, feature)}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_120px_100px_40px] items-center px-5 py-4 hover:bg-[#131820] cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52a9ff] focus-visible:ring-inset gap-3 sm:gap-0"
                  aria-label={`Workflow ${feature.slug}, ${feature.step_count} steps`}
                >
                  {/* Left Column: Icon + Slug + Auth */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#1b222d] border border-white/[0.11] flex items-center justify-center text-[#b8c0ce] shrink-0">
                      <Layers size={16} strokeWidth={1.75} aria-hidden="true" />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="font-mono text-xs font-semibold text-[#f1f4f9] bg-[#131820] px-2 py-0.5 rounded border border-white/[0.11]">
                        {feature.slug}
                      </code>

                      {requiresAuth && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1b222d] border border-white/[0.11] text-[11px] font-medium text-[#8d97a8]" title="Requires authenticated user session">
                          <Lock size={10} aria-hidden="true" />
                          <span>Auth required</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Column */}
                  <div className="flex items-center">
                    {isPublished && <Badge variant="primary">Published</Badge>}
                    {isDraft && <Badge variant="amber">Draft</Badge>}
                    {!isPublished && !isDraft && <Badge variant="gray">No Version</Badge>}
                  </div>

                  {/* Steps Column */}
                  <div className="flex items-center gap-1.5 text-xs text-[#b8c0ce]">
                    <Layers size={13} className="text-[#8d97a8]" aria-hidden="true" />
                    <span className="font-medium">
                      {feature.step_count} step{feature.step_count !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Action / Chevron Column */}
                  <div className="flex justify-end text-[#8d97a8]">
                    <ChevronRight size={16} aria-hidden="true" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Step Drawer */}
      <StepDrawer
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setSelectedFeature(null)
        }}
        feature={selectedFeature}
        loading={drawerLoading}
      />
    </div>
  )
}
