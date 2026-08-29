# Token Cost Model

Three-layer token architecture. Every layer has a cost and a purpose.

## The three layers

| Layer | Loaded | Purpose | Current size |
|-------|--------|---------|:---:|
| **Index** — description frontmatter | Every session, every harness | Skill retrieval | ~1.17k tokens |
| **Body** — SKILL.md content | When the skill triggers | Capability — how it performs | ~170 KB, ~0 until used |
| **References** — references/*.md | On demand, when opened | Depth — worked examples, checklists | ~0 (to build) |

Only the **index** is a recurring cost. Body and references pay only when used.

## Index budget

- **Target:** ≤1.2k tokens (descriptions + agent pointers)
- **Gate:** 5,500 chars hard CI cap — any skill/agent description that pushes the total over fails validation
- **Current:** 4,741 chars ≈ 1.18k tokens (21 skills + 14 agents), loaded every session

The 5,500-char gate leaves ~780 chars of headroom after the v0.7 prune
(26 → 21 skills). The validator prints the measured total on every run and
fails when this doc's stated number drifts from the measurement; keep the
remaining headroom in reserve — it is the budget's lock, not free space.

## Cost per lane

| Lane | Flow stages | LANE_BASE (measured) | Budget | Warn / Stop (1.5× / 3× budget) |
|------|-------|:---:|:---:|:---:|
| 0 Direct | none | ~0 | — | — |
| 1 Lean | execute → quality | 7,000 | 12,000 | warn 18k / stop 36k |
| 2 Standard | plan → execute → audit → review | 13,000 | 25,000 | warn 37.5k / stop 75k |
| 3 Full | all 9 flow stages | 23,000 | 50,000 | warn 75k / stop 150k |
| 4 Spike | brainstorm → re-triage | 1,000 | 3,000 | warn 4.5k / stop 9k |

LANE_BASE is **not a hand-written estimate** — `scripts/lane-base.ts`
computes the honest instruction load from the skill + agent bodies each lane
loads (flow-stage owners per workflow.md, ×1.35 tokens/word). The gate fails if a
constant drifts >20% from that measured load, so content growth must be
reflected in the budgets. Lean/standard/full were rescaled from the old
1.5k/4k/9k after a Lane-3 mission measured ~22.9k of instruction load (D5).
Spike stays a deliberate floor — a resize lane, not a content-loaded one.

Budgets warn at exactly 1.5× budget, stop at exactly 3×, both boundaries
inclusive (`>=`). Write state to `.mugiwara/missions/<mission>/[member].json` before stopping.

## What is measurable today

Two numbers are computed, gate-validated constants — not guesses:

| Lane | Instruction base¹ (tokens) | Budget | Warn (1.5×) | Stop (3×) |
|------|---------------------------|--------|-------------|-----------|
| direct | 0 (no pipeline) | — | — | — |
| spike | 1,000 | 3k | 4.5k | 9k |
| lean | 7,000 | 12k | 18k | 36k |
| standard | 13,000 | 25k | 37.5k | 75k |
| full | 23,000 | 50k | 75k | 150k |

¹ `LANE_BASE_*` from `scripts/lib/lane-base.sh` — the sum of skill+agent body
word-counts × 1.35 for that lane's flow stages; `scripts/lane-base.ts` fails
CI when a constant drifts >20% from content. Budget/warn/stop come from
`BUDGET_*` in the same file; state warns at 1.5× and stops at 3×.

What these numbers do NOT include: model I/O on your actual diff, tool
outputs, harness system prompts. They bound the *process* cost — the part
mugiwara adds — not the total session cost.

## Measured benchmark (2026-08-13 QA mission)

All numbers below were measured on this repo unless marked as an estimate.

- **Estimator reproducibility:** `TOKENS_EST = LANE_BASE + DOC_WORDS×1.35 + LOC×12`
  is a work/churn estimate, not measured usage — it matches a manual recompute
  exactly in every run, including bash integer truncation, the LOC term, and
  the user-supplied `MUGIWARA_TOKENS` override (which switches `tokens_source`
  to `reported`).
- **Budget boundaries:** warn/stop fire on `>=` at exactly 1.5× / 3× budget.
  Boundary-tested for standard and full lanes too (previously lean only).
- **Words-to-warn/stop** (doc words, ignoring LOC; LOC tokens reduce headroom
  at 12 tok/line): lean ~3.7k / ~10.4k, standard ~7.4k / ~21.3k, full ~10.9k /
  ~32.6k.
- **Static session overhead:** mugiwara catalog ~1,170 tokens (21 skills + 14
  agents). Compare: ponytail fully injected ~1,300 tokens (5,227 bytes),
  caveman ~625. Skill bodies (~170 KB across 21 skills) load on demand only —
  ~0 until `skill()` fires.
- **Honest limits:** the estimator counts LOC + doc words — a monotonic proxy,
  not real model-I/O telemetry. The true ceiling is the provider's accounting:
  when the harness exposes real usage, feed it back with `MUGIWARA_TOKENS` —
  the state then records `tokens_source: reported` instead of `estimator`, and
  the mission report carries a provider-backed number.
  Superpowers is not installed here, so no measured A/B exists; no fabricated
  numbers. To A/B: install both harnesses, run the same mission in identical
  sessions, compare provider token accounting.
- **rtk note:** rtk (Rust Token Killer) compresses agent bash-tool output
  60–90% before it enters context — complementary to the harness. Scripts run
  inside bash (lane.sh, savepoint.sh) are unaffected: rtk hooks only agent bash
  tool calls. rtk tee saves full raw output on failure, so evidence survives.

## Provider-reported tokens (first-class path)

The estimator is effortless, but it is not telemetry. Where the harness
exposes real usage, pipe it in — the state's `tokens_source` flips to
`reported` and the report carries a provider-backed number:

```bash
# legacy: single number
MUGIWARA_TOKENS=128400 mugiwara savepoint <mission> ...

# first-class: JSON {input_tokens, output_tokens} — works on every harness
# that can run a shell (T4)
echo '{"input_tokens": 42000, "output_tokens": 86400}' > /tmp/tokens.json
mugiwara savepoint --tokens-file /tmp/tokens.json <mission> ...
# state: tokens_source=reported, tokens_est=128400 (= input+output)
# report: "Tokens reported total: 128400 (provider-reported)" when any stage reported
```

**Recipes — tier 1 (can report):**

| Harness | How to capture | How to pipe |
|---------|---------------|-------------|
| **Claude Code** | Usage in statusline / API (`/cost` or `anthropic-usage` header) — `input_tokens` + `output_tokens` per turn | `MUGIWARA_TOKENS=$((input+output))` or write the JSON and `--tokens-file /tmp/tokens.json` at each savepoint |
| **opencode** | `cost` field from the session's `usage` payload (input + output) | Same — `echo '{"input_tokens":..., "output_tokens":...}' > /tmp/tokens.json` then `savepoint --tokens-file` |

**Tier 2/3 cannot report.** They run agents as markdown (no usage API, no shell
hook at savepoint time), so there is no provider number to pipe — the state
stays `tokens_source: estimator` and the estimator remains the default. The
rollup line is absent; do not fabricate numbers.

## Per-mission cost

the mission state carries `tokens_est` — the estimated token load for this
mission (LANE_BASE + doc words ×1.35 + changed LOC ×12), the user-supplied
`MUGIWARA_TOKENS` value when set, or the `--tokens-file` sum (`input+output`)
when that first-class path is used. At closure, the mission report surfaces:

- Total tokens for the mission
- Lane it ran on
- Cost delta vs. lane budget
- `Tokens reported total: N (provider-reported)` when any stage reported

This turns lane sizing from "process efficiency" into a number an engineering
manager can act on. No other skills pack produces this because no other pack
sizes work.

## Cost Governor module (`src/cost.ts`)

Phase 1 of the Native Cost Governor initiative centralizes the budget math
that used to live in two places. `scripts/lib/lane-base.sh` remains the
single source of truth for the shell runtime (`savepoint.sh` reads it and
cannot import TypeScript); `src/cost.ts` is the TS-side mirror —
`budgetForLane`, `laneBaseForLane`, `warnAt`/`stopAt` (1.5×/3× thresholds),
`budgetStatus`, `delegateAt`, and the normalized `costEnvelope` read model.
  `src/mission.ts` (archive cost section) consumes it instead of hardcoding
  lane budgets. Drift between the two sides is a CI failure, not a display
  nit: `test/cost.test.ts` asserts every constant against `lane-base.sh`
  (parity — same D5 pattern as `scripts/lane-base.ts`).

## Context accounting + budget (`src/context.ts`)

Phase 2 adds context measurement and bounds it. `savepoint.sh` measures
**tokens** and gates the lane token budget; it does **not** measure context —
so there is no shell-side context measurement to mirror, and `src/context.ts`
is the single definition. Context accounting runs on demand in TS, fed by the
trail on disk + the evidence registry.

- **Chars measure** — `measureContextChars` reuses `src/budget.ts` (single
  implementation, test-locked): the total byte footprint of the trail's
  markdown artifacts, i.e. the context a future reader must load.
- **Est-token ratio** — `estContextTokens(chars) = round(chars / 4)`, a coarse
  documented estimate (`ponytail:` comment — refine when provider token
  telemetry exists).
- **Budget gate** — `contextStatus` gates on `context_budget_chars` (chars),
  never on tokens: chars > budget → 'over', else 'ok'. Budget 0 → 'ok'. This
  keeps the context budget separate from the lane token budget (C2 — never
  conflated).
- `contextStatus` mirrors the archive-time closure throw condition, surfaced
  as a pure, tested gate.

## Investigation limits (`src/config.ts` + `src/investigation.ts`)

Investigation is bounded by three flat policy keys (spec §13), all optional
and commented out in `DEFAULT_CONFIG` (`readInvestigationConfig`, `src/config.ts`):

| Key | Default | Meaning |
|-----|---------|---------|
| `investigation_max_passes` | 2 | Cap on investigation passes |
| `investigation_max_unrelated_files` | 5 | Max unrelated files opened |
| `investigation_repeated_read_threshold` | 2 | Repeated reads before stopping |

Non-numeric or zero values fall back to the defaults. The state machine in
`src/investigation.ts` enforces these three limits plus an objective-met stop;
wiring the verdicts into the agent flow is Phase 3+ (Work Governor).

## Work Governor (`src/work.ts`)

Phase 3 turns the Phase-2 signals into auditable skip/avoid/delegate/complete
decisions. `src/work.ts` is the verdict engine — pure functions over explicit
inputs, each decision recorded via `recordWorkDecision` → `recordOptDecision`
(`## Cost governor decisions` trail, `work-governor` actor).

Six capabilities + record helper:

| Capability | Function | Verdict |
|------------|----------|---------|
| Stage classification (§7) | `classifyStage` | required/conditional/optional |
| Evidence-backed skipping (§7/§13) | `shouldSkipStage` | skip + explicit reason, never for required |
| Agent invocation control (§8) | `evaluateInvocation` | invoke only when unique + evidence cannot answer + stage cannot + value > cost |
| Skill loading control (§9) | `shouldLoadSkill` | load only when task/policy/dependency/verification requires |
| Delegation optimization (§30) | `evaluateDelegation` | delegate when ≥2 independent tasks, value > overhead floor, inside `delegateAt` budget |
| Completion detection (§19) | `completionCheck` | complete iff all five §19 conditions |
| Decision trail (§41) | `recordWorkDecision` | persists any verdict as a `work-governor` trail row |

**Delegation consumes the Phase-2 Q1 remainder:** `evaluateDelegation` calls
`delegateAt(budget, threshold_pct)` for the budget ceiling and
`laneBaseForLane(lane)` for the overhead floor — one delegate costs at least one
agent's context load.

**Honest boundary:** `src/work.ts` produces and records verdicts; the LLM crew
(workflow skill) is the only thing that acts on them. The module makes the
decision structured, auditable, and instructed — it does not force the model.

**Security design rules:** F2 — do not `registerRead` secret-bearing files
(`.env`, keys, tokens); fingerprints of secrets would persist in the trail. F3 —
`.mugiwara/` is local trusted state; if writers ever open `missionDir` to
untrusted input, validate it before passing to the record helpers.

## Scope & Code Governor (`src/scope.ts`)

Phase 4 delivers the **Scope & Code Governor** — scope drift detection,
existing-code reuse checks, abstraction justification, dependency justification,
minimum sufficient implementation policy, code waste detection, and change-surface
measurement. `src/scope.ts` is a pure verdict engine over explicit inputs, each
decision recorded via `recordScopeDecision` → `recordOptDecision`
(`## Cost governor decisions` trail, `scope-governor` actor). No new config keys;
`savepoint.sh`/`lane-base.sh`/`DEFAULT_CONFIG` untouched.

Eight capabilities + record helper:

| Capability | Function | Verdict |
|------------|----------|---------|
| Scope drift detection (§14/§51-1) | `detectScopeDrift` | `drift` + `scope_score` = fraction of touched files outside declared scope; reason names them |
| Existing-code reuse (§14/§51-2) | `checkExistingCodeReuse` | `reuse:true` only when existing code is present AND local modification is viable |
| Abstraction justification (§15/§51-3) | `evaluateAbstraction` | justified only when used in ≥2 places with duplication benefit, or required by contract — never speculative |
| Dependency justification (§16/§51-4) | `evaluateDependency` | justified only when no equivalent, not solvable with existing, long-term value, maintenance ≤ removal cost |
| Minimum sufficient policy (§15/§38/§51-5) | `minimumSufficientCheck` | `under` (missing verification/coverage) / `over` (incidental complexity) / `sufficient` |
| Code waste detection (§15/§51-6) | `detectCodeWaste` | `waste_types` lists helper/abstraction/wrapper/interface/config/dependency/generated code/refactor |
| Change-surface measurement (§5.4/§51-7) | `measureChangeSurface` | `loc_changed`; justified iff within declared scope and no new abstraction/dependency |
| Decision trail (§41) | `recordScopeDecision` | persists any verdict as a `scope-governor` trail row |

**Phase boundaries (honesty):** Phase 4 records the decisions and produces the
pure `measureChangeSurface` metrics only. The report/CLI code ledger
(`files_changed`, `LOC`, new abstractions/deps, `mugiwara cost` — §5.4/§39/§42)
is Phase 8 Reporting; the §21.11 code-slop taxonomy and §45 detect→classify→
intervene machinery (unnecessary abstraction/dependency) is Phase 6 Stop-Slop.
**Honest boundary:** `src/scope.ts` produces and records verdicts; the LLM crew
(workflow skill, rule 2b) is the only thing that acts on them. The module makes
the scope/code decision structured, auditable, and instructed — it does not
force the model.

**Security design rules:** F2 — do not `registerRead` secret-bearing files
(`.env`, keys, tokens); fingerprints of secrets would persist in the trail. F3 —
`.mugiwara/` is local trusted state; if writers ever open `missionDir` to
untrusted input, validate it before passing to the record helpers.

## Cognitive & Output Governor (`src/cognition.ts`)

Phase 5 delivers the **Cognitive & Output Governor** — focused reasoning policy, investigation termination, alternative limitation, output compression, duplicate explanation detection, and mission-focused output structure. `src/cognition.ts` is a pure verdict engine over explicit inputs, each decision recorded via `recordCognitiveDecision` → `recordOptDecision` (`## Cost governor decisions` trail, `cognitive-governor` actor). No new config keys; `savepoint.sh`/`lane-base.sh`/`DEFAULT_CONFIG` untouched.

Seven capabilities + record helper:

| Capability | Function | Verdict |
|------------|----------|---------|
| Focused reasoning policy (§17) | `isFocusedReasoning` | `focused` + `slop_types` (speculative_architecture/repeated_reconsideration/hypothetical_requirements/unrelated_implementations); reason names the slop |
| Investigation termination (§13/§17) | `shouldTerminateInvestigation` | `terminate` on triad complete or limits hit without concrete reason; `has_concrete_reason` overrides |
| Alternative limitation (§17) | `limitAlternatives` | `limited` + `dropped` when beyond `max_alternatives` (default 3) or without evidence backing; `bounded to N` |
| Output compression (§18) | `compressOutput` | `compressed` + `saved_chars` keeps only lines within 2 of an essential heading; `well_structured` ≥2 headings |
| Duplicate explanation detection (§17/§18) | `detectDuplicateExplanation` | `duplicate` + `duplicate_groups` via `fingerprint` grouping; exact duplicates only |
| Mission-focused structure (§18) | `structureOutput` | `well_structured` + `missing` (Decision/Evidence required); reason names missing or mission-focused |
| Decision trail (§41) | `recordCognitiveDecision` | persists any verdict as a `cognitive-governor` trail row |

**Phase boundaries (honesty):** Phase 5 records the decisions and produces pure verdicts only. The report/CLI cognition ledger (`reasoning focused vs slop`, `output compressed chars`, `duplicate explanations avoided` — §39/§43) is Phase 8 Reporting; the §21.3/§21.4 reasoning/output slop taxonomy and §45 detect→classify→intervene machinery is Phase 6 Stop-Slop. **Honest boundary:** `src/cognition.ts` produces and records verdicts; the LLM crew (workflow skill, rule 2c) is the only thing that acts on them. The module makes the cognitive/output decision structured, auditable, and instructed — it does not force the model.

**Security design rules:** F2 — do not fingerprint/register secret-bearing files (`.env`, keys); fingerprints of secrets would persist in the trail. F3 — `.mugiwara/` is local trusted state; if writers ever open `missionDir` to untrusted input, validate it before passing to the record helpers.

## Stop-Slop Governor (`src/slop.ts`)

Phase 6 delivers the **Stop-Slop Governor** — slop taxonomy, detection signals, progress measurement, work-to-cost anomaly, intervention rules, and six category detectors (retry, healing, scope, context, investigation, code). `src/slop.ts` is a pure verdict engine over explicit inputs, each decision recorded via `recordSlopDecision` → `recordOptDecision` (`## Cost governor decisions` trail, `slop-governor` actor). No new config keys; `savepoint.sh`/`lane-base.sh`/`DEFAULT_CONFIG` untouched.

Twelve capabilities + record helper:

| Capability | Function | Verdict |
|------------|----------|---------|
| Slop taxonomy (§21) | `SLOP_TAXONOMY` + `classifySlop` | eight §21 kinds; keyword match → `SlopKind` or `null` |
| Detection signals (§22) | `detectSlopSignal` | `slop` when `count ≥ threshold` with no evidence gain |
| Progress measurement (§23) | `measureProgress` | `progress` + `cost_delta` + `progress_per_cost`; `slop_signal` when cost grows without progress |
| Work-to-cost anomaly (§24) | `detectAnomaly` | `anomaly` when `progress_per_cost < baseline * drop_threshold` (default 0.5) |
| Intervention rules (§20) | `decideIntervention` | `tolerate`/`stop`/`compress`/`escalate` by `severity` + `progress_stalled` |
| Retry slop (§21.6/§31) | `detectRetrySlop` | `slop` when same action + same evidence + same failure → STOP |
| Healing slop (§21.7/§32) | `detectHealingSlop` | `slop` when no fixes with previous zero-fix or `cycle ≥ max` |
| Scope slop (§21.8) | `detectScopeSlop` | `slop` when out-of-scope file or unrelated refactor without `acceptance_expanded` |
| Context slop (§21.2/§12) | `detectContextSlop` | `slop` when repeated reads ≥ threshold or duplicate chars or irrelevant files |
| Investigation slop (§21.1/§13) | `detectInvestigationSlop` | `slop` when any limit breached without `has_concrete_reason` |
| Code slop (§21.5/§15) | `detectCodeSlop` | `slop` when abstraction/dependency/boilerplate/LOC>100 without acceptance or justification |
| Decision trail (§41) | `recordSlopDecision` | persists any verdict as a `slop-governor` trail row |

**Phase boundaries (honesty):** Phase 6 records the decisions and produces pure verdicts only. The report/CLI slop ledger (`slop.events_detected`, `stopped`, `compressed` — §39) and Cost-section slop rows (§43) and `mugiwara cost` slop section (§42) are Phase 8 Reporting; the §45 benchmark suite is Phase 9. **Honest boundary:** `src/slop.ts` produces and records verdicts; the LLM crew (workflow skill, rule 2d) is the only thing that acts on them. The module makes the slop decision structured, auditable, and instructed — it does not force the model.

**Security design rules:** F2 — do not fingerprint/register secret-bearing files (`.env`, keys); fingerprints of secrets would persist in the trail. F3 — `.mugiwara/` is local trusted state; if writers ever open `missionDir` to untrusted input, validate it before passing to the record helpers.

## Adaptive Budget & Circuit Breaker (`src/adaptive-budget.ts`)

Phase 7 delivers the **Adaptive Budget & Circuit Breaker** — reservation, projection, adaptive budget, evidence-backed expansion, progressive thresholds, circuit breaker, and anomaly detection. `src/adaptive-budget.ts` is a pure verdict engine over explicit inputs, each decision recorded via `recordBudgetDecision` → `recordOptDecision` (`## Cost governor decisions` trail, `budget-governor` actor). No new config keys; `savepoint.sh`/`lane-base.sh`/`DEFAULT_CONFIG` untouched.

Seven capabilities + record helper:

| Capability | Function | Verdict |
|------------|----------|---------|
| Budget reservation (§25) | `reserveBudget` | `reserved` + `available = max(0, remaining - expected_max)` |
| Budget projection (§26) | `projectBudget` | `projected_min = current + remaining + conditional`, `projected_max = min + healing` |
| Adaptive budget (§27) | `evaluateExpansion` | `allowed` only when `has_evidence` + one valid flag (scope/security/test-surface/arch-dependency/healing) |
| Evidence-backed expansion (§27) | `evaluateExpansion` | `deny` on invalid reason (verbosity/reread/repeat/code) even with evidence |
| Progressive thresholds (§28) | `checkProgressiveThreshold` | `ok <60 → optimize ≥60 → aggressive ≥75 → protect ≥90 → pause ≥100 → warning ≥150 → stop ≥300` |
| Cost circuit breaker (§29) | `checkCircuitBreaker` | `tripped` when `actual ≥ 2× expected` with no progress/scope/evidence (ponytail: double-threshold) |
| Anomaly detection (§24) | `detectBudgetAnomaly` | `anomaly` when `tokens_delta ≥ 5000` with zero progress (re-consumes slop signal) |
| Decision trail (§41) | `recordBudgetDecision` | persists any verdict as a `budget-governor` trail row |

**Phase boundaries (honesty):** Phase 7 records the decisions and produces pure verdicts only. The report/CLI budget ledger (`budget.reserved`, `projected`, `remaining`, `avoided` — §26/§39) and `mugiwara cost` budget section (§42) and Cost-section budget rows (§43) are Phase 8 Reporting; the §45 benchmark suite is Phase 9. **Honest boundary:** `src/adaptive-budget.ts` produces and records verdicts; the LLM crew (workflow skill, rule 2e) is the only thing that acts on them. The module makes the budget decision structured, auditable, and instructed — it does not force the model.

**Security design rules:** F2 — do not fingerprint/register secret-bearing files (`.env`, keys); fingerprints of secrets would persist in the trail. F3 — `.mugiwara/` is local trusted state; if writers ever open `missionDir` to untrusted input, validate it before passing to the record helpers.

## Reporting & CLI (`src/reporting.ts`)

Phase 8 delivers **Reporting & CLI** — cost ledger, `mugiwara cost`, JSON output, Cost section in mission reports, avoided work accounting, cost efficiency metrics, and optimization decision trail. `src/reporting.ts` is a pure view over the three persisted files (`cost-events.jsonl`, `context-registry.jsonl`, `decisions.md` §41) — no new store. `buildCostLedger` aggregates envelope + events + registry + trail; `renderCostSection` renders the §43 Cost section; `toCostJSON` emits JSON (§42); `parseDecisionTrail`/`loadCostEvents`/`computeAvoidedMetrics`/`computeEfficiencyMetrics` are the pure helpers. No new config keys; `savepoint.sh`/`lane-base.sh`/`DEFAULT_CONFIG` untouched.

Seven capabilities + ledger view:

| Capability | Function | Output |
|------------|----------|--------|
| Cost ledger (§39) | `buildCostLedger` | `{ envelope, ledger: { events, registrySize, decisions }, avoided, efficiency, trail }` — view, recomputed at archive/CLI time |
| `mugiwara cost` CLI (§42) | `src/cli.ts:costCmd` | `mugiwara cost [--mission <id>] [--json] [--ledger]` — human (`Cost envelope / Avoided / Efficiency / Trail`) or `toCostJSON` JSON |
| JSON output (§42) | `toCostJSON` | `JSON.stringify(ledger, null, 2)` with stable key order |
| Cost section in reports (§43) | `renderCostSection` + `src/mission.ts` archive | `archives/mission/report.md` `## Cost` now includes `Budget / Context / Avoided / Efficiency / Trail` rows (ledger view) |
| Avoided work accounting (§39/§43) | `computeAvoidedMetrics` | `contexts_avoided = dup+repeated`, `stages_avoided`, `slop_interventions`, `tokens_avoided_est = contexts*150` (ponytail heuristic) |
| Cost efficiency metrics (§39) | `computeEfficiencyMetrics` | `reuse_rate`, `duplicate_avoidance_chars`, `budget_efficiency_pct` |
| Optimization decision trail (§41) | `parseDecisionTrail` + `recordOptDecision` | bullets under `## Cost governor decisions` parsed, rendered (truncated to 5 + `… n more`), folded at archive |

**Phase boundaries (honesty):** Phase 8 computes and renders the ledger only; the §45 benchmark suite (cost/Stop-Slop/large-repo/long-mission/runaway + §48 thresholds) is Phase 9. **Honest boundary:** `src/reporting.ts` computes and renders; the LLM crew (workflow skill, rule 2f) is the only thing that acts on the underlying signals — the module proves whether the crew was efficient, it does not force efficiency.

**Security design rules:** F2 — `loadRegistry` selective-drop shape validation (malformed lines dropped, never whole registry discarded) + never fingerprint secret-bearing files (`.env`, keys); F3 — every `missionDir` FS helper (`loadRegistry`, `persistRegistry`, `appendCostEvent`, `recordOptDecision`, `loadCostEvents`, `parseDecisionTrail`, `buildCostLedger`) asserts `missionDir` allowlist (`.mugiwara/missions/<id>` or `mugiwara-` tmp harness) — `Invalid missionDir` otherwise. Phase 8 closes the two Lows carried since Phase 2.

