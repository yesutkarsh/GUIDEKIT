'use client'

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, ChevronDown, Globe2, Sparkles } from 'lucide-react'
import { Step, Stepper } from '@astryxdesign/core/Stepper'
import { Alert } from '@heroui/react/alert'
import { Button } from '@heroui/react/button'
import { Spinner } from '@heroui/react/spinner'
import { toast } from '@heroui/react/toast'
import { useDashboardWorkspace } from '@/contexts/DashboardWorkspaceContext'
import { api } from '@/lib/api'
import { getProjectBackground, randomProjectBackgroundId, PROJECT_BACKGROUNDS } from '@/lib/projectBackgrounds'
import type { ProjectBackgroundId, ProjectEnvironment } from '@/lib/types'
import { ProjectBackground } from '@/components/dashboard/ProjectBackground'
import { CircularGallery } from '@/components/project-creation/CircularGallery'
import styles from '@/components/project-creation/NewProject.module.css'

const FRAMEWORKS = [
  { id: 'nextjs', name: 'Next.js' },
  { id: 'react', name: 'React (Vite)' },
  { id: 'sveltekit', name: 'SvelteKit' },
  { id: 'svelte', name: 'Svelte' },
  { id: 'vue', name: 'Vue' },
  { id: 'vanilla', name: 'Vanilla JS' },
] as const

const ENVIRONMENTS: Array<{ id: ProjectEnvironment; name: string; description: string }> = [
  { id: 'development', name: 'Development', description: '' },
  { id: 'staging', name: 'Staging', description: '' },
  { id: 'production', name: 'Production', description: '' },
]

interface ProjectDraft {
  name: string
  framework: string
  backgroundId: ProjectBackgroundId
  environment: ProjectEnvironment
  step: number
}

function draftKey(organizationId: string) {
  return `guidekit.new_project_draft.${organizationId}`
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function NewProjectPage() {
  const router = useRouter()
  const { activeOrganization } = useDashboardWorkspace()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [framework, setFramework] = useState('nextjs')
  const [backgroundId, setBackgroundId] = useState<ProjectBackgroundId>('untitled-blend')
  const [environment, setEnvironment] = useState<ProjectEnvironment>('development')
  const [draftReady, setDraftReady] = useState(false)
  const [attemptedContinue, setAttemptedContinue] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const submitGuard = useRef(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const trimmedName = name.trim()
  const nameError = attemptedContinue && !trimmedName
    ? 'Enter a project name to continue.'
    : attemptedContinue && trimmedName.length > 120
      ? 'Project names can be up to 120 characters.'
      : ''
  const selectedBackground = getProjectBackground(backgroundId)
  const selectedFramework = FRAMEWORKS.find((item) => item.id === framework)?.name ?? framework

  useEffect(() => {
    if (!activeOrganization) return
    setDraftReady(false)
    const stored = window.sessionStorage.getItem(draftKey(activeOrganization.id))
    if (stored) {
      try {
        const draft = JSON.parse(stored) as Partial<ProjectDraft>
        setName(typeof draft.name === 'string' ? draft.name : '')
        setFramework(FRAMEWORKS.some((item) => item.id === draft.framework) ? draft.framework! : 'nextjs')
        setBackgroundId(getProjectBackground(draft.backgroundId).id)
        setEnvironment(ENVIRONMENTS.some((item) => item.id === draft.environment) ? draft.environment! : 'development')
        setStep(draft.step === 1 ? 1 : 0)
      } catch {
        window.sessionStorage.removeItem(draftKey(activeOrganization.id))
        setName('')
        setFramework('nextjs')
        setBackgroundId(randomProjectBackgroundId())
        setEnvironment('development')
        setStep(0)
      }
    } else {
      setName('')
      setFramework('nextjs')
      setBackgroundId(randomProjectBackgroundId())
      setEnvironment('development')
      setStep(0)
    }
    setAttemptedContinue(false)
    setError('')
    setDraftReady(true)
  }, [activeOrganization])

  useEffect(() => {
    if (!activeOrganization || !draftReady || submitting) return
    const draft: ProjectDraft = { name, framework, backgroundId, environment, step }
    window.sessionStorage.setItem(draftKey(activeOrganization.id), JSON.stringify(draft))
  }, [activeOrganization, backgroundId, draftReady, environment, framework, name, step, submitting])

  const goToStep = (nextStep: number) => {
    if (submitting || nextStep === step) return
    if (nextStep === 0) {
      setStep(0)
      setError('')
      return
    }
    setAttemptedContinue(true)
    if (!trimmedName || trimmedName.length > 120) {
      nameInputRef.current?.focus()
      return
    }
    setStep(1)
    setError('')
  }

  const cancel = () => {
    if (activeOrganization) window.sessionStorage.removeItem(draftKey(activeOrganization.id))
    router.push('/dashboard')
  }

  const handleEnvironmentKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentId: ProjectEnvironment) => {
    const currentIndex = ENVIRONMENTS.findIndex((e) => e.id === currentId)
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      const nextIndex = (currentIndex + 1) % ENVIRONMENTS.length
      setEnvironment(ENVIRONMENTS[nextIndex].id)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      const prevIndex = (currentIndex - 1 + ENVIRONMENTS.length) % ENVIRONMENTS.length
      setEnvironment(ENVIRONMENTS[prevIndex].id)
    }
  }

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault()
    if (step === 0) {
      goToStep(1)
      return
    }

    if (!activeOrganization || submitGuard.current || submitting) return
    if (!trimmedName || trimmedName.length > 120) {
      setStep(0)
      setAttemptedContinue(true)
      nameInputRef.current?.focus()
      return
    }

    submitGuard.current = true
    setSubmitting(true)
    setError('')
    const toastId = toast('Creating your project…', { isLoading: true, timeout: 0 })
    try {
      const project = await api.projects.create(activeOrganization.id, {
        name: trimmedName,
        framework,
        default_locale: 'en',
        supported_locales: ['en'],
        environment,
        background_id: backgroundId,
      })
      window.sessionStorage.removeItem(draftKey(activeOrganization.id))
      try {
        toast?.update?.(toastId, `Project created in ${activeOrganization.name}.`, { variant: 'success', timeout: 4500 })
      } catch {
        // toast update is best effort
      }
      router.replace(`/dashboard/projects/${project.id}`)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Project creation failed. Please try again.'
      setError(message)
      try {
        toast?.update?.(toastId, 'Project could not be created.', { description: message, variant: 'danger', timeout: 7000 })
      } catch {
        // toast update is best effort
      }
      submitGuard.current = false
      setSubmitting(false)
    }
  }

  if (!activeOrganization || !draftReady) {
    return (
      <div className={styles.loadingPage} aria-live="polite">
        <Spinner aria-label="Preparing project setup" />
        <span>Preparing project setup…</span>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backLink} type="button" onClick={cancel} disabled={submitting}>
          <ArrowLeft size={15} aria-hidden="true" /> Back to projects
        </button>
        <div className={styles.headerCopy}>
          <p className={styles.eyebrow}>{activeOrganization.name}</p>
        </div>
      </header>

      {/* Astryx Stepper - Clean, modern progress bar */}
      <div className={styles.stepperContainer}>
        <Stepper
          activeStep={step}
          onStepClick={goToStep}
          orientation="horizontal"
          density="compact"
          indicatorPosition="on-track"
          label="New project progress"
          horizontalOptions={{ minimumStepWidth: 160, collapsedVariant: 'withLabel' }}
        >
          <Step step={0} label="Project details" description="Name & framework" />
          <Step step={1} label="Identity & environment" description="Theme & deployment" isDisabled={!trimmedName} />
        </Stepper>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {step === 0 ? (
          /* Step 1: Project Details (Name & Framework only) */
          <div className={styles.stepZeroWrap}>
            {/* Project Name */}
            <div className={styles.fieldGroup}>
              <div className={styles.fieldHeader}>
                <label htmlFor="project-name" className={styles.fieldLabel}>
                  Project name <span className={styles.requiredMark}>*</span>
                </label>
                {nameError && <span className={styles.fieldError} role="alert">{nameError}</span>}
              </div>
              <input
                ref={nameInputRef}
                id="project-name"
                type="text"
                className={`${styles.textInput} ${nameError ? styles.textInputError : ''}`}
                placeholder="e.g. Mobile App or Docs Platform"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                disabled={submitting}
                autoFocus
                aria-invalid={Boolean(nameError)}
              />
            </div>

            {/* Framework */}
            <div className={styles.fieldGroup}>
              <label htmlFor="framework-select" className={styles.fieldLabel}>
                Framework
              </label>
              <div className={styles.selectWrapper}>
                <select
                  id="framework-select"
                  className={styles.nativeSelect}
                  value={framework}
                  onChange={(e) => setFramework(e.target.value)}
                  disabled={submitting}
                >
                  {FRAMEWORKS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} className={styles.selectArrow} aria-hidden="true" />
              </div>
            </div>

            {/* Step 0 Actions */}
            <div className={styles.actionRow}>
              <Button
                className={styles.primaryButton}
                type="button"
                onPress={() => goToStep(1)}
                onClick={() => goToStep(1)}
                isDisabled={submitting}
              >
                Continue
              </Button>
              <Button
                className={styles.secondaryButton}
                type="button"
                onPress={cancel}
                onClick={cancel}
                isDisabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          /* Step 2: Visual Identity & Environment */
          <div className={styles.stepOneGrid}>
            {/* Left Column: Environment & Language */}
            <div className={styles.formColumn}>
              {/* Environment (100% Clickable, Compact Segmented Control) */}
              <div className={styles.environmentGroup}>
                <div className={styles.fieldHeader}>
                  <label id="environment-label" className={styles.fieldLabel}>
                    Environment
                  </label>
                  <span className={styles.environmentHint}>
                    {ENVIRONMENTS.find((e) => e.id === environment)?.description}
                  </span>
                </div>
                <div
                  className={styles.segmentedControl}
                  role="radiogroup"
                  aria-labelledby="environment-label"
                >
                  {ENVIRONMENTS.map((item) => {
                    const isSelected = environment === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        tabIndex={isSelected ? 0 : -1}
                        className={`${styles.segmentButton} ${isSelected ? styles.segmentButtonActive : ''}`}
                        onClick={() => setEnvironment(item.id)}
                        onKeyDown={(e) => handleEnvironmentKeyDown(e, item.id)}
                        disabled={submitting}
                      >
                        {isSelected && <Check size={13} className={styles.segmentCheck} aria-hidden="true" />}
                        <span>{item.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Default Language (Super compact notice, minimal space) */}
              <div className={styles.compactLanguageNotice}>
                <Globe2 size={15} className={styles.languageIcon} aria-hidden="true" />
                <span>
                  Default language: <strong>English (en)</strong> · Additional locales can be added in settings
                </span>
              </div>

              {error && (
                <Alert className={styles.alert} status="danger" role="alert">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>Project could not be created</Alert.Title>
                    <Alert.Description>{error}</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}

              {/* Step 1 Actions */}
              <div className={styles.actionRow}>
                <Button
                  className={styles.primaryButton}
                  type="submit"
                  onPress={() => void handleSubmit()}
                  onClick={() => void handleSubmit()}
                  isDisabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Spinner size="sm" aria-hidden="true" /> Creating project…
                    </>
                  ) : (
                    'Create project'
                  )}
                </Button>
                <Button
                  className={styles.secondaryButton}
                  type="button"
                  onPress={() => goToStep(0)}
                  onClick={() => goToStep(0)}
                  isDisabled={submitting}
                >
                  Back
                </Button>
              </div>
            </div>

            {/* Right Column: Visual Identity & Real-Time Card Preview */}
            <div className={styles.previewColumn}>
              <div className={styles.previewHeader}>


              </div>

              {/* Real-time Project Card Preview */}
              <div className={styles.liveCardWrap} aria-label="Project card preview">
                <div className={styles.liveCardVisual}>
                  <ProjectBackground
                    backgroundId={backgroundId}
                    isLive
                    label={`${selectedBackground.name} background preview`}
                  />
                  <span className={styles.liveEnvBadge}>
                    {ENVIRONMENTS.find((e) => e.id === environment)?.name}
                  </span>
                  <span className={styles.liveFrameworkBadge}>{selectedFramework}</span>
                </div>
                <div className={styles.liveCardBody}>
                  <h3 className={styles.liveCardTitle}>{trimmedName || 'Untitled project'}</h3>
                  <code className={styles.liveCardSlug}>
                    slug: {slugify(trimmedName) || 'my-project'}
                  </code>
                  <div className={styles.liveCardFooter}>
                    <span className={styles.liveCardOrg}>{activeOrganization.name}</span>
                    <span className={styles.liveCardLocale}>EN</span>
                  </div>
                </div>
              </div>

              {/* Theme Selector Carousel (Speed-controlled, click-to-select enabled) */}
              <div className={styles.gallerySection}>
                <div className={styles.galleryLabelRow}>
                  <span className={styles.galleryLabel}>Select background theme</span>
                  <span className={styles.galleryCount}>{PROJECT_BACKGROUNDS.length} themes</span>
                </div>
                <CircularGallery
                  selectedId={backgroundId}
                  onSelect={setBackgroundId}
                  isDisabled={submitting}
                />
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
