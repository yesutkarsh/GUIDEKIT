'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Building2 } from 'lucide-react'
import type { Organization } from '@/lib/types'

interface OrgSwitcherProps {
  organizations: Organization[]
  activeOrg: Organization | null
  onSwitch: (org: Organization) => void
}

export function OrgSwitcher({ organizations, activeOrg, onSwitch }: OrgSwitcherProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 10px',
          backgroundColor: '#1F2229',
          border: '1px solid #2D3240',
          borderRadius: '8px',
          cursor: 'pointer',
          color: '#F5F5F7',
          fontSize: '14px',
        }}
      >
        <Building2 size={15} style={{ color: '#10B981' }} />
        <span>{activeOrg?.name || 'Select Org'}</span>
        <ChevronDown size={13} style={{ color: '#8E929F' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            backgroundColor: '#121316',
            border: '1px solid #1F2229',
            borderRadius: '10px',
            minWidth: '200px',
            zIndex: 100,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => { onSwitch(org); setOpen(false) }}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 14px',
                textAlign: 'left',
                background: org.id === activeOrg?.id ? 'rgba(16,185,129,0.08)' : 'none',
                border: 'none',
                cursor: 'pointer',
                color: org.id === activeOrg?.id ? '#10B981' : '#F5F5F7',
                fontSize: '14px',
              }}
            >
              {org.name}
              <span style={{ display: 'block', fontSize: '11px', color: '#8E929F' }}>{org.slug}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
