---
name: mugiwara-frontend
description: Use for any frontend implementation or redesign task - converting Figma/images to code or restyling UI. Audit-first for redesigns, design-system extraction before markup, bans generic AI-slop patterns and rationalizations. Framework-agnostic.
---

# Frontend (Anti-Slop)

Interfaces built under this skill must not look templated.

## Redesigns: audit first

Before changing existing UI: capture current layout, spacing scale, type scale, palette, and component inventory. Fix real problems; do not restyle what works.

## Design-system extraction (before markup)

Read tokens from the stack's design system BEFORE writing markup — CSS variables, Tailwind config, theme file, or the reference's specs. Extract: spacing scale, type scale (sizes/weights/line-heights), palette with roles, radii, shadows, motion language. Name tokens semantically (not `c3`, `font-large` — `surface-muted`, `display-weight`); store them where the stack keeps design tokens. No tokens extracted, no markup written.

## From Figma / image references

1. Extract tokens FIRST (see above), then reproduce structure faithfully: hierarchy, alignment, whitespace ratios. Do not "improve" the layout unasked.
2. New one-off components still follow the design system — a one-off is not a license to invent a second system.

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

## Verify

Compare the result against the reference side by side; list remaining deltas before calling it done. Not done while deltas are unlisted or unresolved.

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

If the rationalization wins, name it in the report as a known delta — not as silence.
