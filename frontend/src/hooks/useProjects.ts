'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { Project } from '@/lib/types'

export function useProjects(organizationId: string | null) {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    if (!organizationId) {
      setProjects([])
      setError(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.projects.list(organizationId)
      setProjects(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects')
      return false
    } finally {
      setIsLoading(false)
    }
    return true
  }, [organizationId])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  return { projects, isLoading, error, refetch: fetchProjects }
}
