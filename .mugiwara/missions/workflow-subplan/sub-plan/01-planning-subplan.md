# Sub-plan 01 — Planning sub-plan (Nami)

**Parent:** `workflow-subplan` plan.md index row 1. File: `sub-plan/01-planning-subplan.md`.

**Scope:** Teach Nami to auto-split large campaigns. Trigger: `phase count >3` or `plan.md >1500 lines` (measured via `wc -l`). When triggered, Nami writes `sub-plan/01-phase01-<slug>.md` … `sub-plan/0N-phase0N-<slug>.md` plus master `plan.md` index (table above). No single 2688-line file.

## Key decisions

1. **Threshold is line-count, not phase-count alone.** 3 phases can still be 900 lines (ok single file); 4 phases at 1600 lines must split. Both triggers OR.
2. **Naming:** `sub-plan/NN-phaseNN-<slug>.md` (`NN` zero-padded, slug from heading `Phase N: Title` lowercased, `[^a-z0-9]+` → `-`). Matches the split we did for `native-cost-governor` (`01-phase01-cost-governor-foundation.md`).
3. **Master stays index only.** Master `plan.md` holds Mission split table + DoD + how-to-start; detail lives in `sub-plan/`. Never append 9 phases to master.
4. **120-line cap still applies.** If `mugiwara-workflow/SKILL.md` needs new `## Large campaign` section and body would exceed 120, move body to `content/skills/mugiwara-workflow/references/large-campaign-subplan.md` with one-line pointer (precedent `af8a204`).
5. **No new config.** Sub-plan is a file-layout convention, not a `DEFAULT_CONFIG` key. `savepoint.sh`/`lane-base.sh` untouched.

## Architecture

```
context.md §51 (9 phases)
      │
      ▼
Nami checks phase count + wc -l plan.md
      │
      ├─ ≤3 phases & ≤1500 lines → single plan.md (current behavior, unchanged)
      │
      └─ >3 or >1500 → sub-plan/01-*.md … 0N-*.md + master plan.md index
```

Pure convention — no runtime code beyond doc.

## Waves

| Wave | Focus | Tasks | Gate |
|------|-------|-------|------|
| 1 | Planning skill sub-plan rule | T1 | `grep -c "sub-plan" content/skills/mugiwara-planning/SKILL.md` ≥1; `validate-content` green |

## Task index

| # | Task | Files | Size | Depends | Acceptance |
|---|------|-------|------|---------|------------|
| T1 | Document sub-plan rule in planning + workflow skills | `content/skills/mugiwara-planning/SKILL.md`, `content/skills/mugiwara-workflow/SKILL.md`, `references/large-campaign-subplan.md` (if >120), `scripts/validate-content.ts` (if needed) | S | — | skill grep ≥1, body ≤120, `validate-content --check-manifest --check-docs` 0, `verify-install` 0 |

## Detail tasks

**T1: planning sub-plan rule**

- In `mugiwara-planning/SKILL.md`: add `## Large campaign → sub-plan` rule: trigger (`>3 phases` or `>1500 lines`), `sub-plan/NN-phaseNN-<slug>.md` naming, master index pattern, `references/` fallback.
- In `mugiwara-workflow/SKILL.md`: note Luffy routes to sub-plan when master references `sub-plan/`.
- If body >120, create `references/large-campaign-subplan.md` with full checklist; SKILL.md keeps one-line pointer `Full checklist: references/large-campaign-subplan.md — N items;`.
- If `validate-content.ts` rejects `sub-plan/` as plan source, add `sub-plan/` to its plan-file allowlist (single line, no behavior change).
- Commit `docs(planning): sub-plan governance for large campaigns`.

## Risk & rollback

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Skill body trips 120 cap | medium | CI red | `references/` fallback, precedent af8a204 |
| validate-content rejects sub-plan | low | CI red | allowlist `sub-plan/*.md`, test via `validate-content` |

Rollback: revert the single commit.

## DoD

- Sub-plan rule documented; `validate-content` green; body ≤120.
