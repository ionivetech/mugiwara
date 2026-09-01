# Decisions — seamless-followup

## Flow 0 — triage (Luffy)

**Classification:** Explicit (follow-up 4 fixes from user audit)
**Lane:** Full (8+ files, 4 waves)
**Mode:** auto · solo (from P0 seamless-governors, user solo)
**Route:** → Flow 2 Planning (explicit) → Flow 3 Execute (Zoro)
**Actor:** AI: muse-spark-1.2-contributor-free
**Reason:** 4 tasks file-disjoint within wave, need Nami plan then Zoro

## Flow 0 — P0 Solo/Team gate

**Answer:** solo (inherited from seamless-governors, user solo) — state.json solo

## Flow 3 — Zoro (Execution) Wave 1

**Mode:** auto · **Branch:** feat/seamless-followup · **Commit:** conventional · **auto_commit:** on — auto always commits, branch from config `branch=feature/{type}-{issue}-{slug}` resolved to `feat/seamless-followup`.
**Tasks:** T1 Todos sync + T2 Banner all crews — inline sequential, no `[PARALLEL]` (shared files would conflict).
**Cost governor:** ladder reuse→stdlib→native→installed→one line→code — reuse existing `Host todo mirrors` + `Banners` lines, minimal diff 3 files + 1 reference; no new dep, no abstraction.
**Actor:** AI: muse-spark-1.2-contributor-free

## Flow 3 — Zoro (Execution) Wave 2

**Mode:** auto · **Branch:** feat/seamless-followup · **Commit:** conventional · **auto_commit:** on — auto always commits.
**Tasks:** T3 Verify lane-aware gates & cost — inline sequential, sole file gate-selftest touched (direct-seamless already green).
**Cost governor:** ladder reuse→stdlib→native — reuse `gatesForLane`/`budgetForLane` from `src/policy.ts`/`src/cost.ts` (already in repo), stdlib no new dep; 1 import + 2 asserts (<5 LOC) proves direct 3/0 vs full 12/50000, fixture solo 1 file <20 LOC already in direct-seamless.test.ts; no new file, no abstraction.
**Lane-aware:** direct 3 steps (`build-hooks:check,typecheck,build`), full 12 steps (+validate-content,lane-base,check-doc-links,test:coverage,coverage-gate,verify-install,run-evals,retrieval-eval,conformance); budget direct 0, spike 3000, full 50000 — verified via gate-selftest + direct-seamless, build green.
**Actor:** AI: muse-spark-1.2-contributor-free

## Flow 3 — Zoro (Execution) Wave 3

**Mode:** auto · **Branch:** feat/seamless-followup · **Commit:** conventional · **auto_commit:** on — auto always commits.
**Tasks:** T4 Usopp + investigator — inline sequential, 2 files file-disjoint within wave (agent + skill), no `[PARALLEL]` needed.
**Cost governor:** ladder reuse→stdlib→native→installed→one line→code — reuse `mugiwara-root-cause` (existing, read-only locate) for Grep/Glob file:line, stdlib no new dep; 8 LOC across 2 files, no new skill dir (21 ceiling), body 102/120 via minimal one-line additions, no abstraction.
**Investigator:** agent skills +`mugiwara-root-cause` read-only, skill Behavior #6 + Round 2 + Fact-based research all state Grep/Glob file:line read-only + “simple locate does not need `explore` subagent” + investigator pattern; Round 2 grounded in codebase facts; explore subagent not needed for simple locate.
**Actor:** AI: muse-spark-1.2-contributor-free
