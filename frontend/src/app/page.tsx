import Link from 'next/link'
import {
  Sparkles,
  ArrowRight,
  Code2,
  Cpu,
  Globe2,
  Terminal,
  ShieldCheck,
  Zap,
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-300 antialiased">
      {/* Nav */}
      <header className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
        <Link href="/" className="text-sm font-medium tracking-tight text-white">
          GuideKit
        </Link>
        <nav className="flex items-center gap-6 text-sm text-neutral-500">
          <Link href="/docs" className="transition-colors hover:text-white">
            Docs
          </Link>
          <Link href="/device" className="hidden transition-colors hover:text-white sm:block">
            Connect VS Code
          </Link>
          <Link href="/login" className="transition-colors hover:text-white">
            Sign in
          </Link>
          <Link href="/signup" className="text-white transition-opacity hover:opacity-70">
            Get started
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6">
        {/* Hero */}
        <section className="pb-24 pt-28 sm:pt-36">


          <h1 className="max-w-2xl text-4xl font-medium leading-[1.1] tracking-tight text-white sm:text-5xl">
            IDE-to-DOM self-healing product tours.
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-neutral-500">
            Build product walkthroughs straight from VS Code. When your production frontend changes,
            GuideKit’s multi-attribute fingerprinting and AI resolver automatically heal broken
            selectors.
          </p>

          <div className="mt-10 flex items-center gap-6">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-200"
            >
              Open Developer Console
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/device"
              className="text-sm text-neutral-500 transition-colors hover:text-white"
            >
              Approve device code
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="grid grid-cols-1 border-t border-neutral-900 md:grid-cols-3 md:divide-x md:divide-neutral-900">
          <div className="py-10 md:pr-8">
            <span className="font-mono text-xs text-neutral-700">01</span>
            <h3 className="mt-4 text-sm font-medium text-white">VS Code native authoring</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              Tag elements directly in JSX, Svelte, or Vue files. The VS Code extension connects via
              device code auth and syncs draft features straight to PostgreSQL.
            </p>
          </div>

          <div className="border-t border-neutral-900 py-10 md:border-t-0 md:px-8">
            <span className="font-mono text-xs text-neutral-700">02</span>
            <h3 className="mt-4 text-sm font-medium text-white">Self-healing DOM engine</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              When classes or IDs change in CI/CD, GuideKit uses tag fingerprints, aria roles, and AI
              visual anchors to heal locators and queue one-click review suggestions.
            </p>
          </div>

          <div className="border-t border-neutral-900 py-10 md:border-t-0 md:pl-8">
            <span className="font-mono text-xs text-neutral-700">03</span>
            <h3 className="mt-4 text-sm font-medium text-white">Multi-locale &amp; RAG chat</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              Localized popover copy (e.g. English + Hindi in Taxi Sanchalak). Natural language user
              queries trigger semantic feature tours or fall back to RAG knowledge answers.
            </p>
          </div>
        </section>

      </main>


    </div>
  )
}

