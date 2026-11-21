'use client'

import React from 'react'

interface Tab {
  id: string
  label: string
  count?: number
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (id: string) => void
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '2px',
        borderBottom: '1px solid #1F2229',
        marginBottom: '24px',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#10B981' : '#8E929F',
              borderBottom: isActive ? '2px solid #10B981' : '2px solid transparent',
              marginBottom: '-1px',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                style={{
                  backgroundColor: isActive
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(142, 146, 159, 0.15)',
                  color: isActive ? '#10B981' : '#8E929F',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
