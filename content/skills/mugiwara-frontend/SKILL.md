---
name: mugiwara-frontend
description: Use for frontend component, CSS styling, responsive layout, accessible — matching standards, extraction.
gate_artifact: flows/01-execution.md — frontend evidence (tokens.css + component evidence)
---

# Frontend (Anti-Slop)

## Skip when

- Diff touches no UI code: backend, docs, config, or CLI-only change.
- No visual change, markup, styling, or frontend behavior in the mission.
Interfaces built under this skill must not look templated.

## Source-backed code

Framework code from docs, not memory — `_shared/references/source-grounding.md`.
- React Server Actions: `useActionState` for form pending/error state — https://react.dev/reference/react/useActionState
- Tailwind class scanning: `content` purge paths — https://v3.tailwindcss.com/docs/content-configuration
## Existing repo standard first

Match the repo's standard before writing anything new; reuse its components and patterns. Greenfield with no UI: skip to design-system extraction.
- Component library (MUI/Tailwind/shadcn/etc) — a new button looks like the repo's buttons, not the internet's.
- File conventions, naming, folder structure, CSS strategy; lint/format/test scripts.
- Tokens already in the theme/config; existing page patterns — how pages compose sections and state.
## Redesigns: audit first

Capture current layout, spacing/type scales, palette, and component inventory before changing existing UI. Fix real problems; do not restyle what works.

## Design-system extraction (before markup)

Tokens BEFORE markup — no tokens, no markup. Write `tokens.css` (CSS custom properties on `:root`) unless the stack keeps tokens elsewhere:
- Spacing: 4/8 grid — 4, 8, 12, 16, 24, 32, 48, 64 (`space-xs`…`space-3xl`).
- Type: 12/14/16/18/24/32/48 scale, 1.5 line-height, 45–75ch measure (`text-sm`…`text-display`).
- Role palette: `surface-muted`, `text-primary`, `border-default`, `accent` — semantic, not color names.
- Radii: 2/4/8/12/full; shadows sm–xl; motion: duration + easing (`duration-fast`, `ease-in-out`).
Semantic names only (`surface-muted`, never `gray-100`). Full rules: `references/design-tokens.md`.

## Primitives (reuse, 100%)

Build `Button`, `Input`, `Card`, `Stack` from tokens; compose every screen from them. A bespoke component is debt on every screen — reuse primitives or justify the exception.
- Storybook story per primitive as behavior reference, not a build harness — https://storybook.js.org/docs
- Tailwind: `content: ['./src/**/*.{ts,tsx}']` purge in `tailwind.config.ts`; `prettier-plugin-tailwindcss` for stable class order.
- Variants over props soup: 3+ boolean props = split the component; children/slots over config flags.
## Server Actions (React)

`useActionState(fn, initial)` returns `[state, formAction, isPending]`; pass `formAction` to `<form action>`. Progressive enhancement works even before hydration.
- Disable submit while `isPending` (`useFormStatus` for nested buttons).
- Render `state.error` into a `role="alert"`/`aria-live` region; every async region gets a `data-testid`.
- Keyboard path asserted: tab order, focus, Enter/Escape; no focus trap without escape.
## Component architecture

Compose, don't inherit. One responsibility per component; extract on reuse; leaves presentational (no data fetching).
- Composition over configuration: children/slots beat dozens of props.
- Naming by role (`ProductCard`, not `CardA`); variants over copy-paste.
## State management

Minimal state, local first; lift only what is shared. Server vs client: cache/refetch at a data layer, derive on render; no per-screen copies of API data. Loading/error/empty/success designed, not an afterthought.

## From Figma / image references

Extract tokens first, then reproduce structure faithfully: hierarchy, alignment, whitespace ratios. Do not "improve" the layout unasked. A one-off is not a license for a second system.

## Taste: positive design judgment

- Hierarchy and rhythm: one primary action per view, one focal point, consistent spacing.
- Restraint: fewer, more considered elements; whitespace is a tool.
- Typography: 1-2 typefaces, deliberate scale, weight for emphasis, 45-75ch lines.
- Color: role-based palette, contrast AA minimum, never pure-black-on-pure-white for text.
- Consistency: the same thing looks the same everywhere.
- Intentionality: every element earns its place; if you cannot say why, remove it.
- State design: hover, focus, active, disabled, loading, error, empty — designed.
- Craft: spacing grids; motion respecting `prefers-reduced-motion`; verified at breakpoints.
## Responsive behavior

Mobile-first; default full-width stacked, columns only when there is room. Use the stack's breakpoints, not a parallel scale; fluid containers, type, and spacing. Verify at every breakpoint, including between them — 3 widths checked is not 12 checked.

## Performance budgets

- LCP <2.5s, CLS <0.1, INP <200ms. Images carry width/height or aspect-ratio; LCP asset preloaded; fonts `font-display`; input handlers off the main thread.
- No layout thrash; animate only transform/opacity; lazy-load below the fold; no whole icon library for two icons; no re-render storms (stable keys, no work in render).
- Lighthouse/lighthouse-ci in repo? Run it; scores meet budgets, deltas explained. Measure before optimizing.
## Banned AI-default patterns (the slop list)

- Centered hero trio; row of 3-4 identical feature cards; purple/indigo gradient everything; glassmorphism; emoji as icons; placeholder copy; stock hero illustrations.
- Full catalog with the tell for each: `references/slop-catalog.md`. Brief genuinely calls for one? Execute it well — but default is don't.
## WCAG 2.1 AA accessibility

Full checklist: `references/checklist.md`.
- Keyboard: operable alone; logical tab order; visible focus; no trap without escape.
- Semantics: native elements over ARIA; landmarks; logical heading order.
- Contrast: 4.5:1 text, 3:1 large text/UI; never color-only meaning.
- Forms: every input labeled (placeholder is not a label); `aria-describedby` help.
- Dynamic content: `aria-live`; reduced-motion respected.
## Testability and verification

Stable `data-testid` on every interactive element and every async state (loading/error/empty). Never test by CSS class or by text that changes. Prefer `getByRole` — accessible name doubles as an a11y assertion. Keyboard paths asserted for menu/modal/form. Compare result against reference; list remaining deltas before done.

## Frontend security

- Never render user content via `dangerouslySetInnerHTML`/`v-html` unless sanitized.
- Escape user input in every template; no secrets in client code; validate URL params/storage/API input.
- `rel="noopener"` on `target="_blank"`; validate URLs before navigating.
## Red flags

- "Optimize when it's slow" — perf regressions ship measured later, rarely.
- "It's client-side, so no security review" — client is public by definition.
- "New screen, new components" — primitives are default; bespoke is exception.
- "Global store for everything" — local state first; lift only what's shared.
## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "The brief calls for a hero trio." | A brief calling for slop is a constraint, not a license. |
| "It's just a landing page." | Still verified for responsive and a11y at every breakpoint. |
| "Good enough." | Not done until compared against the reference with deltas listed. |
| "Everyone ships this card row." | Popularity is not design; banned stays banned. |
| "Tokens later." | Tokens extracted before markup, or the layout gets rebuilt. |
| "Our repo is messy, I'll use my own style." | Match the repo standard first, then propose raising it. |

If a rationalization wins, name it in the report as a known delta — not as silence.

