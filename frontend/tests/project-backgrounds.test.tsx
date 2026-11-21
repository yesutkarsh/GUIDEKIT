import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CircularGallery } from '@/components/project-creation/CircularGallery'
import { PROJECT_BACKGROUNDS, getProjectBackground, randomProjectBackgroundId } from '@/lib/projectBackgrounds'

describe('Project background selection', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  })
  afterEach(cleanup)

  it('uses a stable legacy fallback and only returns registered random IDs', () => {
    expect(getProjectBackground('unknown').id).toBe('untitled-blend')
    const ids = new Set(PROJECT_BACKGROUNDS.map((background) => background.id))
    for (let index = 0; index < 25; index += 1) expect(ids.has(randomProjectBackgroundId())).toBe(true)
  })

  it('supports click and keyboard background selection', () => {
    const onSelect = vi.fn()
    render(<CircularGallery selectedId="untitled-blend" onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Sunset Pop' }))
    expect(onSelect).toHaveBeenCalledWith('sunset-pop')

    fireEvent.keyDown(screen.getByRole('group', { name: 'Choose a project background' }), { key: 'ArrowRight' })
    expect(onSelect).toHaveBeenCalledWith('citron')
  })
})
