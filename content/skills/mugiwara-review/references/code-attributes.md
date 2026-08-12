# Code Attribute Deep Review

Sanji produces metrics (quantitative), Robin interprets context (qualitative).
Sanji's quality report is input to this review.

## Consistency

Are naming conventions adhered to throughout the diff and neighboring files?
Does formatting follow repo style beyond what the linter catches?
Are patterns from adjacent files respected, or does this diff introduce a new
idiom that conflicts with existing ones?

- [ ] Naming matches repo conventions (casing, prefix, suffix, verb-noun)
- [ ] Formatting consistent with surrounding code (spacing, indentation, line breaks)
- [ ] Patterns from neighboring files used where applicable
- [ ] No new conflicting idioms introduced

## Intentionality

Is the code's purpose clear without external documentation?
Are there logic errors the linter wouldn't catch?
Are constructs complete, or do they leave gaps (missing error branches, unhandled states, partial implementations)?

- [ ] Purpose clear from code alone (function names, types, control flow)
- [ ] Every branch has a clear reason; no dead or unreachable paths
- [ ] Error states are handled, not silently swallowed
- [ ] Constructs are complete — no partial implementations or TODOs masquerading as done

## Adaptability

Is the code modular?
Will future changes localize to one area or ripple through many files?
Is coupling appropriate for the domain?

- [ ] Single responsibility per module/function (one reason to change)
- [ ] Dependencies flow one direction (no circular imports or bidirectional coupling)
- [ ] Interface boundaries stable — changing internals won't break callers
- [ ] Coupling matches domain reality (tight coupling where data invariants demand it, loose elsewhere)
