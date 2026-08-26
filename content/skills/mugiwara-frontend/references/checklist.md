# WCAG 2.1 AA Frontend Checklist

Run before calling a view done. Every box must check; unchecked boxes are not done.

## Perceivable

- [ ] Text contrast 4.5:1; large text (18pt/24px or 14pt/18.66px bold) and UI components/graphics 3:1.
- [ ] No pure-black-on-pure-white text-heavy surfaces; text over images has a scrim or offset.
- [ ] `alt` on every image (empty `alt=""` when decorative; never `alt="image"`).
- [ ] No information conveyed by color alone; add icon/text/pattern.
- [ ] Captions/alternatives for media; no autoplaying audio without controls.

## Operable

- [ ] Full keyboard operation: every interactive element reachable and operable with Tab/Enter/Space/arrows.
- [ ] Visible focus indicator at every focus point (never `outline: none`).
- [ ] Logical tab order matching visual order; skip-link to main content on repeated navigation.
- [ ] No focus trap without an escape (Esc or a focusable close); focus returns after modals close.
- [ ] Touch targets at least 44x44px; target spacing where 44px is not possible.
- [ ] No flashing more than 3 times/second.

## Understandable

- [ ] Page has a `<title>` and a language attribute.
- [ ] Single `h1`; heading levels do not skip (h1→h3 without h2 is a defect).
- [ ] Every input has a programmatic label; placeholder alone is not a label.
- [ ] Form errors and success announced (via `aria-live`/`role="alert"`); help text via `aria-describedby`.
- [ ] Validation never color-only; `aria-invalid` marks errors.
- [ ] Navigation/meaning is not tied to hover-only or transient state.

## Robust

- [ ] Native HTML elements first; ARIA only where native semantics cannot express the widget.
- [ ] Honest roles; no `role="button"` on a link, no empty labels on interactive elements.
- [ ] Dynamic updates announced via `aria-live` with appropriate `polite`/`assertive`.
- [ ] `prefers-reduced-motion` respected; motion scales, never disables content.
- [ ] No interaction reachable only by mouse; nothing requires drag to operate.

## Testability

- [ ] Stable `data-testid` on every interactive element and on each async state (loading/error/empty).
- [ ] Tests query by role/label, never by CSS class or mutable text.
- [ ] Keyboard paths asserted in tests for non-trivial interactions (menu, modal, form submit).

## Performance (Core Web Vitals)

- [ ] Every image has width/height or aspect-ratio — no layout shift on load.
- [ ] LCP asset preloaded; fonts use `font-display: swap`; nothing above the fold lazy-loaded.
- [ ] Below-fold media and routes lazy-loaded; no whole icon/font library imported for a few glyphs.
- [ ] Input handlers free of long tasks; heavy work deferred or chunked (INP).
- [ ] Lighthouse/lighthouse-ci run when the repo has it: performance and accessibility at/above budget, deltas listed.
