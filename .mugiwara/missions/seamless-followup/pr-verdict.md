# PR verdict — feat/seamless-followup

## Title

feat(followup): todos sync + banner all crews + lane-aware + Usopp investigator

## Summary

4 perbaikan seamless follow-up dari `seamless-governors` — checklist tetap, sync conditional, banner rapih, cost reduce, Usopp bisa investigate:

1. **Todos sync (T1):** `plan.md - [x]` + `flows/todos.md` tetap sebagai archive, **host UI sync conditional** — `todowrite` kalau `opencode`, `TaskCreate/TaskUpdate` kalau `Claude` (TodoWrite deprecated), `none` kalau tier 2/3 (Codex, Cursor, dll.) — `harness-matrix.md:137` table. Luffy seed `pending` Flow 0, Zoro flip `in_progress→completed` tiap wave.

2. **Banner all crews (T2):** Main thread emit `===== FLOW N — CREW =====` **first line** sebelum dispatch subagent (jika pakai subagent), handoff `→ Flow N+1` **last line** setelah balik — untuk **semua** Flow 0 Luffy, 1 Usopp, 2 Nami, 3 Zoro, 4 Chopper, 5 Sanji, 6 Franky, 7 Robin/Jinbe, 8 Brook, 9 Luffy. Transcript rapih walau kerja di subagent.

3. **Lane-aware verify (T3):** `direct` (1 file <20 LOC) → 3 gates / budget 0, `full` (9 tasks) → 12 gates / 50k — fixture `fix.ts` 1 LOC → `lane.sh direct`, `savepoint` `1/1, budget 0` — 8 tests.

4. **Usopp + investigator (T4):** `usopp-brainstorm` skills +`mugiwara-root-cause` (read-only `Grep/Glob file:line, no fix`) — Round 2 research pakai codebase facts, simple locate tidak perlu `explore` subagent 132k.

Branch `feat/seamless-followup` from `feat/seamless-governors` `4b83e7d` → `424b964` (4 commits), solo, auto.

## What changed

- `content/skills/mugiwara-workflow/SKILL.md` — Host todos: `todowrite` on opencode / `TaskUpdate` on Claude / none tier 2/3 + Banners all crews 0-9 main thread before dispatch — 114/120
- `content/skills/mugiwara-orchestration/SKILL.md` — Flow transitions + Host todos seed/flip + Banners — 119/120
- `content/skills/mugiwara-execution/SKILL.md` — Todo list ownership Luffy seed / Zoro flip + flows/todos.md archive + host UI sync same response — 120/120
- `references/wave-banners.md` — Rule 1: main thread FIRST/LAST even when subagent does work — Flow 0 Luffy .. 9 Luffy
- `src/policy.ts` — `GATE_STEPS_BY_LANE` direct `['build-hooks:check','typecheck','build']` (3) lean 6 standard 9 full 12
- `src/budget.ts` — `COMPRESS_THRESHOLD_PCT=0.8` `shouldCompress()`
- `src/cost.ts` — `COMPRESSED_KIND`
- `src/mission.ts` — `shouldCompress` stub `00-compressed.md` + compressed event (already in governors, re-verified)
- `test/direct-seamless.test.ts` — 8 tests lane direct 3 / budget 0
- `content/agents/usopp-brainstorm.md` — skills `mugiwara-brainstorm, mugiwara-root-cause, mugiwara-orchestration` — Experience + Rule 9 Grep/Glob read-only
- `content/skills/mugiwara-brainstorm/SKILL.md` — Behavior 6 + Round 2 + Fact-based research: Grep/Glob read-only, simple locate no `explore` subagent — 102/120
- `README.md` + `.metrics/latest.json` — 302→312 pointers (10 from todos/banner)

## Per-flow-stage evidence

| Flow | Crew | Verdict | Evidence |
|------|------|---------|----------|
| 0 Triage | Luffy | GO | `decisions.md: Flow 0` Explicit follow-up 4 fixes, lane Full, auto solo, P0 inherited |
| 2 Planning | Nami | GO | `plan.md` 4 tasks `- [ ]` 0/4 → 4/4, 2 waves file-disjoint, spec todos/banner/lane/Usopp |
| 3 Wave1 | Zoro | GO | `750f60a` 4 files: `mugiwara-workflow` 114 todos/banner, `orchestration` 119, `execution` 120, `wave-banners` Rule 1 — `validate-content` 21/14, `verify-install` 312 ptrs |
| 3 Wave2 | Zoro | GO | `4879af8` 2 files: `GATE_STEPS_BY_LANE` direct 3 full 12, `budget 0/50k`, `gate-selftest` 71 passed, `direct-seamless` 8 |
| 3 Wave3 | Zoro | GO | `7d2c246` 2 files: `usopp-brainstorm` +`mugiwara-root-cause`, skill 102/120, `Grep/Glob` 3 hits, 0 `caveman/ponytail` |
| 4 Checkpoint | Chopper | GO | `flows/04-checkpoint.md` — 4/4 re-verified, 8 checks, no `0/0`, todos 4/4 |
| 5 Quality | Sanji | PASS | `flows/05-quality.md` — `typecheck 0`, `build 34`, `maintainability B 7.1%`, 844 tests |
| 6 Gates | Franky | GO | `flows/06-gates.md` — coverage 92.92 (>85/90), build 0, diff 22 prod <400, `README 312/312` |
| 7 Review | Robin | GO | `flows/07-review.md` + `review.md` — 5 minors, B rating, no breaking change |
| 7 Security | Jinbe | GO | `flows/07-security.md` + `security.md` — STRIDE 8 hotspots 100%, 0 vuln |

## Tests

- `npx vitest run` : **844 passed** (45 files) — `direct-seamless` 8, `cli-heal` 20, `harness-policy` 134, `integrity` 199, `migrate` 149, `provenance` 79
- `bun run test -- direct-seamless` : 8/8 — lane direct 3, budget 0, solo 1/1
- `gate-selftest` : 71 passed (T3 direct 3/full 12, budget)
- `typecheck` : 0
- `build` : 34 modules 142KB
- `validate-content` : 21 skills 14 agents, index 4741/5500, 312/312 pointers, docs sync, 0 `caveman/ponytail`
- `verify-install` : 312 pointers 0 broken 0 unreachable
- `conformance` : 12/12 platforms pass
- `benchmark-governor` : 4 workloads + 12 slop + 3 stress pass

## Checklist

- [x] Todos sync — `plan.md - [x]` + `flows/todos.md` tetap, `todowrite` opencode / `TaskUpdate` Claude / none tier 2/3
- [x] Banner all crews — main thread `===== FLOW N — CREW =====` before dispatch, handoff after (Flow 0-9)
- [x] Lane-aware gates direct 3 vs full 12 verified
- [x] Budget direct 0 vs full 50000 verified
- [x] Solo 1 file <20 LOC → `lane.sh` direct, `savepoint` 1/1, budget 0
- [x] Usopp + investigator read-only `Grep/Glob file:line, no fix`
- [x] Round 2 research grounded codebase facts, simple locate no `explore` subagent
- [x] Body ≤120 via `references/` pointer, no `caveman`/`ponytail`
- [x] No new deps, no new skill dir (21 ceiling)

## Notes

- `todowrite` disabled for subagents by default (opencode permission `todowrite`) — main thread (Luffy/Zoro) seeds/flips, subagent `cavecrew` tidak dipanggil untuk todos.
- `TaskCreate` di Claude untuk apa? → bikin 1 todo baru di sidebar Task Claude (pengganti TodoWrite deprecated) — Luffy seed `pending`, Zoro `TaskUpdate` → `completed`.
- Tier 2/3 (Codex, Cursor, Windsurf, dll.) tidak punya native todo tool — `harness-matrix.md:137` `none` — jadi cuma file `todos.md` + `plan.md`.

## Verdict

**GO** — 4/4 tasks PASS, checklist tetap + sync conditional, banner rapih all crews, lane-aware verified, Usopp investigator read-only. Single PR `feat/seamless-followup` ready.

## Branch

`feat/seamless-followup` — from `feat/seamless-governors` `4b83e7d` → `424b964` (4 commits: `750f60a` todos/banner, `4879af8` lane-aware, `7d2c246` Usopp, `ee519b8` metrics, `424b964` archive). **Pushed `origin/feat/seamless-followup`.** User opens PR. Crew never merges.
