'use client'

import { useState, useEffect, FormEvent } from 'react'
import { Plus, Trash2, Key, Globe, Shield, MonitorCog, CheckCircle2, AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { HoldButton } from '@/components/ui/HoldButton'
import { FuseButton } from '@/components/ui/FuseButton'
import { CopyButton } from '@/components/ui/CopyButton'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@heroui/react/toast'
import type { ApiKey, ProjectOrigin, Project } from '@/lib/types'

interface SettingsTabProps {
  projectId: string
  project: Project
  onProjectUpdate: (p: Project) => void
}

export function SettingsTab({ projectId, project, onProjectUpdate }: SettingsTabProps) {
  // Keys state
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [keysLoading, setKeysLoading] = useState(true)
  const [newKeyType, setNewKeyType] = useState('publishable')
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [creatingKey, setCreatingKey] = useState(false)
  const [fullKey, setFullKey] = useState<string | null>(null)
  const [showKeyModal, setShowKeyModal] = useState(false)

  // Origins state
  const [origins, setOrigins] = useState<ProjectOrigin[]>([])
  const [originsLoading, setOriginsLoading] = useState(true)
  const [newOrigin, setNewOrigin] = useState('')
  const [newEnv, setNewEnv] = useState('development')
  const [addingOrigin, setAddingOrigin] = useState(false)

  // Auth detection state
  const [authType, setAuthType] = useState<string>(() => {
    const cfg = project.auth_detection_config as Record<string, unknown>
    return (cfg.type as string) || 'cookie'
  })
  const [authValue, setAuthValue] = useState<string>(() => {
    const cfg = project.auth_detection_config as Record<string, unknown>
    return (
      (cfg.cookie_name as string) ||
      (cfg.local_storage_key as string) ||
      (cfg.selector as string) ||
      ''
    )
  })
  const [savingAuth, setSavingAuth] = useState(false)
  const [authSaved, setAuthSaved] = useState(false)

  useEffect(() => {
    const loadKeys = async () => {
      try {
        const data = await api.keys.list(projectId)
        setKeys(data)
      } catch {
        /* ignore */
      } finally {
        setKeysLoading(false)
      }
    }
    const loadOrigins = async () => {
      try {
        const data = await api.origins.list(projectId)
        setOrigins(data)
      } catch {
        /* ignore */
      } finally {
        setOriginsLoading(false)
      }
    }
    loadKeys()
    loadOrigins()
  }, [projectId])

  const handleCreateKey = async (e: FormEvent) => {
    e.preventDefault()
    setCreatingKey(true)
    try {
      const { key, full_key } = await api.keys.create(projectId, {
        key_type: newKeyType,
        label: newKeyLabel || undefined,
      })
      setKeys((prev) => [key, ...prev])
      setFullKey(full_key)
      setShowKeyModal(true)
      setNewKeyLabel('')
      toast.success('API key generated.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate key'
      toast.danger(msg)
    } finally {
      setCreatingKey(false)
    }
  }

  const handleRevoke = async (keyId: string) => {
    try {
      await api.keys.revoke(projectId, keyId)
      setKeys((prev) => prev.filter((k) => k.id !== keyId))
      toast.success('API key revoked.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to revoke key'
      toast.danger(msg)
    }
  }

  const handleAddOrigin = async (e: FormEvent) => {
    e.preventDefault()
    if (!newOrigin) return
    setAddingOrigin(true)
    try {
      const origin = await api.origins.create(projectId, {
        origin: newOrigin,
        environment: newEnv,
      })
      setOrigins((prev) => [...prev, origin])
      setNewOrigin('')
      toast.success('Origin registered.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register origin'
      toast.danger(msg)
    } finally {
      setAddingOrigin(false)
    }
  }

  const handleDeleteOrigin = async (id: string) => {
    try {
      await api.origins.delete(projectId, id)
      setOrigins((prev) => prev.filter((o) => o.id !== id))
      toast.success('Origin removed.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete origin'
      toast.danger(msg)
    }
  }

  const authConfigJson = (() => {
    if (!authValue) return {}
    if (authType === 'cookie') return { type: 'cookie', cookie_name: authValue }
    if (authType === 'localStorage') return { type: 'localStorage', local_storage_key: authValue }
    return { type: 'dom-selector', selector: authValue }
  })()

  const handleSaveAuth = async () => {
    setSavingAuth(true)
    try {
      const updated = await api.projects.patch(projectId, {
        auth_detection_config: authConfigJson,
      })
      onProjectUpdate(updated)
      setAuthSaved(true)
      toast.success('Auth detection config saved.')
      setTimeout(() => setAuthSaved(false), 2000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save auth config'
      toast.danger(msg)
    } finally {
      setSavingAuth(false)
    }
  }

  const envColor = (env: string): 'emerald' | 'amber' | 'blue' => {
    if (env === 'production') return 'emerald'
    if (env === 'staging') return 'amber'
    return 'blue'
  }

  const SectionHeading = ({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) => (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <span className="text-[#75bbef]">{icon}</span>
        <h3 className="m-0 text-base font-semibold text-[#f1f4f9]">{title}</h3>
      </div>
      {description && <p className="m-0 mt-1 text-xs text-[#b8c0ce]">{description}</p>}
    </div>
  )

  const inputStyle: React.CSSProperties = {
    height: '38px',
    padding: '8px 12px',
    border: '1px solid rgba(255, 255, 255, 0.11)',
    borderRadius: '8px',
    backgroundColor: '#131820',
    color: '#f1f4f9',
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Top Grid: Environment Metadata & Auth Detection Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Project Environment & Scope */}
        <section className="bg-[#171c25] border border-white/[0.11] rounded-xl p-5 flex flex-col justify-between shadow-[0_1px_3px_rgba(23,26,24,0.02)]">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MonitorCog size={16} className="text-[#75bbef]" aria-hidden="true" />
                <h3 className="m-0 text-sm font-semibold text-[#f1f4f9]">Project Environment</h3>
              </div>
              <Badge variant={envColor(project.environment || 'development')}>
                {project.environment || 'development'}
              </Badge>
            </div>
            <p className="m-0 text-xs text-[#b8c0ce] leading-relaxed">
              Default runtime environment for SDK telemetry. Allowed origins scope SDK sessions and isolate local development from production.
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-xs text-[#8d97a8]">
            <span>Active Project Slug:</span>
            <code className="font-mono font-semibold text-[#f1f4f9] bg-[#1b222d] px-2 py-0.5 rounded border border-white/[0.11]">
              {project.slug}
            </code>
          </div>
        </section>

        {/* Card 2: Auth Detection Configuration */}
        <section className="bg-[#171c25] border border-white/[0.11] rounded-xl p-5 flex flex-col justify-between shadow-[0_1px_3px_rgba(23,26,24,0.02)]">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-[#75bbef]" aria-hidden="true" />
                <h3 className="m-0 text-sm font-semibold text-[#f1f4f9]">Auth Detection Policy</h3>
              </div>
              <span className="text-[11px] font-semibold text-[#8d97a8] uppercase tracking-wider">
                Session Gate
              </span>
            </div>
            <p className="m-0 text-xs text-[#b8c0ce] mb-4 leading-relaxed">
              Determines when users are logged in to prevent guided tours from running prematurely on public pages.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3 mb-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#f1f4f9]">Detection Type</label>
                <select
                  value={authType}
                  onChange={(e) => setAuthType(e.target.value)}
                  style={inputStyle}
                >
                  <option value="cookie">Cookie</option>
                  <option value="localStorage">localStorage</option>
                  <option value="dom-selector">DOM Selector</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#f1f4f9]">
                  {authType === 'cookie'
                    ? 'Cookie Name'
                    : authType === 'localStorage'
                    ? 'Storage Key'
                    : 'CSS Selector'}
                </label>
                <input
                  value={authValue}
                  onChange={(e) => setAuthValue(e.target.value)}
                  placeholder={
                    authType === 'cookie'
                      ? 'e.g. session_id or token'
                      : authType === 'localStorage'
                      ? 'e.g. app_user_id'
                      : 'e.g. [data-logged-in]'
                  }
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/[0.08] flex items-center justify-between gap-3">
            <div className="text-[11px] font-mono text-[#8d97a8] truncate max-w-[260px]">
              {JSON.stringify(authConfigJson)}
            </div>

            <FuseButton
              variant="primary"
              size="sm"
              isLoading={savingAuth}
              loadingText="Saving..."
              onClick={handleSaveAuth}
              icon={<CheckCircle2 size={13} />}
            >
              {authSaved ? 'Saved' : 'Save Config'}
            </FuseButton>
          </div>
        </section>
      </div>

      {/* API Keys Section */}
      <section>
        <SectionHeading
          icon={<Key size={16} />}
          title="API Keys"
          description="Publishable keys authenticate client SDK instances; secret keys authorize backend publishing."
        />
        <div className="bg-[#171c25] border border-white/[0.11] rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(23,26,24,0.02)]">
          {/* Create key form */}
          <form
            onSubmit={handleCreateKey}
            className="p-5 border-b border-white/[0.11] bg-[#131820] flex flex-wrap gap-3 items-end"
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#f1f4f9]">Key Type</label>
              <select
                value={newKeyType}
                onChange={(e) => setNewKeyType(e.target.value)}
                style={{ ...inputStyle, width: '150px' }}
              >
                <option value="publishable">Publishable</option>
                <option value="secret">Secret</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label className="text-xs font-semibold text-[#f1f4f9]">Label (optional)</label>
              <input
                value={newKeyLabel}
                onChange={(e) => setNewKeyLabel(e.target.value)}
                placeholder="e.g. Web Production SDK"
                style={inputStyle}
              />
            </div>

            {/* React Bits FuseButton */}
            <FuseButton
              type="submit"
              variant="primary"
              size="sm"
              isLoading={creatingKey}
              loadingText="Generating..."
              icon={<Plus size={14} />}
            >
              Generate Key
            </FuseButton>
          </form>

          {/* Keys list */}
          <div>
            {keysLoading && (
              <div className="p-6 text-center text-xs text-[#8d97a8]">
                Loading authorized keys...
              </div>
            )}
            {!keysLoading && keys.length === 0 && (
              <div className="p-8 text-center text-xs text-[#8d97a8]">
                No API keys generated yet. Create one above to connect the Web SDK.
              </div>
            )}
            {keys
              .filter((k) => !k.revoked_at)
              .map((key) => (
                <div
                  key={key.id}
                  className="p-4 border-b border-white/[0.08] last:border-b-0 flex items-center justify-between gap-3 hover:bg-[#131820] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={key.key_type === 'publishable' ? 'blue' : 'amber'}>
                      {key.key_type}
                    </Badge>
                    <code className="font-mono text-xs text-[#f1f4f9] font-semibold bg-[#1b222d] px-2 py-0.5 rounded border border-white/[0.11]">
                      {key.key_prefix}...
                    </code>
                    {key.label && (
                      <span className="text-xs text-[#b8c0ce]">{key.label}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#8d97a8]">
                      {new Date(key.created_at).toLocaleDateString()}
                    </span>
                    {key.key_plain && <CopyButton text={key.key_plain} />}

                    {/* React Bits HoldButton to revoke safely */}
                    <HoldButton
                      onHoldComplete={() => handleRevoke(key.id)}
                      label="Hold to Revoke"
                      iconOnly
                      size="sm"
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* Allowed Origins Section */}
      <section>
        <SectionHeading
          icon={<Globe size={16} />}
          title="Allowed Origins"
          description="Register domains authorized to load your GuideKit tours and chat widgets."
        />
        <div className="bg-[#171c25] border border-white/[0.11] rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(23,26,24,0.02)]">
          {/* Add origin form */}
          <form
            onSubmit={handleAddOrigin}
            className="p-5 border-b border-white/[0.11] bg-[#131820] flex flex-wrap gap-3 items-end"
          >
            <div className="flex flex-col gap-1.5 flex-1 min-w-[240px]">
              <label className="text-xs font-semibold text-[#f1f4f9]">Origin URL</label>
              <input
                value={newOrigin}
                onChange={(e) => setNewOrigin(e.target.value)}
                placeholder="https://app.yourproduct.com"
                type="url"
                required
                style={inputStyle}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#f1f4f9]">Environment</label>
              <select
                value={newEnv}
                onChange={(e) => setNewEnv(e.target.value)}
                style={{ ...inputStyle, width: '150px' }}
              >
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </div>

            {/* React Bits FuseButton */}
            <FuseButton
              type="submit"
              variant="primary"
              size="sm"
              isLoading={addingOrigin}
              loadingText="Registering..."
              icon={<Plus size={14} />}
            >
              Add Origin
            </FuseButton>
          </form>

          {/* Origins list */}
          <div>
            {originsLoading && (
              <div className="p-6 text-center text-xs text-[#8d97a8]">
                Loading registered origins...
              </div>
            )}
            {!originsLoading && origins.length === 0 && (
              <div className="p-8 text-center text-xs text-[#8d97a8]">
                No allowed origins registered yet. Add your development or production URL.
              </div>
            )}
            {origins.map((origin) => (
              <div
                key={origin.id}
                className="p-4 border-b border-white/[0.08] last:border-b-0 flex items-center justify-between gap-3 hover:bg-[#131820] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Badge variant={envColor(origin.environment)}>{origin.environment}</Badge>
                  <code className="text-xs font-mono text-[#f1f4f9]">
                    {origin.origin}
                  </code>
                </div>

                {/* React Bits HoldButton */}
                <HoldButton
                  onHoldComplete={() => handleDeleteOrigin(origin.id)}
                  label="Hold to Delete"
                  iconOnly
                  size="sm"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Secret Key Modal Shown Once */}
      <Modal
        isOpen={showKeyModal}
        onClose={() => {
          setShowKeyModal(false)
          setFullKey(null)
        }}
        title="API Key Created"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 rounded-lg border border-amber-300/25 bg-amber-400/[0.08] p-3 text-xs text-amber-200">
            <AlertTriangle size={16} className="shrink-0" />
            <span>This is the only time the full key will be shown. Copy and store it securely.</span>
          </div>

          <div className="flex items-center justify-between gap-2 p-3 bg-[#1b222d] border border-white/[0.11] rounded-lg">
            <code className="text-xs font-mono text-[#75bbef] font-semibold break-all">
              {fullKey}
            </code>
            {fullKey && <CopyButton text={fullKey} size={16} />}
          </div>

          <button
            type="button"
            onClick={() => {
              setShowKeyModal(false)
              setFullKey(null)
            }}
            className="w-full rounded-lg bg-[#182d50] py-2 text-xs font-semibold text-white transition-colors hover:bg-[#203d67] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52a9ff]/45"
          >
            Done
          </button>
        </div>
      </Modal>
    </div>
  )
}
