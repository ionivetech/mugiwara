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
