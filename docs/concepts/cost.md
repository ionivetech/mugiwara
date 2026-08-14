# Token Cost Model

Three-layer token architecture. Every layer has a cost and a purpose.

## The three layers

| Layer | Loaded | Purpose | Current size |
|-------|--------|---------|:---:|
| **Index** — description frontmatter | Every session, every harness | Skill retrieval | ~1.37k tokens |
| **Body** — SKILL.md content | When the skill triggers | Capability — how it performs | ~200 KB, ~0 until used |
| **References** — references/*.md | On demand, when opened | Depth — worked examples, checklists | ~0 (to build) |

Only the **index** is a recurring cost. Body and references pay only when used.

## Index budget

- **Target:** 1.2k tokens (descriptions + agent pointers)
- **Gate:** 5,500 chars hard CI cap — any skill/agent description that pushes the total over fails validation
- **Current:** 5,437 chars ≈ 1.36k tokens (26 skills + 15 agents), loaded every session

The 5,500-char gate is the tightest in the suite: ~63 chars of headroom. One
meaningful description edit, or one new skill/agent, blows the budget.

## Cost per lane

| Lane | Waves | LANE_BASE (measured) | Budget | Warn / Stop (1.5× / 3× budget) |
|------|-------|:---:|:---:|:---:|
| 0 Direct | none | ~0 | — | — |
| 1 Lean | execute → quality | 7,000 | 12,000 | warn 18k / stop 36k |
| 2 Standard | plan → execute → audit → review | 13,000 | 25,000 | warn 37.5k / stop 75k |
| 3 Full | all 9 waves | 23,000 | 50,000 | warn 75k / stop 150k |
| 4 Spike | brainstorm → re-triage | 1,000 | 3,000 | warn 4.5k / stop 9k |

LANE_BASE is **not a hand-written estimate** — `scripts/lane-base.ts`
computes the honest instruction load from the skill + agent bodies each lane
loads (wave owners per workflow.md, ×1.35 tokens/word). The gate fails if a
constant drifts >20% from that measured load, so content growth must be
reflected in the budgets. Lean/standard/full were rescaled from the old
1.5k/4k/9k after a Lane-3 mission measured ~22.9k of instruction load (D5).
Spike stays a deliberate floor — a resize lane, not a content-loaded one.

Budgets warn at exactly 1.5× budget, stop at exactly 3×, both boundaries
inclusive (`>=`). Write state to `.mugiwara/state.json` before stopping.

## Measured benchmark (2026-08-13 QA mission)

All numbers below were measured on this repo, not estimated.

- **Estimator exactness:** `TOKENS_EST = LANE_BASE + DOC_WORDS×1.35 + LOC×12`
  matches a manual recompute exactly in every run, including bash integer
  truncation, the LOC term, and the `MUGIWARA_TOKENS` override (which switches
  `tokens_source` to `reported`).
- **Budget boundaries:** warn/stop fire on `>=` at exactly 1.5× / 3× budget.
  Boundary-tested for standard and full lanes too (previously lean only).
- **Words-to-warn/stop** (doc words, ignoring LOC; LOC tokens reduce headroom
  at 12 tok/line): lean ~3.7k / ~10.4k, standard ~7.4k / ~21.3k, full ~10.9k /
  ~32.6k.
- **Static session overhead:** mugiwara catalog ~1,370 tokens (26 skills + 15
  agents). Compare: ponytail fully injected ~1,300 tokens (5,227 bytes),
  caveman ~625. Skill bodies (~200 KB across 26 skills) load on demand only —
  ~0 until `skill()` fires.
- **Honest limits:** the estimator counts LOC + doc words — a monotonic proxy,
  not real model-I/O telemetry. The true ceiling is the provider's accounting.
  Superpowers is not installed here, so no measured A/B exists; no fabricated
  numbers. To A/B: install both harnesses, run the same mission in identical
  sessions, compare provider token accounting.
- **rtk note:** rtk (Rust Token Killer) compresses agent bash-tool output
  60–90% before it enters context — complementary to the harness. Scripts run
  inside bash (lane.sh, savepoint.sh) are unaffected: rtk hooks only agent bash
  tool calls. rtk tee saves full raw output on failure, so evidence survives.

## Per-mission cost

`state.json` carries `tokens_est` — the estimated tokens consumed by this
mission. At closure, the mission report surfaces:

- Total tokens for the mission
- Lane it ran on
- Cost delta vs. lane budget

This turns lane sizing from "process efficiency" into a number an engineering
manager can act on. No other skills pack produces this because no other pack
sizes work.
