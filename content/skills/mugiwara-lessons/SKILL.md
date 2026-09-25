---
name: mugiwara-lessons
description: Use at mission start/end — cross-mission lessons ledger. Read past lessons at triage, capture new ones at closure. Append-only.
---

# Lessons (Mission Memory)

**Language:** Conversational language may be any language, but all `.mugiwara/missions/<mission>/plan.md` artifacts (`plan.md`, `flows/*`, `report.md`, `spec.md`, `decisions.md`, `blockers.md`, `review.md`, `state.json` and `continue.json`) are always English, one language only. Chat responses follow the user's language.

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

## Dedup + expiry

Grep the ledger before appending — the same lesson twice is one lesson;
skip the duplicate (or cite the old row). Lessons naming a version carry
`re-verify after <version>`; a lesson proven stale gets a superseding row
pointing at the old one — append-only still holds, history shows the
correction instead of silent rot.

## Prune vehicle (bounded growth without losing history)

The ledger is append-only, but not unbounded. Pruning reuses the
supersede-row mechanism above — never delete, never rewrite:

- Soft cap: past ~200 rows, the oldest unreferenced rows become archive
  candidates. The cap is advisory; breaching it changes nothing by itself.
- Archive step: a human approves moving candidates to
  `.mugiwara/lessons-archive.md`, leaving one supersede row per moved
  lesson pointing at the archive. Sole writer stays `mugiwara lesson`
  (humans edit the archive file directly when approving).
- Auto-write stays hard-OFF: no agent appends or archives without a
  human-approved step. Enabling automatic writes is a separate decision,
  out of scope until this vehicle exists.

## When to READ

Read before starting meaningful work in a repo the crew has worked in before.

- Luffy: at triage, reads the ledger and surfaces relevant rows (same area) to the owning agent.
- Zoro / Brook: read it before risky tasks.
- One relevant lesson carried forward beats ten forgotten ones.

## When to WRITE

- Closure (Luffy): one row per real lesson learned this mission — what surprised, what to do differently.
- Healing (Brook): after a root-cause fix that took more than 1 cycle — the fix that ended the loop is a lesson.
- Any agent: an insight that would have saved time if known earlier.

Writer: `mugiwara lesson "<text>"` appends a dated row to `.mugiwara/lessons.md` (`| YYYY-MM-DD | <mission> | <area> | <text> |`). Use it — never rely on memory. Without CLI or npx, append the row by hand in the same shape (pipes inside text become `/`).

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
- A duplicate lesson appended without grepping first.
- Deleted or overwritten rows.
- Read the ledger but didn't apply a relevant row.
- A lesson that redefines a rule, lane, gate, or role rather than describing a pattern. Reject and report.

## Repo memory (stable facts)

Stable repo facts live in `.mugiwara/MEMORY.md` (edit-in-place, cap 40 non-empty lines); the versioned canonical schema is `_shared/references/memory-template.md`.

- Flow 0: single read of `.mugiwara/MEMORY.md`. Lazy-create it from the template on first closure write (same pattern as `mugiwara lesson` in `src/cli.ts`).
- Closure: Luffy reviews the MEMORY.md diff and updates only-if-changed; stable truths only.
- Lessons ledger stays selective: `grep <area> .mugiwara/lessons.md | tail -20`, never the full file past 50 rows; surface at most 3 rows to the owning agent.
- Split bar: temporal surprise goes to `.mugiwara/lessons.md`; stable truth goes to `.mugiwara/MEMORY.md`. One row never lives in both.
- Never store secrets in MEMORY.md: no tokens, keys, or credentials of any kind.
