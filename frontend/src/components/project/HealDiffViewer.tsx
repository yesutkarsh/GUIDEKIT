'use client'

import React from 'react'

interface HealDiffViewerProps {
  oldSelector: string | null
  newSelector: string | null
}

export function HealDiffViewer({ oldSelector, newSelector }: HealDiffViewerProps) {
  return (
    <div
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '12px',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.11)',
        backgroundColor: '#131820',
      }}
    >
      {oldSelector && (
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            color: '#fda4af',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderBottom: newSelector ? '1px solid rgba(251, 113, 133, 0.24)' : 'none',
          }}
        >
          <span style={{ fontWeight: 700, userSelect: 'none' }}>−</span>
          <span style={{ textDecoration: 'line-through', opacity: 0.85 }}>{oldSelector}</span>
        </div>
      )}
      {newSelector && (
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(82, 169, 255, 0.12)',
            color: '#75bbef',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontWeight: 700, userSelect: 'none' }}>+</span>
          <span style={{ fontWeight: 600 }}>{newSelector}</span>
        </div>
      )}
      {!oldSelector && !newSelector && (
        <div style={{ padding: '8px 12px', color: '#8d97a8' }}>No selector data available</div>
      )}
    </div>
  )
}
