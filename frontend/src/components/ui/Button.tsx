'use client'

import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, React.CSSProperties> = {
  primary: {
    backgroundColor: '#10B981',
    color: '#FFFFFF',
    border: 'none',
  },
  secondary: {
    backgroundColor: '#1F2229',
    color: '#F5F5F7',
    border: '1px solid #1F2229',
  },
  danger: {
    backgroundColor: 'transparent',
    color: '#F43F5E',
    border: '1px solid #F43F5E',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: '#8E929F',
    border: '1px solid #1F2229',
  },
}

const sizeStyles: Record<NonNullable<ButtonProps['size']>, React.CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: '12px', borderRadius: '6px' },
  md: { padding: '8px 16px', fontSize: '14px', borderRadius: '8px' },
  lg: { padding: '12px 24px', fontSize: '16px', borderRadius: '10px' },
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontWeight: 500,
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled || isLoading ? 0.6 : 1,
    transition: 'all 0.15s ease',
    outline: 'none',
    whiteSpace: 'nowrap',
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...style,
  }

  return (
    <button style={baseStyle} disabled={disabled || isLoading} {...props}>
      {isLoading ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ animation: 'spin 1s linear infinite' }}
        >
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : null}
      {children}
    </button>
  )
}
