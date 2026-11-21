'use client'

import React from 'react'

interface CardProps {
  children: React.ReactNode
  style?: React.CSSProperties
  onClick?: () => void
  hoverable?: boolean
}

export function Card({ children, style, onClick, hoverable = false }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: '#121316',
        border: '1px solid #1F2229',
        borderRadius: '12px',
        padding: '20px',
        cursor: hoverable ? 'pointer' : undefined,
        transition: hoverable ? 'border-color 0.15s ease, box-shadow 0.15s ease' : undefined,
        ...style,
      }}
      onMouseEnter={
        hoverable
          ? (e) => {
              e.currentTarget.style.borderColor = '#2D3240'
              e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.3)'
            }
          : undefined
      }
      onMouseLeave={
        hoverable
          ? (e) => {
              e.currentTarget.style.borderColor = '#1F2229'
              e.currentTarget.style.boxShadow = 'none'
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}
