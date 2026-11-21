'use client'

import Link from 'next/link'
import { ArrowUpRight, Globe } from 'lucide-react'
import type { Project } from '@/lib/types'
import { ProjectBackground } from './ProjectBackground'

const frameworkLabels: Record<string, string> = {
  nextjs: 'Next.js',
  react: 'React',
  sveltekit: 'SvelteKit',
  svelte: 'Svelte',
  vue: 'Vue',
  vanilla: 'Vanilla JS',
}

export function ProjectCard({ project }: { project: Project }) {
  const frameworkName = frameworkLabels[project.framework] || project.framework
  const isProduction = project.environment === 'production'

  return (
    <Link
      href={`/dashboard/projects/${project.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-[#56657a] bg-[#171c25] outline-none transition-colors duration-150 hover:border-[#637188] hover:bg-[#1b222d] focus-visible:ring-2 focus-visible:ring-[#52a9ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0e13]"
    >
      {/* Visual Header */}
      <div className="relative h-28 w-full overflow-hidden bg-[#e4e9e5]">
        <ProjectBackground backgroundId={project.background_id} />

        {/* Top Badges Overlay */}
        <div className="absolute inset-0 p-3 flex items-start justify-between z-10">
          <span className="inline-flex items-center rounded-md border border-white/20 bg-black/70 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md">
            {frameworkName}
          </span>
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-[#181c24]/90 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
            <ArrowUpRight size={14} strokeWidth={2} />
          </div>
        </div>

        {/* Environment Badge */}
        <div className="absolute bottom-2.5 right-3 z-10">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md ${
              isProduction
                ? 'bg-[#52a9ff]/90 text-[#0b0e13] border-[#b9d9ff]/30'
                : 'border-white/20 bg-black/70 text-white'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isProduction ? 'bg-[#0b0e13]' : 'bg-amber-400'
              }`}
            />
            <span className="capitalize">{project.environment}</span>
          </span>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div>
          <h2 className="truncate text-[15px] font-semibold text-[#f1f4f9] transition-colors group-hover:text-white">
            {project.name}
          </h2>
          <code className="mt-0.5 block truncate font-mono text-[12px] text-[#8d97a8]">
            {project.slug}
          </code>
        </div>

        {/* Card Footer Meta */}
        <div className="flex items-center justify-between border-t border-[#2b3442] pt-3 text-xs text-[#8d97a8]">
          <div
            className="flex items-center gap-1.5 flex-wrap"
            aria-label={`Locales: ${project.supported_locales.join(', ')}; ${project.default_locale} default`}
          >
            <Globe size={13} className="shrink-0 text-[#8d97a8]" aria-hidden="true" />
            <span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#b8c0ce]">
              {project.default_locale}
            </span>
            {project.supported_locales.length > 1 && (
              <span className="text-[11px] text-[#8d97a8]">
                +{project.supported_locales.length - 1}
              </span>
            )}
          </div>
          <span className="text-[11px] font-medium text-[#b8c0ce] transition-colors group-hover:text-white">
            Open →
          </span>
        </div>
      </div>
    </Link>
  )
}
