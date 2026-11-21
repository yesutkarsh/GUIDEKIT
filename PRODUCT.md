# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Primary users**: Web application software engineers, frontend developers, and product teams building and maintaining in-app interactive walkthroughs, procedural tours, and onboarding flows.
- **Secondary / End users**: Visitors and customers using client web applications (such as the Taxi Sanchalak demo) who experience non-intrusive step-by-step guidance and AI answers.

## Product Purpose
GuideKit makes in-app guided tours and knowledge assistance durable, automated, and developer-native. It eliminates fragile, high-maintenance tour builders by capturing steps directly from developer source code (AST-level in VS Code), publishing workflows to CDN, and automatically repairing broken DOM selectors via AI (Tier 3 Auto-Heal). Success means tours never break when code changes and developers spend zero hours maintaining brittle selectors.

## Positioning
"From IDE to DOM to AI Self-Healing": Unlike legacy digital adoption platforms (e.g. Appcues, Pendo, WalkMe) that rely on brittle manual CSS selectors or fragile point-and-click browser recorders, GuideKit connects the developer's IDE directly to the client runtime with an integrated AI self-healing pipeline (Tier 3 AI mutate heal) and RAG policy assistant (Mercury 3 LLM).

## Operating Context
Multi-surface developer and runtime environment:
- **Developer IDE**: VS Code / Cursor extension (`guidekit-vscode`) with AST step capture (`Cmd+Shift+G`).
- **Web Console**: Developer Dashboard (`/dashboard`) for workflow publication, knowledge ingestion (`/dashboard/knowledge`), self-healing inbox (`/dashboard/healing`), and device auth (`/device`).
- **Client Web Apps**: Applications embedding the GuideKit Web SDK with the floating GuideBot interactive tour widget.

## Capabilities and Constraints
- Source code AST-based step capture directly within VS Code.
- Workflow staging, versioning, and publishing to CDN.
- 4 Chaos resilience tiers: Tier 1 Healthy, Tier 2 Stripped, Tier 3 AI Mutated Heal, Tier 4 Text Fallback.
- Document and FAQ ingestion with vector search (pgvector) in Neon PostgreSQL.
- Fast conversational policy Q&A powered by Inception Labs Mercury 3 LLM.
- Frontend stack: Next.js 15, React 19, Clerk auth, Astryx (`AppShell`, `SideNav`), HeroUI (interactive controls/modals), Tailwind CSS v4, Lucide icons.
- Strict design contract: Governed by `DESIGN.md` and CSS tokens in `frontend/src/styles/guidekit-tokens.css`.
- Decoupled auth sessions: Website and extension maintain separate authentication sessions.

## Brand Commitments
- **Name**: GuideKit (GuideBot for the interactive assistant).
- **Brand Voice & Tone**: Calm, precise, restrained, and useful. No gratuitous decorative animations or fake controls. Emerald (`#087a55`) used strictly for meaningful emphasis.
- **Visual contract**: Dark ink (`#171a18`), warm-white canvas (`#f6f7f4`), white surface (`#ffffff`), 4px spacing base, 8/12/16px radii.

## Evidence on Hand
- Interactive Customer Demo: Taxi Sanchalak demo application (`/demo/taxi-sanchalak`) demonstrating all 4 Chaos Modes and Driver.js spotlight integration.
- FastAPI backend with 31+ REST endpoints, pgvector integration, and healthcheck.
- Design contract in `DESIGN.md` and canonical tokens in `frontend/src/styles/guidekit-tokens.css`.
- Automated test suites: Pytest backend tests, Vitest component tests, Playwright browser auth tests.

## Product Principles
- **Resilience over Fragility**: Tours must never break silently when client code or DOM changes; self-heal via AI or degrade gracefully to text fallbacks.
- **Developer-Native Authoring**: Tour creation belongs in the developer's natural IDE workflow, not in separate browser overlay tools.
- **Calm Precision**: The interface recedes and supports the user's focus; feedback is immediate, predictable, and quiet without decorative bloat.
- **Strict Component Ownership**: Astryx owns persistent layout/navigation; HeroUI owns interactive controls; Lucide supplies product icons at 16–18px (1.75–2px stroke).

## Accessibility & Inclusion
- Strict WCAG AA compliance (4.5:1 text contrast on surfaces, 3:1 for interactive control borders).
- Stable skeleton loaders without layout shift.
- Touch targets must be at least 44px with zero horizontal page overflow.
- All icon-only buttons require accessible labels and tooltips.
- Full keyboard navigation and respect for `prefers-reduced-motion`.

