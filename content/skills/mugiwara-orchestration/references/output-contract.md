# Output contract — one flow stage at both verbosity levels

Purpose: show the exact shape a flow stage takes at `verbosity=normal` (default)
and `verbosity=full`. Match the shape for the level in effect. Reference:
`mugiwara-orchestration` → Output discipline.

## What never changes

Whatever the level, these are always visible — they are the audit surface:

- wave banner (the owning agent's color)
- file edits: path + one-line summary
- gate verdicts + evidence path
- decisions, questions, blockers, lane rises, escalations
- the handoff line to the next flow stage

## The collapse table

| Before | After |
|---|---|
| 200 lines of test output | `✓ tests 84/84 → results/m/03-quality.md` |
| Read/grep/probe tool calls + file contents | *(not echoed at `normal` — a file is named only when it matters)* |
| Step-by-step reasoning | the conclusion |
| Per-task bookkeeping | one summary line per flow stage |
| Raw diff | `+42/-8` + one-line summary |

---

## `normal` — default

```
## ⚔️ Flow 3 — Zoro (Execution)
✎ src/auth/invitation.ts   +42/-8   token validation + redirect guard
✎ src/routes/index.ts      +6/-0    route registration
✓ tests 84/84 · lint 0     → results/m/03-quality.md
→ 🩺 Flow 4 — Chopper (Checkpoint)
```

Commands ran and passed; output collapsed to one line per gate with the
evidence path. Investigation steps (reads, greps, probes), file contents, and
narration are not echoed — only edits, results, decisions, and questions
appear. Reasoning reduced to conclusions.

## `full` — everything

```
## `Flow 3 — Zoro (Execution)`
$ mugiwara run lane.sh m
lane: full (44 files, 5 sensitive)
$ readFileSync src/auth/invitation.ts
  export function signInvitation(...) {
    // 42 lines...
$ bun run lint
  0 errors
$ bun test test/unit
  84 pass, 0 fail, 1.2s
  ✓ token validation … (12ms)
  ✓ redirect guard … (8ms)
✎ src/auth/invitation.ts   +42/-8   token validation + redirect guard
✎ src/routes/index.ts      +6/-0    route registration
✓ quality pass → results/m/03-quality.md
→ Flow 4 — Chopper (Checkpoint)
```

Every command, every read, every reasoning step — the raw transcript. Use it
when debugging the crew itself or auditing exactly how a result was reached.

---

## The safety rule

> The transcript must stay sufficient to review the mission **without opening a
> file.** If collapsing a line breaks that, do not collapse it.

Test output may collapse — the evidence file holds it. A decision may not — it
has no other home. The safety rule applies at `full` too: verbosity widens
what is echoed, it never narrows what the review needs.

---

## Handoff block (guided/semi)

At a guided/semi flow boundary, render four labeled blocks before the summary
line and final arrow. Conversation labels may be localized, but command
literals stay exact. A bare `→ Flow N` or an unexplained next-flow label is a
defect.

```
## ⚔️ Flow 2 — Nami (Planning)
**Result** — Plan ready for `<mission>`: goal is actionable flow-boundary
handoffs and truthful state recovery; 2 tasks/2 waves; evidence:
`.mugiwara/missions/<mission>/plan.md`; gate/risk: the GO decision and Flow 2
bootstrap recovery.
**Next** — Luffy owns the GO gate; after GO, Zoro starts T1: strengthen the
handoff contract and add its static/behavioral regressions. Safe parallelism:
none — T2 depends on T1, so run it after T1 completes.
**Choices**
- `GO execution` — dispatch Wave 1, then continue to T2.
- `review <path>` — inspect the named artifact; no dispatch until the review.
- `revise <section>` — return to Nami, amend the plan, and repeat Flow 2.
- `pause` — save the Flow 2 checkpoint; leave the tree clean and stop.
**New session** — Run `/mugiwara continue <mission>`; it resumes the Flow 2
checkpoint with the plan saved and the GO decision pending.
✓ Flow 2 — Nami · plan 2 tasks/2 waves → .mugiwara/missions/<mission>/plan.md
→ Flow 0 — Luffy (GO decision)
```

In Semi, the choices are the planning GO gate. In Auto, keep the same result,
next action, and resume facts but state that routine continuation is automatic;
do not ask for a redundant GO. The summary line and the
`→ Flow N — Crew (Role)` text keep their exact shapes — the blocks wrap them
without replacing them.
