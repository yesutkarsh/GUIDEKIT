'use client'

import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface CopyButtonProps {
  text: string
  size?: number
}

export function CopyButton({ text, size = 14 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy to clipboard"
      aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
      style={{
        background: 'none',
        border: '1px solid #1F2229',
        borderRadius: '6px',
        cursor: 'pointer',
        color: copied ? '#10B981' : '#8E929F',
        padding: '4px 6px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
      }}
    >
      {copied ? <Check size={size} /> : <Copy size={size} />}
    </button>
  )
}
