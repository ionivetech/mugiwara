# Design Tokens

Extract from the stack's design system before writing markup. No tokens extracted = no markup written.

## Token categories

| Category | Examples | Naming convention |
|----------|----------|-------------------|
| Spacing scale | 4, 8, 12, 16, 24, 32, 48, 64 | `space-xs` through `space-3xl` |
| Type scale | 12, 14, 16, 18, 24, 32, 48 | `text-sm` through `text-display` |
| Palette | surface, text, border, accent | `surface-muted`, `text-primary`, `border-default` — semantic, not color names |
| Radii | 2, 4, 8, 12, round | `radius-sm` through `radius-full` |
| Shadows | elevation levels | `shadow-sm` through `shadow-xl` |
| Motion | duration, easing | `duration-fast`, `ease-in-out` |

## Where to store

- Tailwind: `tailwind.config.ts` extend theme
- MUI: `createTheme()` 
- CSS: CSS custom properties on `:root`
- Wherever the repo already keeps tokens — don't invent a second system

## Naming rule

Semantic names, not visual: `surface-muted` not `gray-100`, `text-danger` not `red-500`. The name tells you what it IS, not what it LOOKS LIKE. This survives a palette change without renaming.
