# Decisions — seamless-governors

## Flow 0 — triage (Luffy)

**Classification:** Explicit (user audit + fix list) + Open-ended (governor design)
**Lane:** Full (9+ files, 5 governors + crew, sensitive: policy/cost)
**Route:** → Flow 1 Brainstorm (Usopp) → Flow 2 Planning (Nami) → Flow 3 Execute (Zoro)
**Mode:** auto (from .mugiwara/config) — Luffy auto-approves plan, no human GO needed
**Actor:** AI: muse-spark-1.2-contributor-free
**Reason:** 8 tasks across 4 waves, file-disjoint within wave, need Nami plan before Zoro. Previous missions (audit-hardening) proved lane-aware + slop not wired — this mission fixes that class, not just instance.

## Flow 0 — P0 Solo/Team gate (krusial)

**Gap found:** Luffy tidak tanya `solo atau tim?` di `mode guided/semi` — langsung anggap solo dari `git config`. Ini krusial P0 karena affect `state.json` vs `<member>.json`, `Nami` parallel plan, `Zoro` dispatch, `continue` isolation.

**Fix:** Tambah T0 P0 ke plan — `guided/semi` → wajib tanya + blocker kalau belum jawab, `auto` → default solo tercatat. Masuk Wave 0 sebelum governor unification.

## Flow 0 — crew strengthening assessment

- Luffy: strong, needs savepoint enforcement + **P0 solo/team gate**
- Nami: strong, needs - [ ] enforcement + member isolation when tim
- Zoro: medium (scope not enforced) → strengthen
- Brook: medium (4-phase not in all heals) → strengthen
- Memory Keeper: weak (dispatch even when empty) → strengthen (skip direct + no ledger)
- Others (Chopper, Sanji, Franky, Robin/Jinbe, Usopp): strong, lane-aware gate skip for direct

## Flow 2 — planning

**Posture:** inline-sequential (each wave sequential, parallel within wave where file-disjoint). Cost-aware: defer non-goal, keep governor honest boundary (recommend/record, not force).


## Flow 0 — P0 Solo/Team gate — RESOLVED

**Answer:** solo (user 2026-08-31)
**Effect:** state.json solo, Nami plan inline-sequential, Zoro dispatch single actor, continue solo
**Actor:** user: ionivetech <ionivetech@gmail.com>

## Flow 3 — Execution Wave 1 T1-T2 (Zoro)

**Mode:** auto · **Branch:** feat/seamless-governors · **Commit style:** conventional · **auto_commit:** on (auto mode ignores off)
**Posture:** inline-sequential (solo, no parallel subagents — Wave 1 files disjoint but executed inline per execution rule)
**Tasks:** T1 merge 5 governors → 1 cost-governor.md + T2 wire execution pre-check
**Decisions:**
- T1: Created `references/cost-governor.md` merging 5 governors, terse+lazy ladder first, Mugiwara-native, no branding strings. Deleted 5 old governor files (not stubbed — stub would orphan). Updated workflow + orchestration to point to `_shared/references/cost-governor.md`.
- T2: Wired execution skill pre-check ladder via single-line extension in Code quality floor, referencing cost-governor, keeping body 119/120.
**Evidence:**
- `bun run build` — Bundled 34 modules exit 0
- `bun scripts/validate-content.ts --check-manifest --check-docs --check-doc-integrity` — manifest sync, index 4741/5500, content valid 21/14 exit 0
- `bun scripts/verify-install.ts` — 290 pointers 0 broken 0 orphans exit 0
- `bun run typecheck` — exit 0
- `grep -R -i "caveman|ponytail" content/ references/` — clean
**Actor:** AI: muse-spark-1.2-contributor-free

## Flow 3 — Execution Wave 2 T3-T4 (Zoro)

**Mode:** auto · **Branch:** feat/seamless-governors · **Commit style:** conventional · **auto_commit:** on (auto mode always)
**Posture:** inline-sequential (Wave 2 files disjoint but executed inline per execution rule — minimal diff, body ≤120)
**Tasks:** T3 lane-aware gates + T4 cost auto-compress
**Decisions:**
- T3: `src/policy.ts` GATE_STEPS_BY_LANE single source — direct 3, lean 6, standard 9, full 12 (conformance retained). Doc 4-line Lane-aware gates section (80/120) pointing to policy as source. Gate-selftest T3 mutation proves direct 3 steps.
- T4: `src/budget.ts` 80% threshold + `src/cost.ts` COMPRESSED_KIND + `src/mission.ts` archive compress flows→stub (00-compressed.md) before hard 100% gate, records compressed+closure events, never throws at 80-99%.
**Evidence:**
- `bun run build` — Bundled 34 modules exit 0
- `bun run typecheck` — exit 0
- `bun scripts/validate-content.ts` — content valid 21/14, index 4741/5500 exit 0
- `gatesForLane` direct 3 / full 12 with conformance true
- `shouldCompress 90% → compress stub not throw`, `100% → compress then throw` (M2)
**Actor:** AI: muse-spark-1.2-contributor-free
