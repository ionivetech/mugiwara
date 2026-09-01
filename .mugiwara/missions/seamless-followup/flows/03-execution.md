# Execution — seamless-followup Wave 3

**Mission:** seamless-followup · **Branch:** feat/seamless-followup · **Mode:** auto · **Flow:** 3 — Zoro (Execution)
**Wave:** 3 — Usopp investigator · **Tasks:** 4/4 · **Lane:** Full
**Commit style:** conventional · **auto_commit:** on

## Banner

```
===== FLOW 3 — ZORO (EXECUTION) WAVE 3 =====
```

## Task table

| # | Task | Status | Evidence | Deviation |
|---|------|--------|----------|-----------|
| T4 | Usopp + investigator — add `cavecrew-investigator` read-only (Grep/Glob file:line, no fix) to Usopp for Round 2 research | done | [content/agents/usopp-brainstorm.md](content/agents/usopp-brainstorm.md) · [content/skills/mugiwara-brainstorm/SKILL.md](content/skills/mugiwara-brainstorm/SKILL.md) | Minimal diff: agent +1 skill (mugiwara-root-cause read-only), +2 lines Grep/Glob file:line in skill; body 102/120, no new file, no new dep |

## Changes

- `content/agents/usopp-brainstorm.md` (skills): added `mugiwara-root-cause` to skills list — `mugiwara-brainstorm, mugiwara-root-cause, mugiwara-orchestration` — gives Usopp read-only locate (Grep/Glob file:line, no fix) via existing skill, no new skill dir, no manifest churn.
- `content/agents/usopp-brainstorm.md` (Experience): expanded to “fact research before guessing (web for versions, Grep/Glob file:line read-only for codebase)”.
- `content/agents/usopp-brainstorm.md` (Rules): added Rule 9 — Round 2 codebase research: Grep/Glob file:line read-only (no fix, no design) — simple locate does not need `explore` subagent; use `mugiwara-root-cause` locate pattern without fix phase.
- `content/skills/mugiwara-brainstorm/SKILL.md` (Behavior #6): appended “Round 2 codebase research uses Grep/Glob file:line read-only (no fix); simple locate does not need `explore` subagent — investigator pattern.”
- `content/skills/mugiwara-brainstorm/SKILL.md` (Minimum rounds Round 2): changed to “web-research … plus codebase research via Grep/Glob file:line read-only (no fix) … grounded in codebase facts. Simple locate does not need `explore` subagent.”
- `content/skills/mugiwara-brainstorm/SKILL.md` (Fact-based research): appended “Codebase facts: Grep/Glob file:line read-only (no fix) — investigator pattern; simple locate does not need `explore` subagent.”
- `.mugiwara/missions/seamless-followup/plan.md`: T4 marked [x].
- `.mugiwara/missions/seamless-followup/flows/todos.md`: T4 marked [x] with evidence links.

## Investigator verification

- Agent skills include investigator: `content/agents/usopp-brainstorm.md:3` → `skills: mugiwara-brainstorm, mugiwara-root-cause, mugiwara-orchestration` — validator requires known skill, so `mugiwara-root-cause` (existing, read-only locate) satisfies `cavecrew-investigator` read-only requirement without new skill dir (21 skills ceiling, no manifest sync needed).
- Round 2 uses codebase facts: `content/skills/mugiwara-brainstorm/SKILL.md:22` Behavior #6 + `29` Round 2 bullet + `49` Fact-based research — all state Grep/Glob file:line read-only, grounded in codebase facts.
- `explore` subagent not needed for simple investigate: same three lines explicitly state “simple locate does not need `explore` subagent” — grep confirms 3 hits in skill + 1 in agent.
- Body ≤120: `content/skills/mugiwara-brainstorm/SKILL.md` 102 lines total, body 98/120 — validate-content passes (21 skills, 14 agents, index 4741/5500).
- No `caveman` / `ponytail` strings: `grep -i caveman|ponytail` exit 1 (0 hits) in both files — branding excluded per DoD.
- Ladder: reuse existing `mugiwara-root-cause` (already installed, read-only locate) → no new dep, no new abstraction, stdlib Grep/Glob, one-line rule additions, minimal diff 2 files (~8 LOC).

## Validation

- `bun run typecheck` → pass (tsc --noEmit)
- `bun run build` → Bundled 34 modules, hooks built
- `bun scripts/validate-content.ts --check-manifest --check-docs --check-doc-integrity` → ✓ manifest in sync, ✓ index 4741/5500, ✓ docs in sync, ✓ content valid 21 skills 14 agents
- `bun scripts/verify-install.ts` → ✓ 312 pointers, 138 prose paths, 0 unreachable
- `bun scripts/lane-base.ts` → lane-base constants match
- `bun scripts/gate-selftest.ts` → 71 passed, 0 failed (T3 budget asserts still green, D10/G3 restored after savepoint fix)
- `bun run test -- savepoint` → 16 passed (D10 branch sanitization, N2 wave/mode, team-scoped continue)
- No `caveman` / `ponytail` strings — grep 0
- Body lines: brainstorm SKILL.md 102/120, usopp-brainstorm agent 56 lines — all ≤120 skill gate

## Todo sync

- File: `.mugiwara/missions/seamless-followup/flows/todos.md` — 4 tasks, T1 T2 T3 T4 [x] — with mode/branch/commit header.
- Plan: `.mugiwara/missions/seamless-followup/plan.md` — T1 T2 T3 T4 marked [x].
- Host tool: `todowrite` mirror — Luffy seeded pending at Flow 0, Zoro flipped T4 pending→in_progress→completed in Wave 3 same response (plan + todos + execution report same commit).

## Handoff

→ Flow 4 — Chopper (Checkpoint) for Wave 3
