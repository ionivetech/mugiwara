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

In `guided`/`semi` the handoff line is never alone — it closes a three-part
block so the user always knows what happened, who is next, and what to write:

1. **Result** — what this flow stage produced, one line + evidence path.
2. **Next** — who owns the next flow stage and what they will do.
3. **Continue phrase** — the exact words (or "nothing — continuing") that start
   the next stage. A bare handoff with no phrase is a defect, like a bare
   question with no options.

```
## Hasil Flow 2 — plan jadi
**Selanjutnya:** Luffy minta GO; tanpa GO Zoro tidak jalan.
**Tulis satu:** `GO execution` / `ubah <bagian>` / `stop`
✓ Flow 2 — Nami · plan 6 tasks/3 waves → .mugiwara/missions/<mission>/plan.md
→ Flow 0 — Luffy (GO decision)
```

The summary line and the `→ Flow N` text keep their exact shapes — the block
wraps them, never replaces them.
