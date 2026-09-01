# Plan — seamless-governors

**Mission:** `seamless-governors` · **Branch:** `feat/seamless-governors` · **Mode:** `auto` · **Lane:** `Full` (9+ files, 5 governors + crew)
**Source:** Audit 2026-08-31 — lane-aware, cost reduce, slop all-lines, crew strengthening, caveman/ponytail-inspired but no branding

## Context scan (what exists today)

- **Luffy triage** strong (8 classes) but `savepoint` not enforced each handoff → `0/0` stale (fixed in `fix/tier3-config-autocreate` with `readConfig` auto-create + `countPlanTasks` fallback, but not enforced in workflow)
- **Cost Governor** = `src/cost.ts` + `lane-base.sh` + `budgetForLane` + `cost-events.jsonl` — *record* only (ledger), not *reduce* (no auto-compress, no budget adapt)
- **Governors fragmented:** `cognitive-output-governor.md`, `scope-code-governor.md`, `stop-slop-governor.md`, `adaptive-budget-governor.md`, `benchmark-governor.md` — 5 files, solo bingung
- **Stop Slop** detect in `savepoint`/`reporting` only — not wired to Luffy/Nami/Zoro/Brook real path (`repeated_reads`, `heal_cycle` not checked before dispatch)
- **Gates** (`validate-content`, `conformance` 12 platforms, `benchmark`) run for all lanes — solo `direct` bayar 60s, enterprise `full` juga 60s (no lane-aware skip)
- **Crew:** Zoro parallel OK, but `scope-governor` not enforced (tambah dep sembarang), Brook 4-phase root-cause not in all heals, Memory Keeper dispatch even when `lessons.md` empty + Lane 0
- **Caveman/Ponytail** requested as *inspiration* for cost reduce — must be reimplemented as Mugiwara-native `terse + lazy` without branding, not installed
- **Reset** now clears `index.md` (fixed), but `lessons.md` still deleted without `--keep-logs` — solo loses memory

## Goal

Solo & enterprise sama-sama useful, semua fitur berguna, cost kecil, seamless. One `cost-governor` tunggal (terse+lazy, no caveman/ponytail mention) + lane-aware + slop all-lines + crew strengthened.

## Lane & Mode

- Lane `Full` for this mission (touches `content/skills/*`, `src/cli.ts`, `src/mission.ts`, `scripts/*`, `src/cost.ts`, `src/policy.ts`)
- Mode `auto` — Luffy auto-approves plan → Zoro straight to execution

## Task index

### Wave 0 — P0 Solo/Team gate (krusial, before plan)

| # | Task | Files | Acceptance |
|---|------|-------|------------|
| T0 | **P0 Solo/Team gate** — `mode guided/semi` → Luffy **wajib tanya** `solo atau tim?` sebelum Nami, `auto` → default solo dari `git config`. Affects `state.json` vs `<member>.json`, plan `parallel` vs `inline`, `Nami` member isolation | `content/skills/mugiwara-orchestration/SKILL.md`, `content/skills/mugiwara-workflow/SKILL.md`, `content/skills/mugiwara-planning/SKILL.md`, `src/continue.ts`, `src/mission.ts` | `guided/semi` tanpa jawaban → blocker, tidak lanjut ke Nami; `auto` → solo default tercatat di `decisions.md`; `tim` → `state: <member>.json` + `continue-<member>.json` per member |

### Wave 1 — Governor unification (terse+lazy, no branding)

| # | Task | Files | Acceptance |
|---|------|-------|------------|
| T1 | Merge 5 governors → 1 `references/cost-governor.md` (terse+lazy, no caveman/ponytail words, ladder: need?→reuse?→stdlib?→native?→installed dep?→one line?) | `references/cost-governor.md`, `content/skills/mugiwara-workflow/*`, `content/skills/mugiwara-orchestration/*` | 1 file, 5 old files removed or stubbed, `validate-content` body ≤120, no "caveman"/"ponytail" string |
| T2 | Wire `cost-governor` reduce (not just record) — `Zoro` pre-check: reuse helper? stdlib? native `<input type=date>` vs dep? one-line? | `content/skills/mugiwara-execution/SKILL.md`, `content/skills/mugiwara-execution/references/*` | `execution` skill references governor, `validate-content` passes |

### Wave 2 — Lane-aware gates & cost

| # | Task | Files | Acceptance |
|---|------|-------|------------|
| T3 | Lane-aware gates — `if lane direct` run `typecheck+build` only, `lean` +`validate-content`, `standard+` +`evals/retrieval/conformance/benchmark` | `scripts/gate-selftest.ts`, `src/policy.ts`, `content/skills/mugiwara-gates/SKILL.md` | `gate` on `direct` fixture 3 steps, `full` 12 steps, `conformance` 71→74 still pass |
| T4 | Cost auto-compress — when `context_chars > 80% budget`, compress `flows/` → `report.md` stub, not `throw` | `src/mission.ts`, `src/cost.ts`, `src/budget.ts` | `archive` with 90% budget compresses, not fails, `cost-events.jsonl` records `compressed` |

### Wave 3 — Slop all-lines

| # | Task | Files | Acceptance |
|---|------|-------|------------|
| T5 | Wire slop to all crews — Luffy/Nami/Zoro/Brook check `repeated_reads`/`heal_cycle` before dispatch → `compress`/`escalate` | `content/skills/mugiwara-workflow/SKILL.md`, `content/skills/mugiwara-execution/*`, `scripts/savepoint.sh` | `repeated_reads > threshold` → skip re-read, `heal_cycle>=3` → halt, trail row `slop_interventions` >0 |
| T6 | Enforce `savepoint` each handoff + `- [ ]` checkbox — Luffy banner closes with `savepoint <mission> --flow N` | `content/skills/mugiwara-orchestration/SKILL.md`, `content/skills/mugiwara-workflow/SKILL.md` | `state.json` `flow` sync with `continue.json`, no `0/0` on `audit-hardening` 18/18 |

### Wave 4 — Crew strengthening

| # | Task | Files | Acceptance |
|---|------|-------|------------|
| T7 | Strengthen Zoro (scope) + Brook (4-phase root-cause) + Memory Keeper (skip when `lessons.md` empty & Lane 0) | `content/agents/zoro-execution.md`, `content/agents/brook-healing.md`, `content/agents/memory-keeper.md`, `content/skills/mugiwara-healing/*`, `content/skills/mugiwara-lessons/*` | Zoro rejects new dep when stdlib covers, Brook `reproduce→localize→reduce→guard` in every heal, Memory Keeper not dispatched for `direct` + no ledger |
| T8 | Verify seamless — `solo` Lane 0 mission 1 file <20 LOC should be 3 gates, 1 dispatch, cost `direct` budget, no review/security/heal | `test/*`, `scripts/verify-install.ts` | `solo` fixture `direct` → `status` shows `flow 1, 1/1 tasks, lane direct`, `gate` 3 steps, `lessons` not dispatched |

## Definition of Done

- `bun run gate` green on `direct` (3 steps) and `full` (12 steps) fixtures
- `cost-governor` 1 file, no "caveman"/"ponytail" string anywhere in `content/` or `references/`
- `savepoint` + `archive` produce `provenance` not `0/0` for `audit-hardening` 18/18, `sub-plan` fallback works
- `slop_interventions` >0 when `repeated_reads` triggered, `heal_halt` at 3
- `mugiwara continue/status/archive` work on tier 3 (already fixed, re-verified)
- PR `feat/seamless-governors` ready

## Non-goals

- No new runtime deps, no `caveman`/`ponytail` install, no `claude-mem` worker
- No change to `DEFAULT_CONFIG` values, only lane-aware *usage* of existing `budget`/`threshold`

## Tasks

- [x] T0 P0 Solo/Team gate — guided/semi wajib tanya, auto default solo (P0)
- [x] T1 Merge 5 governors → 1 references/cost-governor.md (terse+lazy, no branding)
- [x] T2 Wire cost-governor reduce — Zoro pre-check reuse/stdlib/native/one-line
- [x] T3 Lane-aware gates — direct 3 steps, full 12 steps
- [x] T4 Cost auto-compress — compress flows when context >80% budget
- [x] T5 Wire slop to all crews — repeated_reads/heal_cycle checks
- [x] T6 Enforce savepoint each handoff + checkbox
- [x] T7 Strengthen Zoro + Brook 4-phase + Memory Keeper skip
- [x] T8 Verify seamless — solo direct 3 gates, no review/heal
