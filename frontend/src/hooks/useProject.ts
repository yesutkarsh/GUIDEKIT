'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { Project } from '@/lib/types'

export function useProject(projectId: string) {
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProject = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.projects.get(projectId)
      setProject(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project')
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (projectId) fetchProject()
  }, [projectId, fetchProject])

  return { project, isLoading, error, refetch: fetchProject }
}
