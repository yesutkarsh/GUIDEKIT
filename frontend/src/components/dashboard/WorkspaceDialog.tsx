'use client'

import { FormEvent, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@heroui/react/button'
import { Modal } from '@heroui/react/modal'
import { toast } from '@heroui/react/toast'
import { useDashboardWorkspace } from '@/contexts/DashboardWorkspaceContext'

interface WorkspaceDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function WorkspaceDialog({ isOpen, onOpenChange }: WorkspaceDialogProps) {
  const { createOrganization } = useDashboardWorkspace()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setName('')
      setError('')
    }
  }, [isOpen])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const value = name.trim()
    if (!value) return setError('Enter a workspace name.')
    setIsSaving(true)
    setError('')
    try {
      await createOrganization(value)
      toast.success(`Workspace “${value}” created.`)
      onOpenChange(false)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to create workspace.'
      setError(message)
      toast.danger(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        isDismissable={!isSaving}
      >
        <Modal.Container className="flex w-full justify-center" placement="center">
          <Modal.Dialog
            className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-100 shadow-2xl shadow-black/50 outline-none"
            aria-label="Create workspace"
          >
            <form onSubmit={handleSubmit}>
              <Modal.Header className="flex items-center justify-between px-6 pt-6">
                <Modal.Heading className="text-lg font-semibold tracking-tight text-white">
                  Create workspace
                </Modal.Heading>
                <Modal.CloseTrigger
                  aria-label="Close"
                  isDisabled={isSaving}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <X size={18} />
                </Modal.CloseTrigger>
              </Modal.Header>

              <Modal.Body className="flex flex-col gap-5 px-6 py-5">
                <p className="m-0 text-sm leading-relaxed text-neutral-400">
                  Workspaces keep projects, keys, and team access organized.
                </p>

                <div className="flex flex-col gap-2">
                  <label htmlFor="workspace-name" className="text-xs font-medium text-neutral-400">
                    Workspace name
                  </label>
                  <input
                    id="workspace-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={120}
                    autoFocus
                    disabled={isSaving}
                    placeholder="Acme product team"
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-neutral-600 focus:ring-2 focus:ring-neutral-700/50 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  {error && (
                    <span className="text-xs text-red-400" role="alert">
                      {error}
                    </span>
                  )}
                </div>
              </Modal.Body>

              <Modal.Footer className="flex justify-end gap-2 border-t border-neutral-800 px-6 py-4">
                <Button
                  className="rounded-lg border border-neutral-800 bg-transparent px-4 py-2 text-sm font-medium text-neutral-300 transition hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  type="button"
                  onPress={() => onOpenChange(false)}
                  isDisabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
                  type="submit"
                  isDisabled={isSaving || !name.trim()}
                >
                  {isSaving ? 'Creating…' : 'Create workspace'}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
