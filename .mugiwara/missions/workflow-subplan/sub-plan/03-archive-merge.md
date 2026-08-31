# Sub-plan 03 — Archive merge (Luffy)

**Parent:** `workflow-subplan` plan.md index row 3. File: `sub-plan/03-archive-merge.md`.

**Scope:** Teach Luffy/`mugiwara archive` to merge phase-isolated artifacts into a single rapih `report.md` — the clean end-state `native-cost-governor/report.md` (4753 lines, 22 Archived) achieved from day 1.

## Key decisions

1. **Merge, not per-phase archive.** `mugiwara archive --merge` (or Luffy manual `cat flows/phase-*/02-execution.md >> report.md`) folds `sub-plan/*.md` + `flows/phase-*/` + `decisions.md` phase sections + `blockers.md` + `review.md`/`security.md` into one `report.md` seeded from `flows/06-closure.md` index. After merge, keep `plan.md` (index) + `report.md` + `pr-verdict.md`/`provenance.md`/`rollback.sh` only — same clean layout as `native-cost-governor` after `c174a33`.
2. **No new runtime unless needed.** If `src/mission.ts:archiveMission` needs to recognize `sub-plan/` or `flows/phase-*/`, add minimal allowlist (single `if exists sub-plan` branch). No `DEFAULT_CONFIG` change, no `savepoint.sh` change — measures, not enforces.
3. **Idempotent.** Running `archive --merge` twice does not duplicate Archived sections — second run is no-op (report exists, flows already removed).
4. **Per-phase savepoint still works.** `continue.json` per phase points to `sub-plan/0N-*.md` slice; `mugiwara continue workflow-subplan --phase 02` (or plain `mugiwara continue`) resolves to next `sub-plan/` slice. No new CLI flag required beyond `--merge` for final.

## Architecture

```
sub-plan/01-*.md … 09-*.md
flows/phase-01/ … phase-09/  (per-phase execution evidence)
decisions.md (Flow 0-9 sections per phase)
      │
      ▼
Luffy Flow 9: write flows/06-closure.md (index, 71 lines) → report.md seeded
      │
      ▼
mugiwara archive --merge
  folds sub-plan/*.md as ## Archived: sub-plan/01-*.md
  folds flows/phase-*/ as ## Archived: flows/phase-01/02-execution.md
  folds decisions.md/blockers.md/review.md/security.md as ## Archived
  removes flows/phase-*/ + sub-plan/ loose? No — keep sub-plan for history? Keep plan.md index + report.md; sub-plan stays or is folded — decide at impl: keep sub-plan for audit or fold and remove (native-cost-governor kept plan.md single file; sub-plan keeps sub-plan as archive source — either is rapih as long as flows/ is empty).
```

## Waves

| Wave | Focus | Tasks | Gate |
|------|-------|-------|------|
| 1 | Archive merge rule + CLI | T1 | `grep -c "archive.*merge\|sub-plan" content/skills/mugiwara-workflow/SKILL.md` ≥1; `bun run gate` 0 |

## Task index

| # | Task | Files | Size | Depends | Acceptance |
|---|------|-------|------|---------|------------|
| T1 | Document archive merge + extend archive if needed | `content/skills/mugiwara-workflow/SKILL.md`, `src/mission.ts` or `src/cli.ts` (only if `archive --merge` needs code), `scripts/validate-content.ts` (if sub-plan needs allowlist), `docs/concepts/workflow.md` (if exists) | S | sub-plan/01, 02 | skill grep ≥1, body ≤120, `mugiwara archive --help` mentions `--merge` when code added, `validate-content` 0, `bun run gate` 0 |

## Detail tasks

**T1: archive merge**

- In `mugiwara-workflow/SKILL.md`: add `## Large campaign → archive merge` rule: `report.md` seeded from `flows/06-closure.md`, then `archive --merge` folds `sub-plan/` + `flows/phase-*/` + trail into `## Archived:` sections, final layout `plan.md` + `report.md` + `pr-verdict.md` (same as `native-cost-governor` c174a33).
- If code needed: extend `src/cli.ts` `archive` command with `--merge` flag that iterates `sub-plan/*.md` and `flows/phase-*/` into report; else Luffy manual merge is sufficient (document as manual step).
- Commit `feat(workflow): archive merge for sub-plan large campaigns`.

## DoD

- Archive merge documented (and coded if --merge flag added); `validate-content` green; body ≤120; `bun run gate` green; `report.md` after merge is single 22-Archived-style clean file.
