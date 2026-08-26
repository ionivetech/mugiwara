# Lessons ledger

`.mugiwara/lessons.md` — one file, append-only, shared by every actor. It is
the crew's cross-mission memory: what broke before, and the one-line rule
that prevents a repeat.

## Lifecycle

| When | Who | What |
|------|-----|------|
| Triage (Flow 0) | Memory Keeper reads | Surfaces lessons relevant to the declared scope — past failures on the paths or stacks about to be touched |
| Closure (Flow 9) | Memory Keeper writes | One row per real lesson captured this mission |

A lesson earns its row by being: actionable (changes a future decision),
general (not specific to one line of code), and observed (it caused or almost
caused a failure this mission). "Should test more" is not a lesson.

## Format

```markdown
- 2026-08-26 · performance · ORM lazy-loading caused N+1 on invoice list — eager-load relations rendered in loops (mission invoice-list)
```

Date · category · the rule · origin mission. One line, no prose essays.

## Sharing between teams

Opt-in, anonymized exchange format and rules:
[adoption kit](../adoption.md#lessons-ledger-exchange).
