'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Alert } from '@heroui/react/alert'
import { Button } from '@heroui/react/button'
import { toast } from '@heroui/react/toast'
import { AlertCircle, Check, ChevronDown, ChevronRight, Code2, Globe, KeyRound, Package, RefreshCw, RotateCw, Terminal } from 'lucide-react'
import { api } from '@/lib/api'
import { GUIDEKIT_PACKAGE_NAME, GUIDEKIT_SCRIPT_URL, originEnvironment } from '@/lib/guidekitInstall'
import type { ApiKey, Project, ProjectOrigin } from '@/lib/types'
import { CopyButton } from '@/components/ui/CopyButton'
import { CodeEditor } from '@/components/ui/CodeEditor'
import { HoldButton } from '@/components/ui/HoldButton'
import styles from './InstallTab.module.css'

interface InstallTabProps { project: Project }

export type InstallFramework = 'nextjs' | 'react' | 'sveltekit' | 'svelte' | 'vue' | 'vanilla'
type InstallMethod = 'npm' | 'script'
type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

const frameworkLabels: Record<InstallFramework, string> = {
  nextjs: 'Next.js', react: 'React with Vite', sveltekit: 'SvelteKit',
  svelte: 'Svelte', vue: 'Vue', vanilla: 'Browser JavaScript',
}

const packageCommands: Record<PackageManager, string> = {
  npm: `npm install ${GUIDEKIT_PACKAGE_NAME}`,
  pnpm: `pnpm add ${GUIDEKIT_PACKAGE_NAME}`,
  yarn: `yarn add ${GUIDEKIT_PACKAGE_NAME}`,
  bun: `bun add ${GUIDEKIT_PACKAGE_NAME}`,
}

function frameworkFromProject(framework: string): InstallFramework {
  return framework in frameworkLabels ? (framework as InstallFramework) : 'react'
}

export function environmentSnippet(framework: InstallFramework, key: string): string {
  if (framework === 'nextjs') return `NEXT_PUBLIC_GUIDEKIT_KEY=${key}`
  if (framework === 'sveltekit') return `PUBLIC_GUIDEKIT_KEY=${key}`
  return `VITE_GUIDEKIT_KEY=${key}`
}

export function npmSnippet(framework: InstallFramework, key: string, locale: string): { file: string; code: string } {
  if (framework === 'nextjs') {
    return { file: 'app/GuideKitLoader.tsx', code: `'use client'

import { useEffect } from 'react'

export function GuideKitLoader() {
  useEffect(() => {
    void import('${GUIDEKIT_PACKAGE_NAME}').then(({ GuideKit }) =>
      GuideKit.init({
        apiKey: process.env.NEXT_PUBLIC_GUIDEKIT_KEY!,
        locale: '${locale}',
      })
    )
  }, [])

  return null
}` }
  }

  if (framework === 'sveltekit') {
    return { file: 'src/routes/+layout.svelte', code: `<script lang="ts">
  import { onMount } from 'svelte'
  import { PUBLIC_GUIDEKIT_KEY } from '$env/static/public'

  onMount(async () => {
    const { GuideKit } = await import('${GUIDEKIT_PACKAGE_NAME}')
    await GuideKit.init({ apiKey: PUBLIC_GUIDEKIT_KEY, locale: '${locale}' })
  })
</script>

<slot />` }
  }

  if (framework === 'svelte') {
    return { file: 'src/App.svelte', code: `<script lang="ts">
  import { onMount } from 'svelte'
  import { GuideKit } from '${GUIDEKIT_PACKAGE_NAME}'

  onMount(() => GuideKit.init({
    apiKey: import.meta.env.VITE_GUIDEKIT_KEY,
    locale: '${locale}',
  }))
</script>` }
  }

  if (framework === 'vue') {
    return { file: 'src/main.ts', code: `import { createApp } from 'vue'
import { GuideKit } from '${GUIDEKIT_PACKAGE_NAME}'
import App from './App.vue'

createApp(App).mount('#app')

void GuideKit.init({
  apiKey: import.meta.env.VITE_GUIDEKIT_KEY,
  locale: '${locale}',
})` }
  }

  if (framework === 'vanilla') {
    return { file: 'src/main.js', code: `import { GuideKit } from '${GUIDEKIT_PACKAGE_NAME}'

void GuideKit.init({
  apiKey: import.meta.env.VITE_GUIDEKIT_KEY,
  locale: '${locale}',
})` }
  }

  return { file: 'src/main.tsx', code: `import { GuideKit } from '${GUIDEKIT_PACKAGE_NAME}'

void GuideKit.init({
  apiKey: import.meta.env.VITE_GUIDEKIT_KEY,
  locale: '${locale}',
})` }
}

export function scriptSnippet(key: string, locale: string): string {
  return `<script
  src="${GUIDEKIT_SCRIPT_URL}"
  data-guidekit-key="${key}"
  data-locale="${locale}"
  defer
></script>`
}

function CodeBlock({ code, file }: { code: string; file: string }) {
  return <div className={styles.codeBlock}>
    <div className={styles.codeHeader}>
      <span><Terminal size={14} aria-hidden="true" />{file}</span>
      <CopyButton text={code} size={15} />
    </div>
    <CodeEditor file={file} code={code} />
  </div>
}

export function InstallTab({ project }: InstallTabProps) {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [origins, setOrigins] = useState<ProjectOrigin[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [creatingKey, setCreatingKey] = useState(false)
  const [creatingSecret, setCreatingSecret] = useState(false)
  const [revealedSecret, setRevealedSecret] = useState('')
  const [origin, setOrigin] = useState('')
  const [addingOrigin, setAddingOrigin] = useState(false)
  const [method, setMethod] = useState<InstallMethod>(project.framework === 'vanilla' ? 'script' : 'npm')
  const [framework, setFramework] = useState<InstallFramework>(frameworkFromProject(project.framework))
  const [packageManager, setPackageManager] = useState<PackageManager>('npm')

  const loadConnection = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [nextKeys, nextOrigins] = await Promise.all([api.keys.list(project.id), api.origins.list(project.id)])
      setKeys(nextKeys.filter((key) => !key.revoked_at))
      setOrigins(nextOrigins)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load installation settings.')
    } finally { setLoading(false) }
  }, [project.id])

  useEffect(() => { void loadConnection() }, [loadConnection])

  const publishableKeys = useMemo(() => keys.filter((key) => key.key_type === 'publishable').sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)), [keys])
  const secretKeys = useMemo(() => keys.filter((key) => key.key_type === 'secret'), [keys])
  const currentKey = publishableKeys[0]
  const snippetKey = currentKey?.key_plain || 'gk_pk_live_YOUR_KEY'
  const npmSetup = npmSnippet(framework, snippetKey, project.default_locale)
  const setupComplete = Boolean(currentKey && origins.length)

  const createKey = async (keyType: 'publishable' | 'secret') => {
    const setBusy = keyType === 'publishable' ? setCreatingKey : setCreatingSecret
    setBusy(true)
    try {
      const { key, full_key } = await api.keys.create(project.id, {
        key_type: keyType,
        label: keyType === 'publishable' ? 'Website SDK' : 'Server integration',
      })
      setKeys((previous) => [...previous, key])
      if (keyType === 'secret') setRevealedSecret(full_key)
      toast.success(keyType === 'publishable' ? 'Website API key created.' : 'Server key created.')
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : 'Could not create the key.')
    } finally { setBusy(false) }
  }

  const revokeKey = async (keyId: string) => {
    try {
      await api.keys.revoke(project.id, keyId)
      setKeys((previous) => previous.filter((key) => key.id !== keyId))
      toast.success('Key revoked.')
    } catch (error) { toast.danger(error instanceof Error ? error.message : 'Could not revoke the key.') }
  }

  const addOrigin = async (event: FormEvent) => {
    event.preventDefault()
    if (!origin.trim()) return
    setAddingOrigin(true)
    try {
      const created = await api.origins.create(project.id, { origin: origin.trim(), environment: originEnvironment(origin.trim()) })
      setOrigins((previous) => [...previous, created])
      setOrigin('')
      toast.success('Website origin added.')
    } catch (error) { toast.danger(error instanceof Error ? error.message : 'Could not add the website origin.') }
    finally { setAddingOrigin(false) }
  }

  const deleteOrigin = async (originId: string) => {
    try {
      await api.origins.delete(project.id, originId)
      setOrigins((previous) => previous.filter((item) => item.id !== originId))
      toast.success('Website origin removed.')
    } catch (error) { toast.danger(error instanceof Error ? error.message : 'Could not remove the origin.') }
  }

  if (loading) return <div className={styles.installPage} role="status" aria-live="polite" aria-busy="true"><div className={styles.loadingLine} /><div className={styles.loadingCard} /><div className={styles.loadingCard} /></div>

  if (loadError) return <div className={styles.installPage}>
    <Alert color="danger"><span className={styles.errorMessage}><strong>Installation settings could not load</strong><span>{loadError}</span></span></Alert>
    <Button className={styles.secondaryButton} onPress={() => void loadConnection()}><RefreshCw size={16} aria-hidden="true" /> Retry loading</Button>
  </div>

  return <div className={styles.installPage}>
    <header className={styles.installHeader}>
      <div><h2>Install GuideKit</h2><p>Connect this project to your website, then add the SDK.</p></div>
      <Link href="/docs#quickstart" className={styles.docsLink}>Open full docs <ChevronRight size={15} aria-hidden="true" /></Link>
    </header>

    <ol className={styles.setupSteps} aria-label="Website setup status">
      <li className={currentKey ? styles.complete : ''}><span>{currentKey ? <Check size={16} /> : '1'}</span><div><strong>Website API key</strong><small>{currentKey ? 'Ready to use' : 'Create one key for this project'}</small></div></li>
      <li className={origins.length ? styles.complete : ''}><span>{origins.length ? <Check size={16} /> : '2'}</span><div><strong>Website origin</strong><small>{origins.length ? `${origins.length} allowed` : 'Add the website that will run GuideKit'}</small></div></li>
      <li className={setupComplete ? styles.complete : ''}><span>{setupComplete ? <Check size={16} /> : '3'}</span><div><strong>SDK code</strong><small>{setupComplete ? 'Ready to copy' : 'Complete the two items above'}</small></div></li>
    </ol>

    <section className={styles.connectionSection} aria-labelledby="website-key-heading">
      <div className={styles.sectionHeading}><span className={styles.sectionIcon}><KeyRound size={17} aria-hidden="true" /></span><div><h3 id="website-key-heading">Website API key</h3><p>Identifies this GuideKit project. It does not sign visitors in.</p></div></div>
      {currentKey ? <div className={styles.keyRow}><div><span className={styles.statusLabel}>Current key</span><code>{currentKey.key_plain || `${currentKey.key_prefix}…`}</code></div>{currentKey.key_plain && <CopyButton text={currentKey.key_plain} size={16} />}</div>
        : <div className={styles.emptyAction}><p>No Website API key exists for this project.</p><Button className={styles.primaryButton} isDisabled={creatingKey} onPress={() => void createKey('publishable')}><KeyRound size={16} aria-hidden="true" /> {creatingKey ? 'Creating key…' : 'Create website key'}</Button></div>}
      {currentKey && <details className={styles.details}>
        <summary>Key rotation and history</summary>
        <p>You only need one active key. Create another while replacing a key, then revoke the old one.</p>
        <div className={styles.detailActions}><Button className={styles.secondaryButton} isDisabled={creatingKey} onPress={() => void createKey('publishable')}><RotateCw size={15} aria-hidden="true" /> {creatingKey ? 'Creating key…' : 'Rotate key'}</Button></div>
        {publishableKeys.map((key) => <div className={styles.compactRow} key={key.id}><div><code>{key.key_prefix}…</code><small>{key.label || 'Website SDK'}</small></div><HoldButton onHoldComplete={() => revokeKey(key.id)} label="Hold to revoke key" iconOnly size="sm" /></div>)}
      </details>}
    </section>

    <section className={styles.connectionSection} aria-labelledby="origin-heading">
      <div className={styles.sectionHeading}><span className={styles.sectionIcon}><Globe size={17} aria-hidden="true" /></span><div><h3 id="origin-heading">Website origin</h3><p>Only requests from these websites can use the public key.</p></div></div>
      <form className={styles.originForm} onSubmit={addOrigin}>
        <div><label htmlFor="guidekit-origin">Origin URL</label><input id="guidekit-origin" type="url" value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="https://app.example.com" required /><small>Use protocol and host only. Do not include a page path.</small></div>
        <Button className={styles.primaryButton} type="submit" isDisabled={addingOrigin}>{addingOrigin ? 'Adding website…' : 'Add website'}</Button>
      </form>
      {origins.length > 0 && <div className={styles.originList}>{origins.map((item) => <div className={styles.compactRow} key={item.id}><code>{item.origin}</code><HoldButton onHoldComplete={() => deleteOrigin(item.id)} label="Hold to remove origin" iconOnly size="sm" /></div>)}</div>}
    </section>

    <section className={styles.installSection} aria-labelledby="sdk-code-heading">
      <div className={styles.sectionHeading}><span className={styles.sectionIcon}><Code2 size={17} aria-hidden="true" /></span><div><h3 id="sdk-code-heading">SDK code</h3><p>Choose the npm package for an app build or the hosted CDN script.</p></div></div>
      {!setupComplete && <div className={styles.notice} role="note"><AlertCircle size={16} aria-hidden="true" />The code uses a placeholder until the Website API key and origin are ready.</div>}
      <div className={styles.methodTabs} role="tablist" aria-label="Installation method">
        <button type="button" role="tab" aria-selected={method === 'npm'} onClick={() => setMethod('npm')}><Package size={16} aria-hidden="true" /> npm package</button>
        <button type="button" role="tab" aria-selected={method === 'script'} onClick={() => setMethod('script')}><Terminal size={16} aria-hidden="true" /> CDN script</button>
      </div>
      {method === 'npm' ? <div className={styles.codeFlow} role="tabpanel">
        <div className={styles.optionRow}><label htmlFor="install-framework">Framework</label><div className={styles.selectWrap}><select id="install-framework" value={framework} onChange={(event) => setFramework(event.target.value as InstallFramework)}>{Object.entries(frameworkLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown className={styles.selectIcon} size={16} aria-hidden="true" /></div></div>
        <div className={styles.packageManagers} aria-label="Package manager">{(Object.keys(packageCommands) as PackageManager[]).map((manager) => <button type="button" key={manager} aria-pressed={packageManager === manager} onClick={() => setPackageManager(manager)}>{manager}</button>)}</div>
        <CodeBlock code={packageCommands[packageManager]} file="Terminal" />
        <CodeBlock code={environmentSnippet(framework, snippetKey)} file="Environment file" />
        <CodeBlock code={npmSetup.code} file={npmSetup.file} />
      </div> : <div className={styles.codeFlow} role="tabpanel"><p className={styles.methodNote}>Paste this before the closing <code>&lt;/body&gt;</code> tag.</p><CodeBlock code={scriptSnippet(snippetKey, project.default_locale)} file="index.html" /></div>}
    </section>

    <details className={`${styles.details} ${styles.advancedKeys}`}>
      <summary>Advanced server keys</summary>
      <p>Server keys are not used by the website SDK. Never place one in browser code or a public environment variable.</p>
      {revealedSecret && <div className={styles.secretReveal} role="status"><div><strong>Copy this server key now</strong><code>{revealedSecret}</code></div><CopyButton text={revealedSecret} size={16} /></div>}
      <Button className={styles.secondaryButton} isDisabled={creatingSecret} onPress={() => void createKey('secret')}>{creatingSecret ? 'Creating server key…' : 'Create server key'}</Button>
      {secretKeys.map((key) => <div className={styles.compactRow} key={key.id}><div><code>{key.key_prefix}…</code><small>{key.label || 'Server integration'}</small></div><HoldButton onHoldComplete={() => revokeKey(key.id)} label="Hold to revoke server key" iconOnly size="sm" /></div>)}
    </details>
  </div>
}
