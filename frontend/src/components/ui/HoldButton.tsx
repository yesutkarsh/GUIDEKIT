'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Trash2, AlertTriangle, Check } from 'lucide-react'

interface HoldButtonProps {
  onHoldComplete: () => void | Promise<void>
  holdDuration?: number // in ms, default 1200
  label?: string
  iconOnly?: boolean
  disabled?: boolean
  className?: string
  size?: 'sm' | 'md'
}

export function HoldButton({
  onHoldComplete,
  holdDuration = 1200,
  label = 'Hold to delete',
  iconOnly = false,
  disabled = false,
  className = '',
  size = 'sm',
}: HoldButtonProps) {
  const [isHolding, setIsHolding] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)
  const startTimeRef = useRef<number | null>(null)
  const animFrameRef = useRef<number | null>(null)

  const stopHolding = useCallback(() => {
    setIsHolding(false)
    startTimeRef.current = null
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    // Snap back to 0
    setProgress(0)
  }, [])

  const startHolding = useCallback(() => {
    if (disabled || isCompleted) return
    setIsHolding(true)
    startTimeRef.current = performance.now()

    const step = (now: number) => {
      if (!startTimeRef.current) return
      const elapsed = now - startTimeRef.current
      const currentProgress = Math.min((elapsed / holdDuration) * 100, 100)
      setProgress(currentProgress)

      if (currentProgress >= 100) {
        setIsCompleted(true)
        setIsHolding(false)
        startTimeRef.current = null
        onHoldComplete()
        setTimeout(() => {
          setIsCompleted(false)
          setProgress(0)
        }, 1500)
      } else {
        animFrameRef.current = requestAnimationFrame(step)
      }
    }

    animFrameRef.current = requestAnimationFrame(step)
  }, [disabled, isCompleted, holdDuration, onHoldComplete])

  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [])

  const isSmall = size === 'sm'

  return (
    <button
      type="button"
      onMouseDown={startHolding}
      onMouseUp={stopHolding}
      onMouseLeave={stopHolding}
      onTouchStart={startHolding}
      onTouchEnd={stopHolding}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          if (!isHolding) startHolding()
        }
      }}
      onKeyUp={stopHolding}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: iconOnly ? (isSmall ? '6px' : '8px') : isSmall ? '5px 10px' : '7px 14px',
        borderRadius: '7px',
        border: '1px solid rgba(251, 113, 133, 0.28)',
        backgroundColor: '#171c25',
        color: '#fda4af',
        fontSize: isSmall ? '12px' : '13px',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        overflow: 'hidden',
        userSelect: 'none',
        outline: 'none',
        transform: isHolding ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform 120ms cubic-bezier(0.23, 1, 0.32, 1), border-color 150ms ease',
        opacity: disabled ? 0.5 : 1,
      }}
      className={className}
    >
      {/* Progress Fill Layer (React Bits hold pattern) */}
      <span
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: `${progress}%`,
          backgroundColor: '#f43f5e',
          opacity: 0.18,
          transition: isHolding ? 'none' : 'width 200ms ease-out',
          pointerEvents: 'none',
        }}
      />

      {/* Progress bottom stroke line */}
      <span
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '2px',
          width: `${progress}%`,
          backgroundColor: '#fb7185',
          transition: isHolding ? 'none' : 'width 200ms ease-out',
          pointerEvents: 'none',
        }}
      />

      {/* Content */}
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        {isCompleted ? (
          <Check size={isSmall ? 13 : 15} className="text-[#75bbef]" aria-hidden="true" />
        ) : (
          <Trash2 size={isSmall ? 13 : 15} aria-hidden="true" />
        )}
        {!iconOnly && (
          <span>
            {isCompleted ? 'Deleted' : isHolding ? 'Keep holding...' : label}
          </span>
        )}
      </span>
    </button>
  )
}

