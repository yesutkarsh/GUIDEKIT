'use client'

import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, style, ...props }: InputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <label
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: '#F5F5F7',
          }}
        >
          {label}
        </label>
      )}
      <input
        style={{
          backgroundColor: '#0A0A0C',
          border: `1px solid ${error ? '#F43F5E' : '#1F2229'}`,
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '14px',
          color: '#F5F5F7',
          outline: 'none',
          width: '100%',
          transition: 'border-color 0.15s ease',
          ...style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = error ? '#F43F5E' : '#10B981'
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? '#F43F5E' : '#1F2229'
        }}
        {...props}
      />
      {error && (
        <span style={{ fontSize: '12px', color: '#F43F5E' }}>{error}</span>
      )}
      {hint && !error && (
        <span style={{ fontSize: '12px', color: '#8E929F' }}>{hint}</span>
      )}
    </div>
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export function Select({ label, error, children, style, ...props }: SelectProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <label style={{ fontSize: '13px', fontWeight: 500, color: '#F5F5F7' }}>
          {label}
        </label>
      )}
      <select
        style={{
          backgroundColor: '#0A0A0C',
          border: `1px solid ${error ? '#F43F5E' : '#1F2229'}`,
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '14px',
          color: '#F5F5F7',
          outline: 'none',
          width: '100%',
          cursor: 'pointer',
          ...style,
        }}
        {...props}
      >
        {children}
      </select>
      {error && <span style={{ fontSize: '12px', color: '#F43F5E' }}>{error}</span>}
    </div>
  )
}
