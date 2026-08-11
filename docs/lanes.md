# Lanes & Sizing

The crew sizes a mission before it runs. At Wave 0, Luffy sizes the request
and picks a lane. The lane decides how many waves run — so a one-file typo does
not pay for the full nine-wave pipeline.

## The lanes

| Lane | Picks when | Waves | Budget |
|------|-----------|-------|--------|
| **0 · Direct** | typo, rename, 1 file <20 LOC | none | ~0 |
| **1 · Lean** | bug in 1-2 files, <50 LOC | execute → quality | ~4k |
| **2 · Standard** | feature, 3-8 files | plan → execute → checkpoint → review | ~10k |
| **3 · Full** | architecture, migration, auth/payment, API | 9 waves | ~20k |
| **4 · Spike** | exploratory, needs direction | brainstorm → re-triage | ~3k |

Budget is a guidance, not a meter: at ~1.5× estimated tokens warn, at 3× stop,
write the state to `.mugiwara/` and report how to continue — never silently
run on.

## How Luffy sizes

Size from the diff:

- 1 file <20 LOC → Lane 0 (Direct).
- 1-2 files → Lane 1 (Lean).
- 3-8 files → Lane 2 (Standard).
- 9+ files, or the diff touches `auth/`, `payment/`, `migrations/`, or
  `security/` → Lane 3 (Full).
- Exploratory, needs direction → Lane 4 (Spike).

## Escalation

The lane **escalates when the work outgrows the estimate** — the diff grew, a
sensitive path got touched mid-mission, or failures repeat. Escalation is
automatic; a lane **never auto-drops**. Under-process is more expensive than
over-process.

The lane is decided by Luffy at triage, per mission — it is not stored in
`.mugiwara/config`.
