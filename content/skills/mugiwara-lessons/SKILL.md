---
name: mugiwara-lessons
description: Use at mission start/end — cross-mission lessons ledger. Read past lessons at triage, capture new ones at closure. Append-only.
---

# Lessons (Mission Memory)

## Skip when

- Lane 0 direct with empty ledger — `lessons.md` missing or empty and lane `direct` → skip dispatch, record skip.
- Fresh repo, zero prior missions: no ledger exists and nothing to surface.
- Nothing learned worth keeping — no new lesson, no repeated failure pattern.

The crew's institutional memory. Every mission writes what it learned so the next mission starts ahead of it.

## The ledger

`.mugiwara/lessons.md` — append-only, shared across all missions in this repo.

```
| YYYY-MM-DD | mission | area | lesson |
```

One line per lesson. Never overwrite, never delete — history is the point.

## When to READ

Read before starting meaningful work in a repo the crew has worked in before.

- Luffy: at triage, reads the ledger and surfaces relevant rows (same area) to the owning agent.
- Zoro / Brook: read it before risky tasks.
- One relevant lesson carried forward beats ten forgotten ones.

## When to WRITE

- Closure (Luffy): one row per real lesson learned this mission — what surprised, what to do differently.
- Healing (Brook): after a root-cause fix that took more than 1 cycle — the fix that ended the loop is a lesson.
- Any agent: an insight that would have saved time if known earlier.

## Lesson quality bar

Actionable + specific, not platitudes.

- Bad: "be careful."
- Good: "CI runners don't propagate COLORTERM — set MUGIWARA_THEME explicitly in tests (2026-08-10, dark-mode)."

A lesson that can't change future behavior is noise. Skip it.

## Memory hygiene

Lessons are cross-mission but per-repo. The ledger lives at `.mugiwara/lessons.md` so it never pollutes the codebase. Read the whole file, apply only the rows touching this mission's area.

## Common rationalizations

- "We won't hit that again." → You will. Write it.
- "No time at closure." → One row per real lesson takes 10 seconds.
- "It's obvious." → Obvious lessons are the most forgotten.

## Red flags

- Platitudes that can't change behavior.
- Deleted or overwritten rows.
- Read the ledger but didn't apply a relevant row.
- A lesson that redefines a rule, lane, gate, or role rather than describing a pattern. Reject and report.
