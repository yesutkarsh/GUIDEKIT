# GuideKit Design Contract

This contract applies to GuideKit website and extension UI. Read it before changing interface code.

## Product character

GuideKit should feel calm, precise, and useful. The authenticated dashboard uses a cool dark canvas, low-chroma navy surfaces, soft white text, and restrained blue emphasis. The sidebar may use the approved Soundwave visual beneath a dark readability veil. Prefer clarity and restraint over decoration.

## Ownership

- Astryx owns persistent application layout and navigation (`AppShell`, `SideNav`).
- HeroUI owns interactive controls, fields, menus, drawers, modals, alerts, skeletons, tooltips, and toasts.
- Lucide supplies product icons at 16–18px with a consistent 1.75–2px stroke.
- Do not introduce a third component system without a documented need.

### VS Code webview exception

The VS Code extension uses native semantic controls styled with Tailwind because its webviews ship without the dashboard React runtime. Keep the same tokens, interaction behavior, and accessibility contract; do not introduce a second control library. Lucide remains the icon source.

## Tokens

- Dashboard canvas: `#0b0e13`; surface: `#171c25`; subtle surface: `#131820`; hover surface: `#1b222d`.
- Dashboard ink: `#f1f4f9`; muted text: `#b8c0ce`; subtle text: `#8d97a8`. All normal-size text pairings must meet WCAG AA (4.5:1).
- Primary action: `#182d50`; hover: `#203d67`; action ink: `#ffffff`. Interactive emphasis: `#52a9ff`; hover: `#75bbef`; soft blue: `rgba(47, 138, 204, .16)`; destructive: `#f87171`.
- Body, UI, and headings use Inter, then system sans-serif. Use regular and medium weights for most UI; reserve semibold for compact headings that need extra hierarchy.
- Spacing follows a 4px base. Common gaps are 8, 12, 16, 24, and 32px.
- Radii: 8px controls, 12px cards, 16px large surfaces. Avoid pill shapes unless the component is a badge.
- Elevation is rare: `0 18px 45px rgba(0, 0, 0, .5)` for overlays only.

The canonical CSS variables live in `frontend/src/styles/guidekit-tokens.css`.

## Responsive layout

- Desktop sidebar: 256px; use the mobile drawer below 900px.
- Main content should cap around 1240px and keep 20–32px page padding; use 16px on phones.
- Touch targets must be at least 44px. Never allow horizontal page overflow.

## States and accessibility

- Loading uses stable skeletons or a fixed-size progress region; never shift the surrounding layout.
- Persistent failures use an alert with a recovery action. Successful or transient outcomes use toasts.
- Empty states explain what is empty and provide one useful next action.
- All icon-only buttons require an accessible label and tooltip.
- Preserve visible focus, logical tab order, semantic headings, and sufficient contrast.
- Honor `prefers-reduced-motion`; navigation state changes immediately.

## Guardrails

- One primary action per context. Never duplicate the same CTA in the shell and page.
- No fake controls, excessive gradients, animated transforms on cards, or decorative loaders.
- Keep labels short, but do not replace meaning with an ambiguous icon.
- Project cards are links and must work with keyboard navigation.
- Authentication and dashboard may use different compositions, but share typography, color, radius, and spacing tokens.

