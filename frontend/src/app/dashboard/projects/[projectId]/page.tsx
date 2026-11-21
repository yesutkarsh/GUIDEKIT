'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Layers,
  Sparkles,
  Download,
  BarChart3,
  AlertCircle,
  Globe,
  RefreshCw,
  Bot,
  BookOpen,
  ExternalLink,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { Project } from '@/lib/types'
import { Alert } from '@heroui/react/alert'
import { Button } from '@heroui/react/button'
import { Spinner } from '@heroui/react/spinner'
import { Tooltip } from '@heroui/react/tooltip'
import { Skeleton } from '@heroui/react/skeleton'
import { toast } from '@heroui/react/toast'

import { FeaturesTab } from '@/components/project/FeaturesTab'
import { KnowledgeTab } from '@/components/project/KnowledgeTab'
import { HealSuggestionsTab } from '@/components/project/HealSuggestionsTab'
import { InstallTab } from '@/components/project/InstallTab'
import { AnalyticsTab } from '@/components/project/AnalyticsTab'
import styles from '@/components/project/ProjectWorkspace.module.css'

interface TabDefinition {
  id: string
  label: string
  icon: typeof Layers
  badge?: number
}

const tabs: TabDefinition[] = [
  { id: 'features', label: 'Workflows & Steps', icon: Layers },
  { id: 'knowledge', label: 'Knowledge Base (RAG)', icon: BookOpen },
  { id: 'heal-suggestions', label: 'Self-Healing Inbox', icon: Sparkles },
  { id: 'install', label: 'Install', icon: Download },
  { id: 'analytics', label: 'Analytics & Health', icon: BarChart3 },
]

export default function ProjectWorkspacePage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('features')

  const loadProject = useCallback(async (isSilentRefresh = false) => {
    if (!isSilentRefresh) setLoading(true)
    else setIsRefreshing(true)
    setError(null)

    try {
      const p = await api.projects.get(projectId)
      setProject(p)

      if (isSilentRefresh) {
        toast.success('Workspace updated.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load project details'
      setError(msg)
      if (isSilentRefresh) {
        toast.danger('Failed to refresh project data.')
      }
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [projectId])

  useEffect(() => {
    if (projectId) {
      loadProject()
    }
  }, [projectId, loadProject])

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab')
    if (requestedTab && tabs.some((tab) => tab.id === requestedTab)) {
      setActiveTab(requestedTab)
    }
  }, [])

  const selectTab = (tabId: string) => {
    setActiveTab(tabId)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tabId)
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }

  if (loading) {
    return (
      <div
        className={styles.workspacePage}
        data-theme="dark"
        role="status"
        aria-label="Loading project workspace"
        aria-busy="true"
      >
        <div className={styles.breadcrumbBar}>
          <Skeleton className="h-5 w-24 rounded-md" />
        </div>
        <div className={styles.loadingHeader}>
          <div className={styles.loadingHeaderCopy}>
            <Skeleton className="h-8 w-64 rounded-md" />
            <Skeleton className="h-4 w-48 rounded-md" />
          </div>
          <div className={styles.loadingHeaderActions}>
            <Skeleton className="h-9 w-36 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        </div>
        <div className={styles.loadingTabs}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-6 w-32 rounded-md" />
          ))}
        </div>
        <div className={styles.loadingBody}>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className={styles.workspacePage} data-theme="dark">
        <div className={styles.errorCard}>
          <AlertCircle size={28} className="text-red-300" />
          <h2>Project Error</h2>
          <p>{error || 'Project not found'}</p>
          <div className={styles.errorActions}>
            <Button
              className="rounded-lg border border-white/[0.12] bg-white/[0.05] px-4 py-2 text-sm font-semibold text-[#f1f4f9] hover:bg-white/[0.09]"
              onPress={() => router.push('/dashboard')}
            >
              Back to Dashboard
            </Button>
            <Button
              className="rounded-lg bg-[#182d50] px-4 py-2 text-sm font-semibold text-white hover:bg-[#203d67]"
              onPress={() => loadProject()}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.workspacePage} data-theme="dark">
      {/* Breadcrumb Navigation */}
      <div className={styles.breadcrumbBar}>
        <Link href="/dashboard" className={styles.breadcrumbLink} aria-label="Back to projects dashboard">
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Projects</span>
        </Link>
      </div>

      {/* Project Header */}
      <header className={styles.projectHeader}>
        <div className={styles.projectHeaderInfo}>
          <div className={styles.titleRow}>
            <h1 className={styles.projectTitle}>{project.name}</h1>
            <span className={styles.frameworkBadge}>{project.framework}</span>
            <span className={styles.slugCode}>{project.slug}</span>
          </div>

          <div className={styles.metaRow}>
            <div className={styles.localeInfo}>
              <Globe size={13} className="text-[#8d97a8]" aria-hidden="true" />
              <span>Locales: {project.supported_locales.join(', ')}</span>
            </div>
            <span className={styles.metaDivider}>•</span>
            <span className="text-xs text-[#8d97a8]">
              Environment: <strong className="font-semibold text-[#f1f4f9] capitalize">{project.environment || 'development'}</strong>
            </span>
          </div>
        </div>

        <div className={styles.headerActions}>
          <Link
            href="/demo/taxi-sanchalak"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.demoLink}
            aria-label="Open live customer demo in new tab"
          >
            <span>Live Customer Demo</span>
            <ExternalLink size={13} aria-hidden="true" />
          </Link>

          <Tooltip>
            <Tooltip.Trigger>
              <button
                type="button"
                onClick={() => loadProject(true)}
                disabled={isRefreshing}
                className={styles.refreshButton}
                aria-label="Refresh project data"
              >
                <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" />
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>Refresh workflows & knowledge state</Tooltip.Content>
          </Tooltip>
        </div>
      </header>

      {/* Tabs Navigation */}
      <nav
        className={styles.tabsContainer}
        role="tablist"
        aria-label="Workspace tabs"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault()
            const currentIndex = tabs.findIndex((t) => t.id === activeTab)
            const nextIndex =
              e.key === 'ArrowRight'
                ? (currentIndex + 1) % tabs.length
                : (currentIndex - 1 + tabs.length) % tabs.length
            selectTab(tabs[nextIndex].id)
            const nextBtn = document.getElementById(`tab-${tabs[nextIndex].id}`)
            nextBtn?.focus()
          }
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab
          const Icon = tab.icon

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              className={`${styles.tabItem} ${isActive ? styles.tabItemActive : ''}`}
              onClick={() => selectTab(tab.id)}
            >
              <Icon size={15} strokeWidth={isActive ? 2 : 1.75} className={styles.tabIcon} aria-hidden="true" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={styles.tabCount}>{tab.badge}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Tab Panels */}
      <div
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className={styles.tabPanel}
      >
        {activeTab === 'features' && (
          <FeaturesTab projectId={projectId} onPublished={() => loadProject(true)} />
        )}
        {activeTab === 'knowledge' && (
          <KnowledgeTab projectId={projectId} />
        )}
        {activeTab === 'heal-suggestions' && (
          <HealSuggestionsTab projectId={projectId} />
        )}
        {activeTab === 'install' && (
          <InstallTab project={project} />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsTab projectId={projectId} />
        )}
      </div>
    </div>
  )
}
