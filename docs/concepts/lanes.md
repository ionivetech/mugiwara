# Lanes & Sizing

The crew sizes a mission before it runs. Lane is computed from the diff by
`mugiwara run lane.sh` — deterministic, not estimated.

## The lanes

| Lane | Picks when | Flow stages | Token budget |
|------|-----------|-------|:------:|
| **0 · Direct** | typo, rename, 1 file <20 LOC | none | ~0 |
| **1 · Lean** | bug in 1-2 files, <50 LOC | execute → quality | ~8k / 12k |
| **2 · Standard** | feature, 3-8 files | plan → execute → audit → review | ~13k / 25k |
| **3 · Full** | architecture, migration, 9+ files, or auth/payment/API touched | all 9 flow stages | ~22k / 50k |
| **4 · Spike** | exploratory, needs direction | brainstorm → re-triage | ~5k / 3k |

The "typical" column is the measured LANE_BASE — the token load of the skills
and agents that lane loads, computed by `scripts/lane-base.ts` from content
word-sums (×1.35). "Budget" is the warn/stop ceiling (1.5× / 3×). A constant
that drifts >20% from the measured load fails CI — budgets are generated, not
hand-tuned.

## How lane is computed

`mugiwara run lane.sh <base-ref>` runs `git diff --name-only` against the base ref
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
Lane 3 (Full), regardless of file count. The patterns live in one place —
`scripts/lib/patterns.sh` — sourced by both `lane.sh` and `savepoint.sh` (a
change there applies to both):

```
auth/ oauth2?/ payment/ payments/ billing/ crypto/ secrets/ credential sessions?/ tokens?/ rbac permissions?/ acls?/ iam/ .env .env.
config/.*key .p12 .key .pem migration/ migrations/ migrate/ .sql schema. .prisma .terraform .tf Dockerfile docker-compose .github/workflows/ webhooks?/ secret/ secrets?.ya?ml .tfvars
```

Plural forms (`payments/`, `migrations/`) and the v0.6.4 categories (oauth,
credential, session(s)/, token(s)/, rbac, permission(s), acl(s)/, iam/, cert
keys, migrate/, Dockerfile, docker-compose, `.github/workflows/`, webhooks,
secret yaml, `.tfvars`, `.env` variants) included — the v0.6.3 list missed
them (D3). This block is drift-guarded: `lane-integrity` case 35 asserts it
equals the `patterns.sh` source (display form — backslashes and trailing `$`
stripped), so a pattern change without a doc update turns CI red. Deliberately
**not** matched: `package.json` (dependency churn is policy-as-code, not a
sensitive lane trigger — deferred to policy) and `authors/` (contains "auth"
but never `auth/`). Dir-anchored patterns (`oauth2?/`, `permissions?/`,
`tokens?/`, `sessions?/`, `acls?/`) keep `oauth-guide.md`, `permissionless.ts`
and `tokenizer` out; the negative fixture pins those traps.

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

Every lane has a budget enforced by `mugiwara savepoint` at each flow stage
boundary. `savepoint` computes `tokens_est` — an estimate of tokens consumed
(LANE_BASE + doc words ×1.35 + changed LOC ×12) — and compares it against the
budget. A user may override the estimate by setting `MUGIWARA_TOKENS`; nothing
sets it automatically.

| Status | Condition | Action |
|--------|-----------|--------|
| ok | tokens < 1.5× budget | Continue |
| warn | tokens ≥ 1.5× budget | Log warning to decision log |
| stop | tokens ≥ 3× budget | Write state, report to user, pause mission |

Budget guidance, not a hard kill switch. The model decides whether to stop —
savepoint just writes the status to the mission state.

## Escalation

Lane **escalates when work outgrows the estimate.** At every flow-stage boundary,
`mugiwara savepoint` re-checks the diff. If files grew or a sensitive path
appeared, lane rises. A lane **never auto-drops** — savepoint clamps to the
previous peak (`lane_peak` in the mission state) even when the diff shrinks, and
`lane_rose` flags the escalation. Under-process costs more than over-process.
A fresh mission (different mission name) resets the clamp.

Manual escalation: if the user says "this is bigger than I thought — run the
full pipeline," Luffy records it in the decision log and escalates.

## SPIKE lane (Lane 4)

Exploratory missions start at Lane 4. Usopp brainstorms, then the mission is
re-triaged into the right lane. A spike that stays a spike (no code change
decided) ends at Flow 1.

## Monorepo scoping (optional)

For monorepos, scope lane sizing to one package/app without shrinking safety:

```ini
# .mugiwara/config
lane_scope_glob=packages/app/**
```

When set, `lane.sh` and `savepoint.sh` count only changed files matching the
glob before sizing; the 1-file LOC rule and file-count thresholds apply to the
scoped set. **Sensitive-path escalation still evaluates the unfiltered diff**
so a sensitive hit inside the scope still forces `full` — safety never shrinks.

Examples:

- 12 files changed outside `packages/app/**` + 1 inside → `standard` (not `full`)
- a sensitive hit (`auth/`, `payments/`, `secrets/`, …) inside the scope → `full`
- unset or `*` → today's behavior (no scoping)

Lane is computed per mission by `mugiwara run lane.sh`, not stored in
`.mugiwara/config`.
