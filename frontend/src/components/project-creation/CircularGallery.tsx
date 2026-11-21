'use client'

import { useEffect, useMemo, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react'
import { Check } from 'lucide-react'
import { PROJECT_BACKGROUNDS } from '@/lib/projectBackgrounds'
import type { ProjectBackgroundId } from '@/lib/types'
import { ProjectBackground } from '@/components/dashboard/ProjectBackground'
import styles from './NewProject.module.css'

interface CircularGalleryProps {
  selectedId: ProjectBackgroundId
  onSelect: (id: ProjectBackgroundId) => void
  isDisabled?: boolean
}

interface GalleryStyle extends CSSProperties {
  '--gallery-distance': number
  '--gallery-direction': number
}

export function CircularGallery({ selectedId, onSelect, isDisabled = false }: CircularGalleryProps) {
  const galleryRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const dragRef = useRef<{ startX: number; startIndex: number; moved: boolean } | null>(null)
  const wheelAccumulator = useRef(0)
  const lastWheelTime = useRef(0)

  const selectedIndex = useMemo(
    () => Math.max(0, PROJECT_BACKGROUNDS.findIndex((background) => background.id === selectedId)),
    [selectedId]
  )

  const selectAt = (index: number) => {
    if (isDisabled) return
    const bounded = Math.max(0, Math.min(PROJECT_BACKGROUNDS.length - 1, index))
    onSelect(PROJECT_BACKGROUNDS[bounded].id)
    buttonRefs.current[bounded]?.focus?.({ preventScroll: true })
  }

  useEffect(() => {
    const button = buttonRefs.current[selectedIndex]
    if (!button) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    button.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', inline: 'center', block: 'nearest' })
  }, [selectedIndex])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isDisabled) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      selectAt(selectedIndex + 1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      selectAt(selectedIndex - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      selectAt(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      selectAt(PROJECT_BACKGROUNDS.length - 1)
    }
  }

  // Smooth, throttled wheel scroll to prevent fast runway spinning
  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (isDisabled) return
    const delta = Math.abs(event.deltaX) >= Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    if (Math.abs(delta) < 4) return

    wheelAccumulator.current += delta
    const now = Date.now()

    if (Math.abs(wheelAccumulator.current) > 35 && now - lastWheelTime.current > 160) {
      event.preventDefault()
      const direction = wheelAccumulator.current > 0 ? 1 : -1
      selectAt(selectedIndex + direction)
      wheelAccumulator.current = 0
      lastWheelTime.current = now
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (isDisabled || event.button !== 0) return
    // Record start position without capturing pointer so child button clicks fire reliably
    dragRef.current = { startX: event.clientX, startIndex: selectedIndex, moved: false }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || isDisabled) return
    const delta = event.clientX - dragRef.current.startX
    if (Math.abs(delta) > 10) {
      dragRef.current.moved = true
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId)
      }
      const steps = Math.round(Math.abs(delta) / 80)
      if (steps > 0) {
        selectAt(dragRef.current.startIndex + (delta < 0 ? steps : -steps))
      }
    }
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    // Clear drag after a tick so onClick can verify moved status
    setTimeout(() => {
      dragRef.current = null
    }, 50)
  }

  return (
    <div className={styles.galleryWrap}>
      <div
        ref={galleryRef}
        className={styles.gallery}
        role="group"
        aria-label="Choose a project background"
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        data-disabled={isDisabled || undefined}
      >
        {PROJECT_BACKGROUNDS.map((background, index) => {
          const relative = index - selectedIndex
          const galleryStyle: GalleryStyle = {
            '--gallery-distance': Math.min(3, Math.abs(relative)),
            '--gallery-direction': relative,
          }
          const selected = background.id === selectedId
          return (
            <button
              ref={(node) => { buttonRefs.current[index] = node }}
              className={styles.galleryItem}
              style={galleryStyle}
              type="button"
              key={background.id}
              aria-pressed={selected}
              aria-label={`${background.name}${selected ? ', selected' : ''}`}
              onClick={(e) => {
                if (dragRef.current?.moved) return
                e.stopPropagation()
                selectAt(index)
              }}
              disabled={isDisabled}
            >
              <span className={styles.galleryArtwork}><ProjectBackground backgroundId={background.id} /></span>
              <span className={styles.galleryName}>{background.name}</span>
              {selected && <span className={styles.galleryCheck} aria-hidden="true"><Check size={12} /></span>}
            </button>
          )
        })}
      </div>
      <p className={styles.galleryHelp}>Click any theme to select, or use arrow keys</p>
    </div>
  )
}
