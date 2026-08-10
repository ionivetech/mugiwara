---
name: mugiwara-frontend
description: Use for any frontend implementation or redesign task - converting Figma/images to code or restyling UI. Match the repo's existing standard first, audit-first for redesigns, design-system extraction before markup, taste and a11y baked in, bans generic AI-slop patterns and rationalizations. Framework-agnostic.
---

# Frontend (Anti-Slop)

Interfaces built under this skill must not look templated.

## Existing repo standard first

When the repo already has frontend, learn and follow ITS standard before writing anything new; match its components and patterns before creating anything. Greenfield with no existing UI: skip to the design-system extraction below.

- Component library (MUI/Tailwind/shadcn/etc) — a new button must look like the repo's buttons, not the internet's.
- File conventions, naming, folder structure, CSS strategy.
- Lint, format, and test scripts; run them, match their style.
- Design tokens already in the theme/config: palette, type, spacing, radii, shadows.
- Existing page patterns: how pages compose sections, layout, and state.

## Redesigns: audit first

Before changing existing UI: capture current layout, spacing scale, type scale, palette, and component inventory. Fix real problems; do not restyle what works.

## Design-system extraction (before markup)

Read tokens from the stack's design system BEFORE writing markup — CSS variables, Tailwind config, theme file, or the reference's specs. Extract: spacing scale, type scale (sizes/weights/line-heights), palette with roles, radii, shadows, motion language. Name tokens semantically (not `c3`, `font-large` — `surface-muted`, `display-weight`); store them where the stack keeps design tokens. No tokens extracted, no markup written.

## From Figma / image references

1. Extract tokens FIRST (see above), then reproduce structure faithfully: hierarchy, alignment, whitespace ratios. Do not "improve" the layout unasked.
2. New one-off components still follow the design system — a one-off is not a license to invent a second system.

## Taste: positive design judgment

Beyond banning slop, build with intent:

- Hierarchy and rhythm: one primary action per view, one clear focal point, consistent spacing rhythm.
- Restraint: fewer, more considered elements; whitespace is a tool.
- Typography discipline: 1-2 typefaces, deliberate scale, weight for emphasis not decoration, line length 45-75ch.
- Color discipline: palette with roles (surface/text/action/state), contrast AA minimum, never pure-black-on-pure-white for text-heavy surfaces.
- Consistency: the same thing looks the same everywhere; no three ways to render a button.
- Intentionality: every element earns its place; if you cannot say why it is there, remove it.
- State design: hover, focus, active, disabled, loading, error, and empty states designed, not forgotten.

## Banned AI-default patterns (the slop list)

- Centered hero trio: headline + subtitle + two buttons, dead center, gradient text.
- Row of 3-4 identical feature cards with icon-circle + title + two lines.
- Purple/indigo gradient everything; glassmorphism everywhere; emoji as icons.
- Placeholder content where real product copy exists.
- Stock hero illustrations when the design specifies otherwise.

If the brief genuinely calls for one of these, execute it well — but the default is: don't.

## Craft bar

- Typography: deliberate scale, weight contrast, line-length control.
- Spacing: consistent scale, breathing room, aligned grids.
- Motion: subtle and purposeful (hover/scroll states), respects `prefers-reduced-motion`.
- Responsive: every layout verified at mobile/tablet/desktop breakpoints.
- A11y baseline: semantic landmarks, contrast AA, visible focus states, alt text.

## Accessibility (non-negotiable)

- Semantic landmarks (header/nav/main/footer), a single h1, logical heading order.
- Contrast AA: 4.5:1 text, 3:1 large text/UI.
- Focus: visible focus ring, logical tab order, skip-link, no focus trap without an escape.
- Keyboard: every interaction operable without a mouse; nothing reachable only via hover.
- Forms: every input labeled (placeholder is not a label); errors and success announced; `aria-describedby` for help text; validation never color-only.
- ARIA: native elements before ARIA; `aria-live` for dynamic updates; roles honest.
- Images: alt text (empty `alt=""` for decorative), never `alt="image"`.
- `prefers-reduced-motion` respected.
- Touch targets at least 44px.

## Testability

Add stable `data-testid` attributes to interactive elements, following the repo's testing convention (getByRole/getByTestId). Never test by CSS class or by text that changes.

## Performance

- No layout thrash: batch DOM reads and writes.
- No jank: keep heavy work off the scroll path; animate only transform/opacity.
- Assets: no giant images or font payloads; lazy-load below the fold; no whole icon library for two icons.
- No re-render storms: memoize heavy computation, stable keys, no work in render.
- Measure before optimizing; do not guess the bottleneck.

## Frontend security

- Never render user content via `dangerouslySetInnerHTML`/`v-html` unless sanitized.
- Escape user input in every template; no injection through the client.
- No secrets in client code — API keys and tokens in the client are public.
- Validate/sanitize anything from URL params, storage, or APIs before use.
- `rel="noopener"` on `target="_blank"` links; validate URLs before navigating.

## Verify

Compare the result against the reference side by side; list remaining deltas before calling it done. Not done while deltas are unlisted or unresolved.

## Red flags

- "I'll match the repo later" — the repo standard is the first step, not a cleanup.
- "It's accessible enough" — a11y is a checklist; unchecked boxes are not done.
- "Tests can find it" — no data-testid means the UI is not testable.
- "Optimize when it's slow" — perf regressions ship measured later, rarely.
- "It's client-side, so no security review" — the client is public by definition.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "The brief calls for a hero trio." | A brief calling for slop is a constraint, not a license — the default stays don't; execute well only if the design truly demands it. |
| "It's just a landing page." | Still verified for responsive and a11y — a small page is not exempt. |
| "It's a one-off component." | A one-off still follows the design system's tokens and patterns. |
| "Good enough." | Not done until compared against the reference with remaining deltas listed. |
| "It looks right." | Verified at every breakpoint or it is not verified. |
| "Everyone ships this card row." | Popularity is not design; if it's on the slop list, it stays banned. |
| "Tokens later." | Tokens extracted before markup, or the layout gets rebuilt. |
| "Our repo is messy, I'll use my own style." | You match the repo standard first, then you may propose raising it. |
| "It's accessible enough." | The a11y checklist is all-or-nothing; unchecked boxes are not done. |
| "The user won't use a keyboard." | Every interaction must be keyboard-operable; "users won't" is not a design decision. |

If the rationalization wins, name it in the report as a known delta — not as silence.
