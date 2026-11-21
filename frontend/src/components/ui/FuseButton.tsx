'use client'

import React from 'react'
import { Spinner } from '@heroui/react/spinner'

interface FuseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  variant?: 'primary' | 'emerald' | 'outline'
  isLoading?: boolean
  loadingText?: string
  icon?: React.ReactNode
  size?: 'sm' | 'md'
}

export function FuseButton({
  children,
  variant = 'primary',
  isLoading = false,
  loadingText,
  icon,
  size = 'md',
  className = '',
  disabled,
  ...props
}: FuseButtonProps) {
  const isOutline = variant === 'outline'
  const isSmall = size === 'sm'

  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: isSmall ? '6px 14px' : '9px 18px',
        borderRadius: '8px',
        fontSize: isSmall ? '12.5px' : '13.5px',
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        overflow: 'hidden',
        border: isOutline ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid transparent',
        backgroundColor: isOutline ? '#171c25' : '#182d50',
        color: '#f1f4f9',
        boxShadow: isOutline ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.22)',
        transition:
          'background-color 150ms ease, transform 120ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 150ms ease',
        userSelect: 'none',
        outline: 'none',
        opacity: disabled ? 0.6 : 1,
      }}
      className={`fuse-btn ${className}`}
    >
      {/* Button Content */}
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
        }}
      >
        {isLoading ? (
          <>
            <Spinner size="sm" className="text-[#f1f4f9]" />
            <span>{loadingText || children}</span>
          </>
        ) : (
          <>
            {icon && <span className="shrink-0">{icon}</span>}
            <span>{children}</span>
          </>
        )}
      </span>

      <style>{`
        .fuse-btn:hover:not(:disabled) {
          background-color: ${isOutline ? '#1b222d' : '#203d67'} !important;
        }
        .fuse-btn:active:not(:disabled) {
          transform: scale(0.97) !important;
        }
        .fuse-btn:focus-visible {
          box-shadow: 0 0 0 3px rgba(82, 169, 255, 0.32) !important;
        }
      `}</style>
    </button>
  )
}

