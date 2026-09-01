# Flow 3 — Execution (Zoro) — Wave 3 T5-T6

**Mission:** seamless-governors · **Branch:** feat/seamless-governors · **Mode:** auto · **Lane:** full
**Actor:** AI: muse-spark-1.2-contributor-free · **Commit style:** conventional · **auto_commit:** on (auto mode always)

## Task table

| # | Task | Status | Evidence link |
|---|------|--------|---------------|
| T5 | Wire slop to all crews — repeated_reads/heal_cycle checks | ✅ | [content/skills/mugiwara-workflow/SKILL.md](../../../content/skills/mugiwara-workflow/SKILL.md) · [content/skills/mugiwara-execution/SKILL.md](../../../content/skills/mugiwara-execution/SKILL.md) · [content/skills/mugiwara-execution/references/dispatch.md](../../../content/skills/mugiwara-execution/references/dispatch.md) · [content/skills/mugiwara-orchestration/SKILL.md](../../../content/skills/mugiwara-orchestration/SKILL.md) · [scripts/savepoint.sh](../../../scripts/savepoint.sh) |
| T6 | Enforce savepoint each handoff + checkbox | ✅ | [content/skills/mugiwara-workflow/SKILL.md](../../../content/skills/mugiwara-workflow/SKILL.md) · [content/skills/mugiwara-orchestration/SKILL.md](../../../content/skills/mugiwara-orchestration/SKILL.md) · [.mugiwara/missions/seamless-governors/state.json](../state.json) · [.mugiwara/missions/seamless-governors/continue.json](../continue.json) |

## Evidence detail

### T5 — Wire slop to all crews — repeated_reads/heal_cycle checks

- **Workflow** `content/skills/mugiwara-workflow/SKILL.md` — added **Slop guard (all crews Luffy/Nami/Zoro/Brook)** in Execution model: before dispatch read `state.json` `heal_cycle`/`heal_halt` + `context-registry.jsonl` `repeated_reads` — `repeated_reads>threshold` skip/compress, `heal_cycle≥3` halt/escalate — trail `slop-governor` — Full checklist: `_shared/references/cost-governor.md` §§21-24,20,31-32. Banners Close=`mugiwara savepoint <mission> --flow N` before handoff, state flow+tasks sync. Session handoff Each handoff runs savepoint. Body 113/120.
- **Execution** `content/skills/mugiwara-execution/SKILL.md` — Worker dispatch triggers #2 Context pressure extended with **Slop guard (all crews Luffy/Nami/Zoro/Brook)**: before dispatch read `heal_cycle`/`heal_halt` + `repeated_reads` — `heal_cycle≥max` halt/escalate, `repeated_reads≥thr` skip/compress — trail `slop-governor` — `_shared/references/cost-governor.md` §§21-24,20,31-32. Body 119/120.
- **Execution refs** `content/skills/mugiwara-execution/references/dispatch.md` — Task batching appended slop guard same pointer (§§21-24,20).
- **Orchestration** `content/skills/mugiwara-orchestration/SKILL.md` — Periodic check-ins Handoff contract=`mugiwara savepoint <mission> --flow N` at every boundary — flow+tasks (`- [x]`/`- [ ]` + `sub-plan/` fallback) sync with `continue.json`, no `0/0`. Heal halt line extended with slop guard (all crews) + cost-governor §§21-24,20,31-32. Flow transitions Close=`mugiwara savepoint <mission> --flow N` before handoff. Body 119/120.
- **Savepoint** `scripts/savepoint.sh` — added `REPEATED_READS` compute from `context-registry.jsonl` (sum reads-1, reads≥2) threshold 3 per cost-governor §22,31 — persisted as `repeated_reads` in `state.json` alongside `heal_cycle`/`heal_halt` (§21.7/32). Comment: repeated_reads>thr → context slop skip/compress, heal_cycle≥max → halt/escalate (§§20,21-24). Sources `_shared/references/cost-governor.md` slop sections.
- Must point to `references/cost-governor.md` slop sections: grep shows 4 files point — `workflow` `execution` `dispatch` `orchestration` + `savepoint.sh` all contain `cost-governor.md` + `§§21` markers.
- Slop detectors already in `src/slop.ts` + `scripts/benchmark-governor.ts` 12 scenarios: `repeated_reads 3≥3 → context slop → stop`, `heal_cycle 3≥3 → healing slop → halt` — verified via harness `bun scripts/benchmark-governor.ts` Stop-Slop 12/12 green, `computeLiveSlop({heal_cycle:1, repeated_reads:3}) → interventions 1 (all:context)` and `heal_cycle:3 → Brook:healing`.
- Trail row `slop_interventions` >0 when triggered: `buildCostLedger` with `liveSlop.interventions` via `mugiwara cost --ledger` would show `Slop: 1 intervention(s) — all:1` or `Brook:1` when repeated_reads/heal_cycle exceed threshold; on clean mission `0` (no slop) — correct.

### T6 — Enforce savepoint each handoff + checkbox

- **Workflow** Banners Close = `mugiwara savepoint <mission> --flow N` before handoff — `state.json` flow+tasks (`- [x]`/`- [ ]` + `sub-plan/` fallback) sync with `continue.json`, no `0/0` — slop §§21-24. Session handoff Each handoff runs `mugiwara savepoint <mission> --flow N`.
- **Orchestration** Handoff contract `mugiwara savepoint <mission> --flow N` at every boundary — flow+tasks sync, no `0/0` (rule #6). Flow transitions Close = `mugiwara savepoint <mission> --flow N` before handoff.
- **Savepoint** `scripts/savepoint.sh` already counts `plan.md` `- [x]`/`- [ ]` (total `grep -cE '^\s*-\s*\[[ xX]\]'` / done `grep -c '\[x\]'`) + `sub-plan/` fallback when `TASKS_TOTAL==0` — prevents `0/0` on `audit-hardening` 18/18 or this mission 9/9. Both `state.json` and `continue.json` written from same `WAVE_INT`/`TASKS_DONE`/`TASKS_TOTAL` — sync guarantee. Evidence: `state.json` flow 3 == `continue.json` flow 3, tasks 7/9 (plan.md -[x] 7/9) after T5-T6, no `0/0`.
- Validation:
  - `bun run build` — Bundled 34 modules exit 0
  - `bun run typecheck` — exit 0
  - `bun scripts/validate-content.ts --check-manifest --check-docs --check-doc-integrity` — manifest sync, index 4741/5500, docs sync, content valid 21/14 exit 0
  - `bun scripts/verify-install.ts` — 290 pointers 0 broken 0 orphans exit 0
  - `grep -R -i "caveman|ponytail" content/ references/ scripts/savepoint.sh` — 0 hits clean
  - `grep -c "_shared/references/cost-governor.md" content/skills/mugiwara-workflow/SKILL.md content/skills/mugiwara-execution/SKILL.md content/skills/mugiwara-orchestration/SKILL.md` — 4 hits (slop sections §§21-24 present)
  - `grep -c "mugiwara savepoint" content/skills/mugiwara-workflow/SKILL.md content/skills/mugiwara-orchestration/SKILL.md` — 4 hits (each handoff + banner close)
  - `bun scripts/benchmark-governor.ts` — workloads 4 pass, slop 12 pass, stress large/long/runaway green, regressions none — exit 0

## Deviations

None. Minimal diff per plan file list: T5 5 files (workflow, execution SKILL, dispatch.md, orchestration, savepoint.sh) + T6 2 files overlapping (workflow, orchestration). Bodies kept ≤120 via inline extension, not new sections. No branding, no new deps, savepoint wire best-effort never blocks.

## Next

→ Wave 4 T7-T8 crew strengthening + verify seamless per plan.md.

→ Flow 4 — Chopper (Checkpoint)
