---
name: mugiwara-frontend
description: Use when building or changing frontend UI: component, form, grid, image, CSS styling, responsive layout, accessible markup, ARIA labels, design tokens, performance budgets.
gate_artifact: flows/01-execution.md — frontend evidence (tokens.css + component evidence)
---

# Frontend

## Skip when

- Diff touches no UI code: backend, docs, config, or CLI-only change.
- No visual change, markup, styling, or frontend behavior in the mission.

Interfaces built under this skill must not look templated. Append a `## frontend (<task id>)` section to `flows/01-execution.md` (never overwrite it) with the evidence.

## Source-backed code

Framework code from docs, not memory: `_shared/references/source-grounding.md`. Pin the framework version from the dependency file and read that version's docs.

## Existing repo standard first

Match the repo before writing anything new; reuse its components and patterns. A new button looks like the repo's buttons, not the internet's. Learn the component library, file and naming conventions, CSS strategy, existing tokens, and how pages compose sections and state. Greenfield with no UI: go to design-system extraction.

Redesigns: capture current layout, spacing and type scales, palette, and component inventory first. Fix real problems; do not restyle what works.

## Design tokens (before markup)

Tokens before markup. Write `tokens.css` (CSS custom properties on `:root`) unless the stack keeps tokens elsewhere: a spacing grid, a type scale with 1.5 line-height and 45-75ch measure, a semantic role palette, radii, shadows, and motion durations. Semantic names only (`surface-muted`, never `gray-100`). Rules: `references/design-tokens.md`.

## Components and state

- Build `Button`, `Input`, `Card`, `Stack` from tokens and compose screens from them. A bespoke component needs a stated reason.
- Compose, do not inherit. One responsibility per component; extract on reuse; leaf components stay presentational.
- Name by role (`ProductCard`, not `CardA`). Three or more boolean props means split the component.
- State: local first, lift only what is shared. Cache and refetch at a data layer; no per-screen copies of API data. Design loading, error, empty, and success states.
- Forms: disable submit while pending, render errors into a `role="alert"` or `aria-live` region, assert the keyboard path (tab order, focus, Enter, Escape).

## From Figma or image references

Extract tokens first, then reproduce hierarchy, alignment, and whitespace faithfully. Do not improve the layout unasked. A one-off is not a license for a second system.

## Design judgment

- One primary action and one focal point per view; consistent spacing.
- Fewer, considered elements. 1-2 typefaces, deliberate scale.
- Role-based palette, contrast AA minimum, no pure black on pure white.
- Design hover, focus, active, disabled, loading, error, and empty states. Respect `prefers-reduced-motion`.
- Every element earns its place.

## Responsive and performance

Mobile-first; stack columns only when there is room. Use the stack's breakpoints, fluid containers and type. Verify at every breakpoint, including between them.

Budgets: LCP under 2.5s, CLS under 0.1, INP under 200ms. Images carry width/height or aspect-ratio; preload the LCP asset; animate only transform and opacity; lazy-load below the fold. Run Lighthouse when the repo has it and explain deltas. Measure before optimizing.

## Generic-looking UI patterns to avoid

Centered hero trio, a row of identical feature cards, purple gradients everywhere, glassmorphism, emoji as icons, placeholder copy, stock hero illustrations. A brief that calls for one: build it well, but the default is to avoid. Catalog: `references/slop-catalog.md`.

## Accessibility (WCAG 2.1 AA)

Checklist: `references/checklist.md`.

- Operable by keyboard alone; logical tab order; visible focus.
- Native elements over ARIA; landmarks; heading order.
- Contrast 4.5:1 for text, 3:1 for large text and UI; never meaning by color alone.
- Every input labeled (a placeholder is not a label).

## Testability

Every interactive element (button, link, input, form) and every async state carries a stable `data-testid`, asserted by the task's test and not only present in markup. Never test by CSS class or changing text. Prefer `getByRole`. Compare the result against the reference and list remaining deltas before done.

## Security

- No unsanitized user content in `dangerouslySetInnerHTML` or `v-html`; escape input in every template.
- No secrets in client code; validate URL params, storage, and API input.
- `rel="noopener"` on `target="_blank"`.

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "The brief calls for a hero trio." | A brief is a constraint, not a reason to skip craft; name it as a known delta. |
| "It's just a landing page." | Still verified for responsive layout and accessibility at every breakpoint. |
| "Tokens later." | Tokens come before markup, or the layout gets rebuilt. |

## Red flags

- "Optimize when it's slow": measure first.
- "It's client-side, so no security review": the client is public.
- New screen, new bespoke components instead of primitives.
- Global store for everything.
- An interactive element missing `data-testid`.
