# workflow-subplan — Large Campaign Sub-Plan Governance

**Mission:** Add sub-plan governance to `mugiwara-workflow` so large campaigns (>3 phases or >1500-line plans) stay rapih from day 1 — the fix for `native-cost-governor` 9-phase mess (single 2688-line `plan.md` + flat `flows/` overwrite).

**Branch:** `feat/workflow-subplan` (from `main`; short-lived, delete after merge). `main` stays releasable — trunk-based per `AGENTS.md`.

**Mode:** `auto` (from `.mugiwara/config`), `auto_commit=on`, `Lane: Full` (touches `content/skills/mugiwara-workflow`, `content/skills/mugiwara-planning`, `content/skills/mugiwara-execution`, `src/cli.ts`/`src/mission.ts` if needed for `archive --merge`, docs, scripts).

## Mission split → sub-plan index

Large campaigns split into isolated phase slices. Master `plan.md` is the index; detail lives in `sub-plan/`.

| # | Sub-plan | File | Focus |
|---|----------|------|-------|
| 1 | Planning sub-plan | `sub-plan/01-planning-subplan.md` | Nami: auto-split when `phase count >3` or `plan.md >1500` lines → `sub-plan/01-phase01-*.md` … `sub-plan/0N-*.md` + master index; 120-line cap via `references/` |
| 2 | Execution isolation | `sub-plan/02-execution-isolation.md` | Zoro: `flows/phase-NN/` per phase (not flat `flows/02-execution.md` overwrite); per-phase audit/quality/gates |
| 3 | Archive merge | `sub-plan/03-archive-merge.md` | Luffy: `mugiwara archive --merge` folds `sub-plan/` + `flows/phase-*/` + `decisions.md` sections into single `report.md`; keep `plan.md` index + `report.md` only |

Detail per sub-plan → `sub-plan/*.md`. This file is the index only — never appended to 2000+ lines.

## How to start next branch

```bash
git checkout main && git pull
git checkout -b feat/workflow-subplan
# mission already seeded at .mugiwara/missions/workflow-subplan/
mugiwara continue workflow-subplan   # prints resume point (Flow 0 → Flow 2)
# or: mugiwara status                # verify Flow 1, 0/0 tasks
```

No `mugiwara start` needed — plan is pre-seeded. Nami extends `sub-plan/` if new phases appear; Zoro executes per `flows/phase-*/`.

## Definition of Done (mission)

- `content/skills/mugiwara-workflow/SKILL.md` + `content/skills/mugiwara-planning/SKILL.md` document sub-plan pattern (when to split, `sub-plan/` naming, `flows/phase-*/` isolation, `archive --merge` merge rule); `validate-content` + `verify-install` green, body ≤120 via `references/` if needed.
- `scripts/validate-content.ts` (if needed) accepts `sub-plan/` as valid plan source.
- `mugiwara archive` supports `--merge` (or equivalent) to fold `sub-plan/` + `flows/phase-*/` into `report.md` (or Luffy does it manually — minimal code, not a new runtime).
- Docs: `docs/concepts/cost.md` or `docs/concepts/workflow.md` notes large-campaign pattern.
- `bun run gate` green; `mugiwara continue workflow-subplan` lists this mission (Flow 1, 0/0 → next_action: Nami extend `sub-plan/01-*` if needed).
- `.mugiwara/missions/workflow-subplan/` stays rapih: `plan.md` (index) + `sub-plan/` (3 files) + `flows/` + `report.md` after final archive — no 2688-line single file.

## References

- Full per-phase detail → `sub-plan/01-planning-subplan.md`, `02-execution-isolation.md`, `03-archive-merge.md`
- Precedent: `native-cost-governor` (9 phases, `plan.md` 2688 lines, `flows/02-execution.md` overwritten, `decisions.md` 623 lines) — the mess this mission fixes.
- Archive example: `native-cost-governor/report.md` (4753 lines, 22 Archived sections) — the clean end-state this pattern produces from day 1.
