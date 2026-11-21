'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import styles from './CodeEditor.module.css'

const MonacoEditor = dynamic(() => import('@monaco-editor/react').then((module) => module.default), {
  ssr: false,
})

interface CodeEditorProps {
  code: string
  file: string
  language?: string
}

function languageForFile(file: string): string {
  const normalized = file.toLowerCase()
  if (normalized === 'terminal' || normalized.includes('environment')) return 'shell'
  if (normalized.endsWith('.html')) return 'html'
  if (normalized.endsWith('.svelte')) return 'svelte'
  if (normalized.endsWith('.vue')) return 'vue'
  if (normalized.endsWith('.js')) return 'javascript'
  if (normalized.endsWith('.ts') || normalized.endsWith('.tsx')) return 'typescript'
  return 'plaintext'
}

export function CodeEditor({ code, file, language }: CodeEditorProps) {
  const [enabled, setEnabled] = useState(false)
  const [editorReady, setEditorReady] = useState(false)
  const resolvedLanguage = language || languageForFile(file)
  const height = useMemo(() => `${Math.min(420, Math.max(78, code.split('\n').length * 20 + 32))}px`, [code])

  useEffect(() => {
    let idleId: number | undefined
    let timeoutId: number | undefined
    const enable = () => setEnabled(true)

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(enable, { timeout: 650 })
    } else {
      timeoutId = window.setTimeout(enable, 120)
    }

    return () => {
      if (idleId !== undefined && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId)
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [])

  return <div className={styles.editorShell} style={{ height }}>
    <pre className={`${styles.fallback} ${editorReady ? styles.fallbackHidden : ''}`} aria-hidden={editorReady}><code>{code}</code></pre>
    {enabled && <MonacoEditor
      height="100%"
      language={resolvedLanguage}
      theme="vs-dark"
      value={code}
      onMount={() => setEditorReady(true)}
      loading={<span className={styles.loading}>Loading editor…</span>}
      options={{
        ariaLabel: `${file} code, read only`,
        automaticLayout: true,
        contextmenu: false,
        domReadOnly: true,
        folding: false,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 12,
        glyphMargin: false,
        lineDecorationsWidth: 12,
        lineNumbers: 'off',
        minimap: { enabled: false },
        overviewRulerLanes: 0,
        padding: { top: 16, bottom: 16 },
        readOnly: true,
        renderLineHighlight: 'none',
        scrollBeyondLastLine: false,
        scrollbar: { horizontal: 'auto', vertical: 'hidden', verticalScrollbarSize: 8 },
        smoothScrolling: false,
        wordWrap: 'off',
      }}
    />}
  </div>
}
