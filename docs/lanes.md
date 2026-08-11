# Lanes & Sizing

The crew sizes a mission before it runs. Lane is computed from the diff by
`scripts/lane.sh` — deterministic, not estimated.

## The lanes

| Lane | Picks when | Waves | Token budget |
|------|-----------|-------|:------:|
| **0 · Direct** | typo, rename, 1 file <20 LOC | none | ~0 |
| **1 · Lean** | bug in 1-2 files, <50 LOC | execute → quality | ~4k |
| **2 · Standard** | feature, 3-8 files | plan → execute → audit → review | ~10k |
| **3 · Full** | architecture, migration, 9+ files, or auth/payment/API touched | all 9 waves | ~20k |
| **4 · Spike** | exploratory, needs direction | brainstorm → re-triage | ~3k |

## How lane is computed

`scripts/lane.sh <base-ref>` runs `git diff --name-only` against the base ref
and applies deterministic rules:

| Diff | Lane |
|------|------|
| 0 files changed | Direct |
| 1 file, <20 LOC added | Direct |
| 1 file, ≥20 LOC added | Lean |
| 2 files | Lean |
| 3–8 files | Standard |
| 9+ files | Full |

**Sensitive path escalation.** Files matching these patterns always escalate to
Lane 3 (Full), regardless of file count:

```
auth/ payment/ billing/ crypto/ secrets/ .env
migration/ .sql schema. .prisma .terraform .tf
```

Use `--json` for machine output:

```json
{
  "lane": "full",
  "reason": "sensitive paths (src/auth/login.ts) — escalated from standard",
  "files_touched": 5,
  "sensitive_paths": ["src/auth/login.ts"],
  "base": "main"
}
```

## Token budget

Every lane has a budget enforced by `scripts/savepoint.sh` at each wave
boundary. The harness sets `MUGIWARA_TOKENS` env var with estimated tokens
consumed.

| Status | Condition | Action |
|--------|-----------|--------|
| ok | tokens < 1.5× budget | Continue |
| warn | tokens ≥ 1.5× budget | Log warning to decision log |
| stop | tokens ≥ 3× budget | Write state, report to user, pause mission |

Budget guidance, not a hard kill switch. The model decides whether to stop —
savepoint just writes the status to `state.json`.

## Escalation

Lane **escalates when work outgrows the estimate.** At every wave boundary,
`scripts/savepoint.sh` re-checks the diff. If files grew or a sensitive path
appeared, lane rises. A lane **never auto-drops.** Under-process costs more
than over-process.

Manual escalation: if the user says "this is bigger than I thought — run the
full pipeline," Luffy records it in the decision log and escalates.

## SPIKE lane (Lane 4)

Exploratory missions start at Lane 4. Usopp brainstorms, then the mission is
re-triaged into the right lane. A spike that stays a spike (no code change
decided) ends at Wave 1.

Lane is computed per mission by `scripts/lane.sh`, not stored in
`.mugiwara/config`.
