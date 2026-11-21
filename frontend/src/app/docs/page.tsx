'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, ChevronRight, Copy, Package, Search, Terminal } from 'lucide-react'
import { GUIDEKIT_PACKAGE_NAME, GUIDEKIT_SCRIPT_URL } from '@/lib/guidekitInstall'
import { CodeEditor } from '@/components/ui/CodeEditor'
import styles from './DocsPage.module.css'

type DocsFramework = 'nextjs' | 'react' | 'sveltekit' | 'vue'

const sections = [
  { id: 'quickstart', label: 'Quickstart', keywords: 'project setup key origin install' },
  { id: 'website-key', label: 'Website API key', keywords: 'publishable environment variable authentication' },
  { id: 'allowed-origin', label: 'Website origin', keywords: 'domain url security localhost production' },
  { id: 'npm', label: 'Install with npm', keywords: 'next react vite svelte vue package' },
  { id: 'script', label: 'Install with CDN', keywords: 'script cloudflare html wordpress webflow' },
  { id: 'verify', label: 'Verify the installation', keywords: 'manifest widget chat workflow network' },
  { id: 'troubleshooting', label: 'Troubleshooting', keywords: '401 403 cors key origin error' },
] as const

const frameworkLabels: Record<DocsFramework, string> = {
  nextjs: 'Next.js', react: 'React with Vite', sveltekit: 'SvelteKit', vue: 'Vue',
}

const frameworkExamples: Record<DocsFramework, { file: string; env: string; code: string }> = {
  nextjs: {
    file: 'app/GuideKitLoader.tsx',
    env: 'NEXT_PUBLIC_GUIDEKIT_KEY=gk_pk_live_YOUR_KEY',
    code: `'use client'

import { useEffect } from 'react'

export function GuideKitLoader() {
  useEffect(() => {
    void import('@guidekit/sdk').then(({ GuideKit }) =>
      GuideKit.init({
        apiKey: process.env.NEXT_PUBLIC_GUIDEKIT_KEY!,
        locale: 'en',
      })
    )
  }, [])

  return null
}`,
  },
  react: {
    file: 'src/main.tsx',
    env: 'VITE_GUIDEKIT_KEY=gk_pk_live_YOUR_KEY',
    code: `import { GuideKit } from '@guidekit/sdk'

void GuideKit.init({
  apiKey: import.meta.env.VITE_GUIDEKIT_KEY,
  locale: 'en',
})`,
  },
  sveltekit: {
    file: 'src/routes/+layout.svelte',
    env: 'PUBLIC_GUIDEKIT_KEY=gk_pk_live_YOUR_KEY',
    code: `<script lang="ts">
  import { onMount } from 'svelte'
  import { PUBLIC_GUIDEKIT_KEY } from '$env/static/public'

  onMount(async () => {
    const { GuideKit } = await import('@guidekit/sdk')
    await GuideKit.init({ apiKey: PUBLIC_GUIDEKIT_KEY, locale: 'en' })
  })
</script>

<slot />`,
  },
  vue: {
    file: 'src/main.ts',
    env: 'VITE_GUIDEKIT_KEY=gk_pk_live_YOUR_KEY',
    code: `import { createApp } from 'vue'
import { GuideKit } from '@guidekit/sdk'
import App from './App.vue'

createApp(App).mount('#app')

void GuideKit.init({
  apiKey: import.meta.env.VITE_GUIDEKIT_KEY,
  locale: 'en',
})`,
  },
}

function CopyAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch { setCopied(false) }
  }
  return <button type="button" className={styles.copyButton} onClick={copy} aria-label="Copy code to clipboard">
    {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
    {copied ? 'Copied' : 'Copy'}
  </button>
}

function CodeBlock({ file, code }: { file: string; code: string }) {
  return <div className={styles.codeBlock}>
    <div className={styles.codeHeader}><span>{file}</span><CopyAction text={code} /></div>
    <CodeEditor file={file} code={code} />
  </div>
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return <li className={styles.step}>
    <span>{number}</span>
    <div><h3>{title}</h3><p>{children}</p></div>
  </li>
}

export default function DocsPage() {
  const [query, setQuery] = useState('')
  const [framework, setFramework] = useState<DocsFramework>('nextjs')
  const normalizedQuery = query.trim().toLowerCase()
  const filteredSections = useMemo(() => sections.filter((section) =>
    `${section.label} ${section.keywords}`.toLowerCase().includes(normalizedQuery)
  ), [normalizedQuery])
  const selectedExample = frameworkExamples[framework]
  const scriptCode = `<script
  src="${GUIDEKIT_SCRIPT_URL}"
  data-guidekit-key="gk_pk_live_YOUR_KEY"
  data-locale="en"
  defer
></script>`

  return <div className={styles.page}>
    <header className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
      <Link href="/" className="text-sm font-medium tracking-tight text-white">GuideKit</Link>
      <nav className="flex items-center gap-6 text-sm text-neutral-500" aria-label="Primary navigation">
        <Link href="/docs" aria-current="page" className="transition-colors hover:text-white">Docs</Link>
        <Link href="/device" className="hidden transition-colors hover:text-white sm:block">Connect VS Code</Link>
        <Link href="/login" className="transition-colors hover:text-white">Sign in</Link>
        <Link href="/signup" className="text-white transition-opacity hover:opacity-70">Get started</Link>
      </nav>
    </header>

    <main className={styles.main}>
      <aside className={styles.sidebar} aria-label="Documentation navigation">
        <label htmlFor="docs-search">Search docs</label>
        <div className={styles.searchField}><Search size={16} aria-hidden="true" /><input id="docs-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Key, origin, npm…" /></div>
        {filteredSections.length ? <>
          <nav className={styles.desktopToc} aria-label="On this page">
            {filteredSections.map((section) => <a key={section.id} href={`#${section.id}`} onClick={() => setQuery('')}>{section.label}</a>)}
          </nav>
          <div className={styles.mobileToc}>
            <label htmlFor="docs-section">On this page</label>
            <select id="docs-section" defaultValue="" onChange={(event) => {
              if (!event.target.value) return
              window.location.hash = event.target.value
              setQuery('')
              event.target.value = ''
            }}>
              <option value="" disabled>Jump to a section</option>
              {filteredSections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}
            </select>
          </div>
        </> : <p className={styles.noResults}>No matching documentation.</p>}
      </aside>

      <div className={styles.content}>
        <section className={styles.hero} aria-labelledby="docs-title">
          <p className={styles.eyebrow}>GuideKit Web SDK</p>
          <h1 id="docs-title">Add GuideKit to your website</h1>
          <p>Create one Website API key, allow your website’s origin, then install with npm or the hosted CDN script.</p>
          <div className={styles.methodCards} aria-label="Installation choices">
            <a href="#npm"><Package size={18} aria-hidden="true" /><span><strong>npm package</strong><small>Next.js, React, Svelte, and Vue</small></span><ChevronRight size={16} aria-hidden="true" /></a>
            <a href="#script"><Terminal size={18} aria-hidden="true" /><span><strong>CDN script</strong><small>Cloudflare-hosted for HTML and site builders</small></span><ChevronRight size={16} aria-hidden="true" /></a>
          </div>
        </section>

        <section id="quickstart" className={styles.docSection}>
          <h2>Quickstart</h2>
          <p>GuideKit needs two project settings before the SDK can load your chatbot.</p>
          <ol className={styles.steps}>
            <Step number={1} title="Create a project">Open the dashboard, create a project, and select its Install tab.</Step>
            <Step number={2} title="Create a Website API key">Use the publishable key shown in the project. One active key is enough.</Step>
            <Step number={3} title="Add the website origin">Enter the protocol and host where the chatbot will run, such as https://app.example.com.</Step>
            <Step number={4} title="Install and verify">Choose npm or the CDN script below, then confirm the widget can load the project manifest.</Step>
          </ol>
          <Link href="/dashboard" className={styles.primaryLink}>Open dashboard <ChevronRight size={15} aria-hidden="true" /></Link>
        </section>

        <section id="website-key" className={styles.docSection}>
          <h2>Website API key</h2>
          <p>The Website API key identifies the GuideKit project behind the embedded chatbot. It is visible in browser code by design and does not sign a visitor into your website.</p>
          <div className={styles.callout}><strong>Use one publishable key</strong><p>It starts with <code>gk_pk_live_</code>. Do not put a Secret server key in HTML or a public environment variable.</p></div>
          <p>GuideKit does not need your visitors’ passwords, session cookies, login tokens, or Google accounts. Anyone visiting an allowed website can open the chatbot.</p>
        </section>

        <section id="allowed-origin" className={styles.docSection}>
          <h2>Website origin</h2>
          <p>An origin is the protocol and host of the website running GuideKit. It limits where the public Website API key can be used.</p>
          <div className={styles.originExamples}>
            <div><span>Page address</span><code>https://app.example.com/settings?tab=team</code></div>
            <div><span>Add this origin</span><code>https://app.example.com</code></div>
          </div>
          <p>Add local, staging, and production origins separately. Ports and protocols are part of an origin, so <code>http://localhost:3000</code> differs from <code>http://localhost:5173</code>.</p>
        </section>

        <section id="npm" className={styles.docSection}>
          <div className={styles.sectionTitleRow}><div><h2>Install with npm</h2><p>Use the package in a frontend build.</p></div><Package size={20} aria-hidden="true" /></div>
          <CodeBlock file="Terminal" code={`npm install ${GUIDEKIT_PACKAGE_NAME}`} />
          <div className={styles.frameworkPicker}>
            <label htmlFor="docs-framework">Framework</label>
            <div className={styles.selectWrap}>
              <select id="docs-framework" value={framework} onChange={(event) => setFramework(event.target.value as DocsFramework)}>{Object.entries(frameworkLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <ChevronDown className={styles.selectIcon} size={16} aria-hidden="true" />
            </div>
          </div>
          <CodeBlock file="Environment file" code={selectedExample.env} />
          <CodeBlock file={selectedExample.file} code={selectedExample.code} />
          <p className={styles.afterCode}>The official package uses GuideKit’s production API. Pass <code>apiUrl</code> only for local development or a self-hosted backend.</p>
        </section>

        <section id="script" className={styles.docSection}>
          <div className={styles.sectionTitleRow}><div><h2>Install with the CDN script</h2><p>Use the Cloudflare-hosted bundle when the site has no package build.</p></div><Terminal size={20} aria-hidden="true" /></div>
          <p>Paste this before the closing <code>&lt;/body&gt;</code> tag. The bundle initializes from the data attributes.</p>
          <CodeBlock file="index.html" code={scriptCode} />
        </section>

        <section id="verify" className={styles.docSection}>
          <h2>Verify the installation</h2>
          <ul className={styles.checklist}>
            <li><Check size={16} aria-hidden="true" />The SDK file loads without a 404.</li>
            <li><Check size={16} aria-hidden="true" />The GuideKit launcher appears on the allowed website.</li>
            <li><Check size={16} aria-hidden="true" /><code>/api/v1/sdk/manifest</code> returns 200 or 304.</li>
            <li><Check size={16} aria-hidden="true" />A published workflow or indexed knowledge answer is available in chat.</li>
          </ul>
        </section>

        <section id="troubleshooting" className={styles.docSection}>
          <h2>Troubleshooting</h2>
          <div className={styles.troubleshooting}>
            <article><h3>401 invalid key</h3><p>Copy the full active Website API key from the same GuideKit project.</p></article>
            <article><h3>403 origin not allowed</h3><p>Compare <code>window.location.origin</code> with the origins in the project’s Install tab.</p></article>
            <article><h3>Widget opens without guides</h3><p>Publish a workflow or index knowledge, then reload the website.</p></article>
            <article><h3>CDN script returns 404</h3><p>Check the configured CDN address and confirm the IIFE bundle was deployed.</p></article>
          </div>
        </section>
      </div>
    </main>

    <footer className={styles.footer}><span>GuideKit documentation</span><Link href="/dashboard">Open dashboard</Link></footer>
  </div>
}
