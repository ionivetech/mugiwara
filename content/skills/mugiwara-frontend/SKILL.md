---
name: mugiwara-frontend
description: Use for any frontend implementation or redesign task - converting Figma/images to code or restyling UI. Match the repo's existing standard first, audit-first for redesigns, design-system extraction before markup, component architecture, state management, responsive behavior, and WCAG 2.1 AA baked in; bans generic AI-slop patterns and rationalizations. Framework-agnostic.
---

# Frontend (Anti-Slop)

## Skip when

- Diff touches no UI code: backend, docs, config, or CLI-only change.
- No visual change, markup, styling, or frontend behavior in the mission.

Interfaces built under this skill must not look templated.

## Existing repo standard first

Match the repo's standard before writing anything new; reuse its components and patterns. Greenfield with no UI: skip to design-system extraction.
- Component library (MUI/Tailwind/shadcn/etc) — a new button looks like the repo's buttons, not the internet's.
- File conventions, naming, folder structure, CSS strategy; lint/format/test scripts.
- Tokens already in the theme/config; existing page patterns — how pages compose sections and state.

## Redesigns: audit first

Capture current layout, spacing/type scales, palette, and component inventory before changing existing UI. Fix real problems; do not restyle what works.

## Design-system extraction (before markup)

Extract tokens from the stack's design system BEFORE markup — spacing scale, type scale, role-based palette, radii, shadows, motion language. Name them semantically (`surface-muted`, not `c3`); store where the stack keeps tokens. No tokens extracted, no markup written. Then turn tokens into a small primitive set (button, input, card, icon, layout helpers) before composing screens — reuse primitives everywhere; every bespoke component is debt on every screen.

## Component architecture

Compose, don't inherit. Small, single-purpose components; the tree mirrors the page, not a god-component.
- Boundaries: one component = one responsibility; extract on reuse; leaves stay presentational (no data fetching).
- Composition over configuration: children/slots beat dozens of props.
- Props: primitives and plain callbacks over object-shaped flags; 3+ boolean props = split the component.
- Naming by role (`ProductCard`, not `CardA`); variants over copy-paste.

## State management

Minimal state, local first; lift only what is shared.
- Server vs client state: never store a per-screen copy of API data; cache/refetch at a data layer; derive on render.
- Single source of truth per state, no duplicate mirrors; lift only when siblings share — context/store for app-wide state, not one screen.
- Loading, error, empty, success states designed, not an afterthought.

## From Figma / image references

Extract tokens first, then reproduce structure faithfully: hierarchy, alignment, whitespace ratios. Do not "improve" the layout unasked. A one-off is not a license for a second system.

## Taste: positive design judgment

- Hierarchy and rhythm: one primary action per view, one focal point, consistent spacing.
- Restraint: fewer, more considered elements; whitespace is a tool.
- Typography: 1-2 typefaces, deliberate scale, weight for emphasis not decoration, 45-75ch lines.
- Color: role-based palette, contrast AA minimum, never pure-black-on-pure-white for text-heavy surfaces.
- Consistency: the same thing looks the same everywhere; no three ways to render a button.
- Intentionality: every element earns its place; if you cannot say why, remove it.
- State design: hover, focus, active, disabled, loading, error, empty — designed, not forgotten.
- Craft: deliberate spacing grids; subtle motion respecting `prefers-reduced-motion`; verified at all breakpoints.

## Responsive behavior

Mobile-first: start at the smallest screen, add breakpoints as layout needs them. Default full-width stacked; columns only when there is room. Use the stack's breakpoints, not a parallel scale; fluid containers, type, and spacing. Verify at every breakpoint, including between them — 3 widths checked is not 12 checked.

## Banned AI-default patterns (the slop list)

- Centered hero trio: headline + subtitle + two buttons, dead center, gradient text.
- Row of 3-4 identical feature cards with icon-circle + title + two lines.
- Purple/indigo gradient everything; glassmorphism everywhere; emoji as icons.
- Placeholder content where real product copy exists.
- Stock hero illustrations when the design specifies otherwise.

If the brief genuinely calls for one of these, execute it well — but the default is: don't.

## WCAG 2.1 AA accessibility

Non-negotiable baseline. Full checklist: `references/checklist.md`.

- Keyboard: every interaction operable by keyboard alone; logical tab order; visible focus; no focus trap without escape.
- Semantics: native elements over ARIA; landmarks; logical heading order; buttons for actions, links for navigation.
- Contrast: 4.5:1 text, 3:1 large text/UI; never color-only meaning.
- Forms: every input labeled (placeholder is not a label); errors/success announced; `aria-describedby` help.
- Dynamic content: `aria-live` for changes; reduced-motion respected.

## Testability and verification

Add stable `data-testid` to interactive elements per the repo's testing convention. Never test by CSS class or by text that changes. Then compare the result against the reference side by side; list remaining deltas before calling it done.

## Performance

- No layout thrash: batch DOM reads/writes; heavy work off the scroll path; animate only transform/opacity.
- Assets: no giant images/font payloads; lazy-load below the fold; no whole icon library for two icons.
- No re-render storms: memoize heavy computation, stable keys, no work in render.
- Measure before optimizing; do not guess the bottleneck.

## Frontend security

- Never render user content via `dangerouslySetInnerHTML`/`v-html` unless sanitized.
- Escape user input in every template; no secrets in client code; validate URL params/storage/API input.
- `rel="noopener"` on `target="_blank"`; validate URLs before navigating.

## Red flags

- "I'll match the repo later" — the repo standard is the first step, not cleanup.
- "It's accessible enough" — the a11y checklist is all-or-nothing.
- "Tests can find it" — no data-testid means the UI is not testable.
- "Optimize when it's slow" — perf regressions ship measured later, rarely.
- "It's client-side, so no security review" — the client is public by definition.
- "New screen, new components" — primitives are the default; bespoke is the exception.
- "Global store for everything" — local state first; lift only what is shared.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "The brief calls for a hero trio." | A brief calling for slop is a constraint, not a license — the default stays don't. |
| "It's just a landing page." / "It's a one-off component." | Still verified for responsive and a11y; still follows the design system's tokens and patterns. |
| "Good enough." / "It looks right." | Not done until compared against the reference with deltas listed, at every breakpoint. |
| "Everyone ships this card row." | Popularity is not design; if it's on the slop list, it stays banned. |
| "Tokens later." | Tokens extracted before markup, or the layout gets rebuilt. |
| "Our repo is messy, I'll use my own style." | Match the repo standard first, then propose raising it. |
| "The user won't use a keyboard." / "Context for everything." | Every interaction keyboard-operable; server state belongs at a data layer, not a global store. |
| "It's a quick prop, no new component." | 3+ boolean props is the boundary — split the component. |

If the rationalization wins, name it in the report as a known delta — not as silence.
