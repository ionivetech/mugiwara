---
name: mugiwara-frontend
description: Use for any frontend implementation or redesign task - converting Figma/images to code or restyling UI. Audit-first for redesigns, extracts the design system from the reference, bans generic AI-slop patterns. Framework-agnostic.
---

# Frontend (Anti-Slop)

Interfaces built under this skill must not look templated.

## Redesigns: audit first

Before changing existing UI: capture current layout, spacing scale, type scale, palette, and component inventory. Fix real problems; do not restyle what works.

## From Figma / image references

1. Extract tokens BEFORE writing markup: spacing scale, type scale (sizes/weights/line-heights), palette with roles, radii, shadows, motion language.
2. Reproduce structure faithfully: hierarchy, alignment, whitespace ratios. Do not "improve" the layout unasked.
3. Name tokens semantically; store them where the stack keeps design tokens (CSS variables, Tailwind config, theme file).

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

Compare the result against the reference side by side; list remaining deltas before calling it done.

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "The brief calls for a hero trio." | A brief calling for slop is a constraint, not a license — the default stays don't; execute well only if the design truly demands it. |
| "Good enough." | Not done until compared against the reference with remaining deltas listed. |
| "It looks right." | Verified at every breakpoint or it is not verified. |
| "Everyone ships this card row." | Popularity is not design; if it's on the slop list, it stays banned. |
| "Tokens later." | Tokens extracted before markup, or the layout gets rebuilt. |
