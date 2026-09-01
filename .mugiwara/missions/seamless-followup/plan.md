# Plan — seamless-followup

**Mission:** `seamless-followup` · **Branch:** `feat/seamless-followup` · **Mode:** `auto` · **Lane:** `Full` (4 fixes, 8+ files)
**Source:** Follow-up dari seamless-governors — todos sync, banner all crews, lane-aware verify, Usopp investigator

## Context scan

- **Todos:** `plan.md tasks` → `flows/todos.md` file, tidak pernah `todowrite` host UI → tidak sync dengan Opencode sidebar, hilang setelah `archive`
- **Banner:** Zoro subagent tanpa banner main thread → transcript tidak rapih, Flow 1-9 tidak ada `===== FLOW N — CREW =====`, heal count dari `decisions.md` bukan banner
- **Cost:** Lane-aware sudah code (`GATE_STEPS_BY_LANE` direct 3/full 12, `shouldCompress` 80%) tapi belum diverifikasi `direct 3k` vs `full 50k` di fixture
- **Usopp:** `mugiwara-brainstorm` only (3 rounds), tidak ada investigator read-only (`Grep/Glob` file:line) untuk Round 2 research — masih pakai `explore` subagent 132k

## Goal

4 perbaikan seamless: todos sync Opencode + banner all crews via main thread + lane-aware verify + Usopp investigator, tanpa caveman/ponytail branding

## Lane & Mode

- Lane Full (touches `content/skills/*`, `content/agents/*`, `src/*`, `scripts/*`)
- Mode auto — solo (from seamless-governors P0)

## Task index

### Wave 1 — Todos + Banner (seamless transcript)

| # | Task | Files | Acceptance |
|---|------|-------|------------|
| T1 | Todos sync — `todowrite` mirror `plan.md` every task + flow stage (pending→in_progress→completed) | `content/skills/mugiwara-workflow/SKILL.md`, `content/skills/mugiwara-orchestration/SKILL.md`, `content/skills/mugiwara-execution/SKILL.md` | `todowrite` 9 todos di Flow 0, update tiap wave, `flows/todos.md` tetap + host UI sync |
| T2 | Banner all crews — main thread emit `===== FLOW N — CREW =====` before dispatch subagent (if any), handoff after | `content/skills/mugiwara-workflow/SKILL.md`, `references/wave-banners.md` | Transcript ada banner untuk Flow 0 Luffy, 1 Usopp, 2 Nami, 3 Zoro, 4 Chopper, 5 Sanji, 6 Franky, 7 Robin/Jinbe, 8 Brook, 9 Luffy |

### Wave 2 — Lane-aware + Cost verify

| # | Task | Files | Acceptance |
|---|------|-------|------------|
| T3 | Verify lane-aware gates & cost — `direct` 3 steps/3k vs `full` 12 steps/50k, fixture solo 1 file <20 LOC | `test/direct-seamless.test.ts`, `scripts/gate-selftest.ts` | `direct` → 3 gates, `full` → 12, budget direct 0, full 50000 |

### Wave 3 — Usopp investigator

| # | Task | Files | Acceptance |
|---|------|-------|------------|
| T4 | Usopp + investigator — add `cavecrew-investigator` read-only (Grep/Glob file:line, no fix) to Usopp for Round 2 research | `content/agents/usopp-brainstorm.md`, `content/skills/mugiwara-brainstorm/SKILL.md` | Usopp skill includes investigator, Round 2 uses codebase facts, `explore` subagent not needed for simple investigate, body ≤120 |

## Tasks

- [x] T1 Todos sync — todowrite mirror plan.md
- [x] T2 Banner all crews — main thread before dispatch
- [x] T3 Verify lane-aware 3 vs 12 + 3k vs 50k
- [ ] T4 Usopp + investigator read-only

## Definition of Done

- `todowrite` 4 todos sync with plan, banner appears for Flow 0-9 in main thread
- `direct` fixture 3 gates/3k, `full` 12 gates/50k verified
- Usopp can Grep/Glob file:line without dispatch, body ≤120, no "caveman"/"ponytail"
- `bun run gate` green

## Non-goals

- No new deps, no caveman/ponytail strings, no claude-mem worker
