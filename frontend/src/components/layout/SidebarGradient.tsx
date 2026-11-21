'use client'

import { useId } from 'react'

const BARS = [
  { x: -31.01, y: 1220.24, width: 354.6, height: 285.76, tint: 'rgba(7, 17, 30, .18)' },
  { x: 261.56, y: 1065.63, width: 354.6, height: 440.37, tint: 'rgba(255, 255, 255, .035)' },
  { x: 554.13, y: 916.93, width: 354.6, height: 589.07, tint: 'rgba(7, 17, 30, .12)' },
  { x: 846.7, y: 799.96, width: 354.6, height: 706.04, tint: 'rgba(255, 255, 255, .03)' },
  { x: 1139.27, y: 632.28, width: 354.6, height: 873.72, tint: 'rgba(7, 17, 30, .1)' },
  { x: 1431.84, y: 351, width: 354.6, height: 1155, tint: 'rgba(255, 255, 255, .035)' },
  { x: 1724.42, y: 56.48, width: 354.6, height: 1449.52, tint: 'rgba(7, 17, 30, .1)' },
] as const

interface SidebarGradientProps {
  className?: string
}

/**
 * The supplied Soundwave preset, reduced to the one SVG scene the sidebar
 * needs. This keeps the reference visual without an iframe or editor runtime.
 */
export function SidebarGradient({ className = '' }: SidebarGradientProps) {
  const gradientId = useId().replace(/:/g, '')

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 2048 1506"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#121519" />
            <stop offset="18%" stopColor="#17243a" />
            <stop offset="43%" stopColor="#1b3457" />
            <stop offset="67%" stopColor="#204b74" />
            <stop offset="84%" stopColor="#276783" />
            <stop offset="100%" stopColor="#4e8a90" />
          </linearGradient>
        </defs>
        <rect width="2048" height="1506" fill="#121519" />
        {BARS.map((bar, index) => (
          <g key={index}>
            <rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} fill={`url(#${gradientId})`} />
            <rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} fill={bar.tint} />
          </g>
        ))}
      </svg>

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,14,19,0.94)_0%,rgba(11,14,19,0.84)_48%,rgba(11,14,19,0.72)_100%)]" />
      <div className="absolute inset-y-0 right-0 w-px bg-white/[0.05]" />
    </div>
  )
}
