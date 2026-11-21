'use client'

import { getProjectBackground } from '@/lib/projectBackgrounds'
import type { ProjectBackgroundId } from '@/lib/types'
import styles from './ProjectBackground.module.css'

interface ProjectBackgroundProps {
  backgroundId?: ProjectBackgroundId | string | null
  className?: string
  isLive?: boolean
  label?: string
}

export function ProjectBackground({ backgroundId, className = '', isLive = false, label }: ProjectBackgroundProps) {
  const background = getProjectBackground(backgroundId)

  return (
    <div
      className={`${styles.background} ${styles[background.type]} ${isLive ? styles.live : ''} ${className}`}
      style={background.posterStyle}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-background-id={background.id}
    >
      <span className={styles.layerOne} />
      <span className={styles.layerTwo} />
      <span className={styles.grain} />
    </div>
  )
}
