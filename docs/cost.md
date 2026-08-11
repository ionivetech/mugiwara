# Token Cost Model

Three-layer token architecture. Every layer has a cost and a purpose.

## The three layers

| Layer | Loaded | Purpose | Current size |
|-------|--------|---------|:---:|
| **Index** — all `description` frontmatter | Every session, every harness | Retrieval — which skill fires | ~2.9k tokens |
| **Body** — SKILL.md content | When the skill triggers | Capability — how well it performs | ~1.2k avg / skill |
| **References** — `references/*.md` | On demand, when the agent opens them | Depth — worked examples, checklists | ~0 (to build) |

Only the **index** is a recurring cost. Body and references pay only when used.

## Index budget

- **Target:** 1.2k tokens (descriptions + agent pointers)
- **Gate:** 5k chars hard CI cap — any skill/agent description that pushes the total over fails validation
- **Current:** 2.9k tokens, loaded on every session

Reduction path:
1. Prune 32 → 26 skills: ~2.5k
2. Descriptions → trigger-only (~150 chars): ~1.8k
3. Agent descriptions → pointer lines: ~1.2k

## Cost per lane

| Lane | Waves | Estimated tokens | Typical budget |
|------|-------|:---:|:---:|
| 0 Direct | none | ~0 | — |
| 1 Lean | execute → quality | ~4k | warn at 6k, stop at 12k |
| 2 Standard | plan → execute → audit → review | ~10k | warn at 15k, stop at 30k |
| 3 Full | all 9 waves | ~20k | warn at 30k, stop at 60k |
| 4 Spike | brainstorm → re-triage | ~3k | warn at 5k, stop at 9k |

Budget guidance: ~1.5× warns, 3× stops. Write state to `.mugiwara/state.json` before stopping.

## Per-mission cost

`state.json` carries `tokens_est` — the estimated tokens consumed by this mission. At closure, the mission report surfaces:
- Total tokens for the mission
- Lane it ran on
- Cost delta vs. lane budget

This turns lane sizing from "process efficiency" into a number an engineering manager can act on. No other skills pack produces this because no other pack sizes work.
