'use client'

import { useState, useEffect, useRef, useCallback, ChangeEvent, FormEvent } from 'react'
import {
  FileText,
  Upload,
  Plus,
  CheckCircle2,
  AlertCircle,
  FileCode,
  BookOpen,
  X,
  UploadCloud,
  Sparkles,
} from 'lucide-react'
import { api } from '@/lib/api'
import { HoldButton } from '@/components/ui/HoldButton'
import { FuseButton } from '@/components/ui/FuseButton'
import { Modal } from '@heroui/react/modal'
import { Button } from '@heroui/react/button'
import { Spinner } from '@heroui/react/spinner'
import { Alert } from '@heroui/react/alert'
import { Skeleton } from '@heroui/react/skeleton'
import { toast } from '@heroui/react/toast'
import type { KnowledgeSourceItem } from '@/lib/types'
import styles from './ProjectWorkspace.module.css'

interface KnowledgeTabProps {
  projectId: string
}

export function KnowledgeTab({ projectId }: KnowledgeTabProps) {
  const [sources, setSources] = useState<KnowledgeSourceItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Upload file state
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgressText, setUploadProgressText] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Paste text modal state
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [pasteTitle, setPasteTitle] = useState('')
  const [pasteContent, setPasteContent] = useState('')
  const [isSubmittingText, setIsSubmittingText] = useState(false)

  const loadSources = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await api.knowledge.list(projectId)
      setSources(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load knowledge sources'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadSources()
  }, [loadSources])

  // ESC key for modal
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && showPasteModal) {
        setShowPasteModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showPasteModal])

  const processFile = async (file: File) => {
    setIsUploading(true)
    setError(null)
    setSuccess(null)
    setUploadProgressText(`Uploading and chunking "${file.name}"...`)

    try {
      const res = await api.knowledge.upload(projectId, file)
      const successMsg = `Indexed "${file.name}" into ${res.indexed_chunks} semantic chunks.`
      setSuccess(successMsg)
      toast.success(successMsg)
      await loadSources()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload document'
      setError(msg)
      toast.danger(msg)
    } finally {
      setIsUploading(false)
      setUploadProgressText('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await processFile(file)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      await processFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleTextSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!pasteTitle.trim() || !pasteContent.trim()) {
      setError('Please provide both a document title and content body.')
      return
    }

    setIsSubmittingText(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await api.knowledge.indexText(projectId, {
        title: pasteTitle.trim(),
        content: pasteContent.trim(),
      })
      const msg = `Indexed "${pasteTitle}" into ${res.indexed_chunks} semantic chunks.`
      setSuccess(msg)
      toast.success(msg)
      setPasteTitle('')
      setPasteContent('')
      setShowPasteModal(false)
      await loadSources()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to index text knowledge'
      setError(msg)
      toast.danger(msg)
    } finally {
      setIsSubmittingText(false)
    }
  }

  const handleDelete = async (sourceId: string, title: string) => {
    setError(null)
    try {
      await api.knowledge.delete(projectId, sourceId)
      setSources((prev) => prev.filter((s) => s.id !== sourceId))
      toast.success(`Removed "${title}" from index.`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete knowledge source'
      setError(msg)
      toast.danger(msg)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".pdf,.txt,.md,.markdown"
        style={{ display: 'none' }}
      />

      {/* Unified Compact Upload Surface (Eliminating duplication & saving space) */}
      <div className="bg-[#171c25] border border-white/[0.11] rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-5 shadow-[0_1px_3px_rgba(23,26,24,0.03)]">
        <div
          className={`flex-1 w-full border-2 border-dashed rounded-lg p-5 flex flex-col sm:flex-row items-center gap-4 cursor-pointer transition-colors ${
            isDragOver ? 'border-[#52a9ff]/[0.5] bg-[#52a9ff]/[0.12]' : 'border-white/[0.11] hover:border-white/[0.24] bg-[#131820]'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          aria-label="Click or drag and drop to upload document"
        >
          <div className="w-10 h-10 rounded-lg bg-[#52a9ff]/[0.12] text-[#75bbef] flex items-center justify-center shrink-0">
            {isUploading ? (
              <Spinner size="sm" className="text-[#75bbef]" />
            ) : (
              <UploadCloud size={20} strokeWidth={1.75} />
            )}
          </div>
          <div className="text-center sm:text-left flex-1">
            <p className="m-0 text-sm font-semibold text-[#f1f4f9]">
              {isUploading
                ? uploadProgressText || 'Generating semantic embeddings...'
                : isDragOver
                ? 'Drop document to index...'
                : 'Click to upload or drag & drop files here'}
            </p>
            <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-1 text-xs text-[#8d97a8]">
              <span>Formats:</span>
              <span className="font-mono px-1 py-0.2 bg-[#171c25] border border-white/[0.11] rounded text-[11px]">PDF</span>
              <span className="font-mono px-1 py-0.2 bg-[#171c25] border border-white/[0.11] rounded text-[11px]">MD</span>
              <span className="font-mono px-1 py-0.2 bg-[#171c25] border border-white/[0.11] rounded text-[11px]">TXT</span>
            </div>
          </div>
        </div>

        <div className="flex sm:flex-col items-center justify-center gap-2 shrink-0 w-full md:w-auto border-t md:border-t-0 md:border-l border-white/[0.11] pt-3 md:pt-0 md:pl-5">
          <span className="text-xs text-[#8d97a8] font-medium hidden sm:inline">Or manually add:</span>
          <button
            type="button"
            onClick={() => setShowPasteModal(true)}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#171c25] border border-white/[0.24] text-[#f1f4f9] rounded-lg text-xs font-semibold hover:bg-[#1b222d] active:scale-[0.97] transition-all"
          >
            <Plus size={14} strokeWidth={2} />
            <span>Paste Text / FAQ</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <Alert status="danger" className="border border-red-400/25 bg-red-500/[0.08] text-red-200 rounded-xl p-4">
          <Alert.Indicator>
            <AlertCircle size={18} />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title className="font-semibold text-sm">Knowledge Base Error</Alert.Title>
            <Alert.Description className="text-xs mt-1">{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {success && (
        <div className="flex items-center justify-between p-3.5 bg-[#52a9ff]/[0.12] border border-[#52a9ff]/[0.5] rounded-xl text-[#75bbef]">
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 size={16} className="text-[#75bbef] shrink-0" aria-hidden="true" />
            <span className="font-medium text-[#f1f4f9]">{success}</span>
          </div>
          <button
            onClick={() => setSuccess(null)}
            className="text-[#8d97a8] hover:text-[#f1f4f9] p-1 rounded"
            aria-label="Dismiss message"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Sources Table */}
      <div className={styles.sourcesTableCard}>
        <div className={styles.sourcesTableHeader}>
          <div className={styles.sourcesTableTitle}>
            <BookOpen size={16} className="text-[#75bbef]" aria-hidden="true" />
            <span>Indexed Knowledge Documents ({sources.length})</span>
          </div>
          {sources.length > 0 && (
            <span className="text-xs text-[#8d97a8]">
              Grounding GuideBot in live vector index
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="p-8 space-y-3">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        ) : sources.length === 0 ? (
          <div className="py-16 px-6 text-center text-[#b8c0ce]">
            <BookOpen size={36} className="mx-auto mb-3 opacity-30 text-[#75bbef]" aria-hidden="true" />
            <p className="text-sm font-semibold text-[#f1f4f9] m-0 mb-1">
              No knowledge documents indexed yet
            </p>
            <p className="text-xs text-[#8d97a8] max-w-md mx-auto m-0">
              Upload customer manuals, policies, or product FAQs above so GuideBot answers questions with factual precision.
            </p>
          </div>
        ) : (
          <div className={styles.tableScrollArea}>
            <table className={styles.sourcesTable} aria-label="Indexed knowledge sources table">
              <thead>
                <tr>
                  <th scope="col">Document Title</th>
                  <th scope="col">Format</th>
                  <th scope="col">Semantic Chunks</th>
                  <th scope="col">Indexed Date</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((src) => {
                  const isPdf = src.source_type === 'pdf'
                  const isMd = src.source_type === 'markdown'

                  return (
                    <tr key={src.id} className={styles.sourcesTableRow}>
                      <td>
                        <div className={styles.docTitleCell}>
                          {isPdf ? (
                            <FileText size={17} className={styles.docIconPdf} aria-hidden="true" />
                          ) : isMd ? (
                            <FileCode size={17} className={styles.docIconMd} aria-hidden="true" />
                          ) : (
                            <BookOpen size={17} className={styles.docIconTxt} aria-hidden="true" />
                          )}
                          <span className="truncate max-w-[340px]">{src.title}</span>
                        </div>
                      </td>

                      <td>
                        <span className={styles.typeBadge}>
                          {src.source_type}
                        </span>
                      </td>

                      <td>
                        <span className={styles.chunkBadge}>
                          <Sparkles size={11} aria-hidden="true" />
                          <span>{src.chunk_count} chunks</span>
                        </span>
                      </td>

                      <td className="text-xs text-[#b8c0ce]">
                        {new Date(src.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        {/* React Bits HoldButton for safe, tactile deletion */}
                        <HoldButton
                          onHoldComplete={() => handleDelete(src.id, src.title)}
                          iconOnly
                          size="sm"
                          label={`Hold to delete ${src.title}`}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paste Raw Text Modal with Clean, Soft Input Borders (No Black Borders) */}
      <Modal isOpen={showPasteModal} onOpenChange={(open) => setShowPasteModal(open)}>
        <Modal.Backdrop className={styles.modalOverlay} isDismissable={!isSubmittingText}>
          <Modal.Container className={styles.modalContent} placement="center">
            <Modal.Dialog aria-label="Add text knowledge or FAQ">
              <form onSubmit={handleTextSubmit}>
                <Modal.Header className={styles.modalHeader}>
                  <Modal.Heading className={styles.modalTitle}>
                    Add Text Knowledge / Policy / FAQ
                  </Modal.Heading>
                  <Modal.CloseTrigger
                    className={styles.modalCloseBtn}
                    aria-label="Close dialog"
                    isDisabled={isSubmittingText}
                  >
                    <X size={18} aria-hidden="true" />
                  </Modal.CloseTrigger>
                </Modal.Header>

                <Modal.Body className={styles.modalBody}>
                  <div className={styles.formField}>
                    <label htmlFor="paste-doc-title" className={styles.fieldLabel}>
                      Document Title
                    </label>
                    <input
                      id="paste-doc-title"
                      type="text"
                      required
                      placeholder="e.g. Cancellation & Refund Policy"
                      value={pasteTitle}
                      onChange={(e) => setPasteTitle(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: '40px',
                        padding: '9px 12px',
                        border: '1px solid rgba(255, 255, 255, 0.11)',
                        borderRadius: '8px',
                        backgroundColor: '#131820',
                        color: '#f1f4f9',
                        fontSize: '13.5px',
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#52a9ff'
                        e.target.style.boxShadow = '0 0 0 3px rgba(82, 169, 255, 0.2)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.11)'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                    <span className={styles.fieldHint}>
                      A descriptive title helps vector embeddings match user questions.
                    </span>
                  </div>

                  <div className={styles.formField}>
                    <label htmlFor="paste-doc-content" className={styles.fieldLabel}>
                      Content Body
                    </label>
                    <textarea
                      id="paste-doc-content"
                      required
                      placeholder="Paste policy rules, terms, step instructions, or FAQs here..."
                      value={pasteContent}
                      onChange={(e) => setPasteContent(e.target.value)}
                      rows={6}
                      style={{
                        width: '100%',
                        minHeight: '140px',
                        padding: '10px 12px',
                        border: '1px solid rgba(255, 255, 255, 0.11)',
                        borderRadius: '8px',
                        backgroundColor: '#131820',
                        color: '#f1f4f9',
                        fontSize: '13px',
                        lineHeight: '1.55',
                        outline: 'none',
                        resize: 'vertical',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#52a9ff'
                        e.target.style.boxShadow = '0 0 0 3px rgba(82, 169, 255, 0.2)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.11)'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                    <span className={styles.fieldHint}>
                      {pasteContent.length} characters entered. Document will be indexed into semantic chunks.
                    </span>
                  </div>
                </Modal.Body>

                <Modal.Footer className={styles.modalFooter}>
                  <button
                    type="button"
                    onClick={() => setShowPasteModal(false)}
                    disabled={isSubmittingText}
                    className={styles.modalCancelBtn}
                  >
                    Cancel
                  </button>

                  {/* FuseButton for Primary Embedding Action */}
                  <FuseButton
                    type="submit"
                    variant="primary"
                    isLoading={isSubmittingText}
                    loadingText="Indexing Document..."
                    icon={<Sparkles size={14} aria-hidden="true" />}
                    size="sm"
                    disabled={!pasteTitle.trim() || !pasteContent.trim()}
                  >
                    Index Content
                  </FuseButton>
                </Modal.Footer>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  )
}
