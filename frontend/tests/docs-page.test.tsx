import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import DocsPage from '@/app/docs/page'

describe('DocsPage', () => {
  afterEach(cleanup)

  it('leads with the two supported installation methods', () => {
    render(<DocsPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Add GuideKit to your website' })).toBeDefined()
    expect(screen.getAllByText('npm package').length).toBeGreaterThan(0)
    expect(screen.getAllByText('CDN script').length).toBeGreaterThan(0)
  })

  it('filters navigation and shows a useful empty state', () => {
    render(<DocsPage />)
    const search = screen.getByLabelText('Search docs')
    fireEvent.change(search, { target: { value: '403' } })
    expect(screen.getByRole('link', { name: 'Troubleshooting' })).toBeDefined()
    fireEvent.change(search, { target: { value: 'unfindable phrase' } })
    expect(screen.getByText('No matching documentation.')).toBeDefined()
  })

  it('switches framework examples without exposing retired SDK names', () => {
    render(<DocsPage />)
    fireEvent.change(screen.getByLabelText('Framework'), { target: { value: 'vue' } })
    expect(screen.getByText('src/main.ts')).toBeDefined()
    expect(screen.getByText(/createApp\(App\)/)).toBeDefined()
    expect(screen.queryByText(/GuideKitProvider/)).toBeNull()
  })
})
