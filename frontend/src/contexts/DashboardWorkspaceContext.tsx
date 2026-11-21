'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import type { Organization } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'
import {
  clearStoredWorkspaceId,
  getValidStoredWorkspaceId,
  storeWorkspaceId,
} from '@/lib/workspaceStorage'

interface DashboardWorkspaceContextValue {
  activeOrganization: Organization | null
  setActiveOrganization: (organization: Organization) => void
  createOrganization: (name: string) => Promise<Organization>
  renameOrganization: (name: string) => Promise<Organization>
}

const DashboardWorkspaceContext = createContext<DashboardWorkspaceContextValue | null>(null)

export function DashboardWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { organizations, refresh } = useAuth()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [optimisticOrganization, setOptimisticOrganization] = useState<Organization | null>(null)

  const availableOrganizations = useMemo(() => {
    if (!optimisticOrganization) return organizations
    const exists = organizations.some((organization) => organization.id === optimisticOrganization.id)
    return exists
      ? organizations.map((organization) => organization.id === optimisticOrganization.id ? optimisticOrganization : organization)
      : [...organizations, optimisticOrganization]
  }, [optimisticOrganization, organizations])

  useEffect(() => {
    if (!availableOrganizations.length) {
      setActiveId(null)
      clearStoredWorkspaceId()
      return
    }

    if (activeId && availableOrganizations.some((organization) => organization.id === activeId)) {
      return
    }

    const storedId = getValidStoredWorkspaceId(availableOrganizations)
    const nextId = storedId ?? (availableOrganizations.length === 1 ? availableOrganizations[0].id : null)

    setActiveId(nextId)
    if (nextId) storeWorkspaceId(nextId)
    else clearStoredWorkspaceId()
  }, [activeId, availableOrganizations])

  useEffect(() => {
    if (!optimisticOrganization) return
    const confirmed = organizations.some((organization) => (
      organization.id === optimisticOrganization.id && organization.name === optimisticOrganization.name
    ))
    if (confirmed) setOptimisticOrganization(null)
  }, [optimisticOrganization, organizations])

  const setActiveOrganization = useCallback((organization: Organization) => {
    setActiveId(organization.id)
    storeWorkspaceId(organization.id)
  }, [])

  const createOrganization = useCallback(async (name: string) => {
    const organization = await api.orgs.create({ name: name.trim() })
    setOptimisticOrganization(organization)
    setActiveId(organization.id)
    storeWorkspaceId(organization.id)
    await refresh()
    return organization
  }, [refresh])

  const renameOrganization = useCallback(async (name: string) => {
    if (!activeId) throw new Error('Select a workspace first.')
    const organization = await api.orgs.update(activeId, { name: name.trim() })
    setOptimisticOrganization(organization)
    await refresh()
    return organization
  }, [activeId, refresh])

  const value = useMemo(() => ({
    activeOrganization: availableOrganizations.find((organization) => organization.id === activeId) ?? null,
    setActiveOrganization,
    createOrganization,
    renameOrganization,
  }), [activeId, availableOrganizations, createOrganization, renameOrganization, setActiveOrganization])

  return (
    <DashboardWorkspaceContext.Provider value={value}>
      {children}
    </DashboardWorkspaceContext.Provider>
  )
}

export function useDashboardWorkspace() {
  const context = useContext(DashboardWorkspaceContext)
  if (!context) throw new Error('useDashboardWorkspace must be used inside DashboardWorkspaceProvider')
  return context
}
