# Which lane for my change?

A typo once waited behind the full review pipeline while a payment migration slipped through with a glance. Both failures came from one process applied to every change. Lanes fix that by sizing the process to the diff before the mission runs.

Example: you rename one variable in one file. `mugiwara run lane.sh` reports `direct`, and the change ships with no pipeline. You touch `src/auth/login.ts` in a five-file diff. The same command reports `full`, and all nine flow stages run.

## The lanes

| Lane | Picks when | Flow stages |
|------|-----------|-------|
| **0 Direct** | typo, rename, 1 file under 20 LOC | none |
| **1 Lean** | bug in 1-2 files, under 50 LOC | execute, quality |
| **2 Standard** | feature, 3-8 files | plan, execute, audit, review |
| **3 Full** | architecture, migration, 9+ files, or auth/payment/API touched | all nine flow stages |
| **4 Spike** | exploratory, needs direction | brainstorm, re-triage |

Token budgets ride with the lane: warn at 1.5x, stop at 3x the lane base. Lane bases run 8,000 (lean), 13,000 (standard), 22,000 (full); budgets run 12,000, 25,000, 50,000. `mugiwara savepoint` checks the estimate at each flow-stage boundary and records the status in mission state.

## How lane is computed

Lane comes from `git diff` against the base ref through deterministic rules: 0 files means direct, 1 file under 20 added lines means direct, 1 larger file or 2 files means lean, 3-8 files means standard, 9 or more means full.

Sensitive paths always escalate to full, whatever the file count. The patterns live in one place: `scripts/lib/patterns.sh`, shared by lane sizing and savepoints, so one edit covers both. Display form below, regex escapes stripped; the test in `test/lane-integrity.test.ts` fails when this block drifts from source. `package.json` churn and near-miss names such as `authors/` or `tokenizer` stay out by design.

```
auth/
oauth2?/
payment/
payments/
billing/
crypto/
secrets/
credential
sessions?/
tokens?/
rbac
permissions?/
acls?/
iam/
.env
.env.
config/.*key
.p12
.key
.pem
migration/
migrations/
migrate/
.sql
schema.
.prisma
.terraform
.tf
Dockerfile
docker-compose
.github/workflows/
webhooks?/
secret/
secrets?.ya?ml
.tfvars
```

## Escalation never drops

At each boundary, savepoint re-checks the diff. A lane rises when the work grows or a sensitive path appears, and never falls back within the mission: the peak persists in state, flagged for the record. Over-processing a small change costs less than under-processing a large one. Say the word and Luffy escalates manually, recorded in the decision log.

## Path-weighted sizing (docs-only downgrade)

File count alone never escalates to full when nothing code-like changed: a
change whose files match neither the product dirs (`content/`, `src/`,
`scripts/`, `test/`, `hooks/`, `.opencode/`, `.claude/`, `evals/`) nor a code
extension (`.py`, `.go`, `.rs`, `.js`, `.ts`, … — the full list lives in
`scripts/lib/patterns.sh` as `CODE_PAT`) is sized `standard`, not `full`.
Thirteen markdown files are docs, not architecture. Sensitive-path escalation
always wins over this downgrade, and policy `force_full` wins over both.

For monorepos, `lane_scope_glob` in `.mugiwara/config` sizes the lane from one package glob. Escalation still reads the unfiltered diff, so safety never shrinks with the scope.
