'use client'

import React from 'react'

type BadgeVariant = 'primary' | 'emerald' | 'amber' | 'rose' | 'gray' | 'blue'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  style?: React.CSSProperties
}

const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: 'rgba(82, 169, 255, 0.12)',
    color: '#75bbef',
    border: '1px solid rgba(82, 169, 255, 0.28)',
  },
  emerald: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    color: '#10B981',
    border: '1px solid rgba(16, 185, 129, 0.25)',
  },
  amber: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    color: '#F59E0B',
    border: '1px solid rgba(245, 158, 11, 0.25)',
  },
  rose: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    color: '#F43F5E',
    border: '1px solid rgba(244, 63, 94, 0.25)',
  },
  gray: {
    backgroundColor: 'rgba(142, 146, 159, 0.12)',
    color: '#8E929F',
    border: '1px solid rgba(142, 146, 159, 0.25)',
  },
  blue: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    color: '#60A5FA',
    border: '1px solid rgba(59, 130, 246, 0.25)',
  },
}

export function Badge({ variant = 'gray', children, style }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </span>
  )
}
