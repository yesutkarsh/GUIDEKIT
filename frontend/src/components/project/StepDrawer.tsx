'use client'

import { useState, useEffect } from 'react'
import { X, ChevronRight, Layers, Lock, FileCode, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@heroui/react/spinner'
import type { FeatureDetail } from '@/lib/types'
import styles from './ProjectWorkspace.module.css'

interface StepDrawerProps {
  isOpen: boolean
  onClose: () => void
  feature: FeatureDetail | null
  loading?: boolean
}

const actionColors: Record<string, 'emerald' | 'amber' | 'blue' | 'rose' | 'gray'> = {
  click: 'emerald',
  fill: 'blue',
  navigate: 'amber',
  wait: 'gray',
  scroll: 'gray',
  hover: 'blue',
}

export function StepDrawer({ isOpen, onClose, feature, loading = false }: StepDrawerProps) {
  const [localeTabs, setLocaleTabs] = useState<Record<string, string>>({})

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const getLocaleTab = (stepId: string, defaultLocale: string) =>
    localeTabs[stepId] || defaultLocale

  const setLocaleTab = (stepId: string, locale: string) =>
    setLocaleTabs((prev) => ({ ...prev, [stepId]: locale }))

  return (
    <>
      {/* Backdrop */}
      <div
        className={styles.drawerBackdrop}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside
        className={styles.drawerPanel}
        role="dialog"
        aria-modal="true"
        aria-label={feature?.slug || 'Workflow Details'}
      >
        {/* Header */}
        <div className={styles.drawerHeader}>
          <div className={styles.drawerTitleGroup}>
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-[#75bbef]" aria-hidden="true" />
              <h2 className={styles.drawerTitle}>
                {feature?.slug || 'Workflow Details'}
              </h2>
            </div>
            {feature && (
              <p className={styles.drawerSubtitle}>
                {feature.versions.length} version{feature.versions.length !== 1 ? 's' : ''} ·{' '}
                {feature.steps.length} step{feature.steps.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className={styles.drawerCloseBtn}
            aria-label="Close drawer"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Body Content */}
        <div className={styles.drawerBody}>
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#b8c0ce]">
              <Spinner size="md" className="text-[#75bbef]" />
              <span className="text-sm font-medium">Loading workflow steps...</span>
            </div>
          )}

          {!loading && feature && feature.steps.length === 0 && (
            <div className="text-center py-16 text-[#b8c0ce]">
              <Layers size={32} className="mx-auto mb-3 opacity-30 text-[#75bbef]" />
              <p className="text-sm font-medium text-[#f1f4f9]">No steps defined for this workflow</p>
              <p className="text-xs text-[#8d97a8] mt-1">
                Open your IDE, select code elements, and add steps via GuideKit extension.
              </p>
            </div>
          )}

          {!loading && feature && feature.steps.length > 0 && (
            <div className={styles.stepTimeline}>
              {feature.steps
                .sort((a, b) => a.step_order - b.step_order)
                .map((step, idx) => {
                  const contentLocales = Object.keys(step.content || {})
                  const activeLocale = getLocaleTab(step.id, contentLocales[0] || 'en')

                  return (
                    <div key={step.id} className={styles.stepCard}>
                      {/* Step Header */}
                      <div className={styles.stepCardHeader}>
                        <div className={styles.stepIndexBadge}>
                          <span className="w-5 h-5 rounded-full bg-[#52a9ff]/[0.12] text-[#75bbef] flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-xs text-[#f1f4f9]">
                            Step {idx + 1}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono bg-[#1b222d] px-2 py-0.5 rounded border border-white/[0.11] text-[#f1f4f9] max-w-[200px] truncate">
                            {step.route_pattern}
                          </code>
                          <Badge variant={actionColors[step.action_type] || 'gray'}>
                            {step.action_type}
                          </Badge>
                        </div>
                      </div>

                      {/* Step Attributes */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-[#b8c0ce]">
                        <div>
                          Advance on: <strong className="text-[#f1f4f9]">{step.advance_on}</strong>
                        </div>
                        {step.guide_id && (
                          <div className="flex items-center gap-1">
                            <span>Guide:</span>
                            <code className="font-mono text-[#75bbef] bg-[#52a9ff]/[0.12] px-1.5 py-0.5 rounded text-[11px]">
                              {step.guide_id}
                            </code>
                          </div>
                        )}
                        {step.is_optional && <Badge variant="gray">Optional</Badge>}
                      </div>

                      {/* Target DOM Fingerprint & Selectors */}
                      {step.target_fingerprint && Object.keys(step.target_fingerprint).length > 0 && (
                        <div className="flex flex-col gap-2">
                          <div className="text-[11px] font-semibold text-[#8d97a8] uppercase tracking-wider flex items-center gap-1.5">
                            <FileCode size={12} aria-hidden="true" />
                            <span>Target DOM Inspection</span>
                          </div>

                          {/* Primary Selector Highlight */}
                          {Boolean(
                            (step.target_fingerprint as Record<string, unknown>).selector ||
                            (step.target_fingerprint as Record<string, unknown>).css_selector ||
                            (step.target_fingerprint as Record<string, unknown>).xpath
                          ) && (
                            <div className="flex items-center gap-2 p-2 bg-[#131820] border border-white/[0.11] rounded-md text-xs">
                              <span className="font-semibold text-[#8d97a8] shrink-0">Selector:</span>
                              <code className="font-mono text-[#75bbef] font-semibold truncate">
                                {String(
                                  (step.target_fingerprint as Record<string, unknown>).selector ||
                                  (step.target_fingerprint as Record<string, unknown>).css_selector ||
                                  (step.target_fingerprint as Record<string, unknown>).xpath
                                )}
                              </code>
                            </div>
                          )}

                          {/* Text match highlight if present */}
                          {Boolean((step.target_fingerprint as Record<string, unknown>).text) && (
                            <div className="flex items-center gap-2 p-2 bg-[#131820] border border-white/[0.11] rounded-md text-xs">
                              <span className="font-semibold text-[#8d97a8] shrink-0">Text Match:</span>
                              <span className="text-[#f1f4f9] font-medium truncate">
                                &ldquo;{String((step.target_fingerprint as Record<string, unknown>).text)}&rdquo;
                              </span>
                            </div>
                          )}

                          {/* Expandable Technical JSON Inspector */}
                          <details className="text-xs group">
                            <summary className="cursor-pointer text-[#8d97a8] hover:text-[#f1f4f9] font-medium py-1 select-none flex items-center gap-1">
                              <span>Raw Fingerprint Attributes</span>
                            </summary>
                            <div className={`${styles.selectorBox} mt-1`}>
                              {JSON.stringify(step.target_fingerprint, null, 2)}
                            </div>
                          </details>
                        </div>
                      )}

                      {/* Localized Content Display */}
                      {contentLocales.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between border-b border-white/[0.11] pb-1">
                            <span className="text-[11px] font-semibold text-[#8d97a8] uppercase tracking-wider">
                              Localized Tour Content
                            </span>
                            <div className="flex gap-1">
                              {contentLocales.map((locale) => (
                                <button
                                  key={locale}
                                  onClick={() => setLocaleTab(step.id, locale)}
                                  className={`text-xs px-2 py-0.5 rounded transition-colors ${
                                    locale === activeLocale
                                      ? 'bg-[#52a9ff]/[0.12] text-[#75bbef] font-semibold'
                                      : 'text-[#8d97a8] hover:text-[#f1f4f9]'
                                  }`}
                                >
                                  {locale.toUpperCase()}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Render title and description if present, else JSON */}
                          {(() => {
                            const locObj = (step.content as Record<string, unknown>)[activeLocale] as
                              | Record<string, unknown>
                              | undefined
                            if (locObj && (locObj.title || locObj.body || locObj.description)) {
                              return (
                                <div className="p-3 bg-[#131820] border border-white/[0.11] rounded-lg flex flex-col gap-1 text-xs">
                                  {Boolean(locObj.title) && (
                                    <div className="font-semibold text-sm text-[#f1f4f9]">
                                      {String(locObj.title)}
                                    </div>
                                  )}
                                  {Boolean(locObj.body || locObj.description) && (
                                    <div className="text-[#b8c0ce] leading-relaxed">
                                      {String(locObj.body || locObj.description)}
                                    </div>
                                  )}
                                </div>
                              )
                            }
                            return (
                              <div className={styles.selectorBox}>
                                {JSON.stringify(locObj || {}, null, 2)}
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.11] bg-[#1b222d] flex items-center justify-between text-xs text-[#8d97a8]">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-[#75bbef]" aria-hidden="true" />
            <span>Synced with GuideKit CDN</span>
          </div>
          <span>Press <kbd className="px-1.5 py-0.5 bg-[#171c25] border border-white/[0.24] rounded text-[11px]">Esc</kbd> to close</span>
        </div>
      </aside>
    </>
  )
}
