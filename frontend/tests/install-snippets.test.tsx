import { describe, expect, it } from 'vitest'
import {
  environmentSnippet,
  npmSnippet,
  scriptSnippet,
} from '@/components/project/InstallTab'

describe('GuideKit installation snippets', () => {
  it('uses the SDK API that is actually exported', () => {
    const examples = [
      npmSnippet('nextjs', 'gk_pk_live_test', 'en'),
      npmSnippet('react', 'gk_pk_live_test', 'en'),
      npmSnippet('sveltekit', 'gk_pk_live_test', 'en'),
      npmSnippet('vue', 'gk_pk_live_test', 'en'),
    ]

    for (const example of examples) {
      expect(example.code).toContain('GuideKit.init')
      expect(example.code).not.toContain('GuideKitProvider')
      expect(example.code).not.toContain('initGuideKit')
      expect(example.code).not.toContain('projectSlug')
      expect(example.code).not.toContain('publishableKey')
    }
  })

  it('uses framework-specific public environment variable names', () => {
    expect(environmentSnippet('nextjs', 'key')).toBe('NEXT_PUBLIC_GUIDEKIT_KEY=key')
    expect(environmentSnippet('react', 'key')).toBe('VITE_GUIDEKIT_KEY=key')
    expect(environmentSnippet('sveltekit', 'key')).toBe('PUBLIC_GUIDEKIT_KEY=key')
  })

  it('builds an auto-initializing script tag with the website key', () => {
    const code = scriptSnippet('gk_pk_live_test', 'en')
    expect(code).toContain('data-guidekit-key="gk_pk_live_test"')
    expect(code).toContain('data-locale="en"')
    expect(code).toContain('defer')
    expect(code).not.toContain('projectSlug')
  })
})
