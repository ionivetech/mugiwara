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
- **Current:** 5,479 chars ≈ 1.37k tokens (26 skills + 15 agents), loaded every session

The 5,500-char gate is now the tightest gate in the suite: only 21 chars of
headroom. One meaningful description edit, or one new skill/agent, blows the
budget.

## Cost per lane

| Lane | Waves | Estimated tokens | Typical budget |
|------|-------|:---:|:---:|
| 0 Direct | none | ~0 | — |
| 1 Lean | execute → quality | ~4k | warn at 6k, stop at 12k |
| 2 Standard | plan → execute → audit → review | ~10k | warn at 15k, stop at 30k |
| 3 Full | all 9 waves | ~20k | warn at 30k, stop at 60k |
| 4 Spike | brainstorm → re-triage | ~3k | warn at 4.5k, stop at 9k |

Budget guidance: warn at exactly 1.5× budget, stop at exactly 3×, both
boundaries inclusive (`>=`). Write state to `.mugiwara/state.json` before
stopping.

## Measured benchmark (2026-08-13 QA mission)

All numbers below were measured on this repo, not estimated.

- **Estimator exactness:** `TOKENS_EST = LANE_BASE + DOC_WORDS×1.35 + LOC×12`
  matches a manual recompute exactly in every run, including bash integer
  truncation, the LOC term, and the `MUGIWARA_TOKENS` override (which switches
  `tokens_source` to `reported`).
- **Budget boundaries:** warn/stop fire on `>=` at exactly 1.5× / 3× budget.
  Boundary-tested for standard and full lanes too (previously lean only).
- **Words-to-warn/stop** (doc words, ignoring LOC; LOC tokens reduce headroom
  at 12 tok/line): lean ~3.3k / ~7.8k, standard ~8.1k / ~19.3k, full ~15.6k /
  ~37.8k.
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
