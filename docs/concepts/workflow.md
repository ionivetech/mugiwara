# The Wave Pipeline

A mission runs as ten waves (plus one optional adversarial pass). Each wave is
owned by one crew member and runs **inline** in the main conversation.

| Wave | Owner | Skill | Output |
|------|-------|-------|--------|
| 0 Triage | Luffy | `mugiwara-orchestration` | 5-way route decision + reason |
| 1 Brainstorm | Usopp | `mugiwara-brainstorm` | refined direction, options, recommendation |
| 2 Planning | Nami | `mugiwara-planning` | plan doc: waves, tasks, acceptance criteria |
| 3 Execution | Zoro | `mugiwara-execution` | implemented tasks with evidence |
| 4 Checkpoint | Chopper | `mugiwara-checkpoint` | audit report + failure ledger |
| 4.5 Adversarial | Skeptic | `mugiwara-claim-audit` | findings report (optional) |
| 5 Quality | Sanji | `mugiwara-quality` | format/lint/test/duplication/complexity/maintainability results |
| 6 Gates | Franky | `mugiwara-gates` | coverage + build + DoD + per-condition sonar gate |
| 7 Review | Robin ∥ Jinbe | `mugiwara-review` + `mugiwara-security` | severity-tagged findings |
| 8 Healing | Brook | `mugiwara-healing` | fixes; loops back to Wave 4, max 3 cycles |
| 9 Closure | Luffy | `mugiwara-orchestration` | closure report + push + PR verdict handed to you |

## Wave 0 — Triage

Every mission starts at the Luffy gateway, which classifies the request 5 ways
and sizes it to a **lane**:

| Class | Signal | Route |
|-------|--------|-------|
| Trivial | one obvious small change, no ambiguity | Lane 0/1 — Wave 2 directly |
| Explicit | clear requirements, written spec exists | Wave 2 directly |
| Exploratory | needs direction, options, research | Wave 1 first |
| Open-ended | broad goal, undefined scope | Wave 1 first |
| Ambiguous | requirements, APIs, scope unclear | Wave 1 first |

A clear-work route straight to Wave 2 still writes a short **spec bridge** to
`.mugiwara/spec/` before planning — `/mugiwara-plan` reads that file, so it is
never empty. The decision + reason is logged in `.mugiwara/logs/`. Risk
(money/security/data/public API) always triggers the full pipeline and the
lane escalates automatically when the work outgrows the estimate — it never
auto-drops. See [lanes.md](lanes.md).

## Wave 4 — Checkpoint (Chopper)

The verify-everything gate. After execution, Chopper re-runs every acceptance
criterion — but efficiently:

- **Deduped**: each unique check command runs once per wave, scoped to the
  files this wave changed. No running `npm test` once per task.
- **Scoped by diff**: `git diff --name-only <wave-base>..HEAD` decides what
  actually needs re-verification.
- **Commit hygiene**: one `git log --stat` pass, not per-commit.
- Failures land in the blocker ledger `.mugiwara/issues/` with honest
  code-vs-env classification.

## Wave 7 — Review

Robin (doubt-driven review) and Jinbe (security) run in parallel. Robin maps
breaking changes to callers before reading the diff, scores reliability rating
(A–E), and deep-reviews code attributes; Jinbe runs STRIDE + OWASP + hotspot
review + SCA license. Findings are severity-tagged with path:line.

## Wave 8 — Healing

Brook reads the blocker ledger and fixes root causes, proving each fix by
re-running the failed check. The loop returns to Wave 4 — max 3 cycles, then
escalation to you.

## Wave 9 — Closure

Luffy runs the ship gate, writes the closure report, deletes superseded
intermediate files, then the terminal step in every mode: **save-point commit →
push the mission branch → write the PR verdict file → hand branch + verdict to
you**, who opens the PR. The crew never creates a PR, merges, or deploys.

## The two rules that hold it together

1. **Evidence over claims.** No wave passes on assertion — the owning agent
   runs the checks and shows output. "Subagents lie. No evidence = not
   complete." A skipped wave is recorded in the decision log, never silent.
2. **The plan is the source of truth.** From Wave 2 on, the plan doc in
   `.mugiwara/plans/` holds the clean execution plan; the decision log holds the
   who-and-why trace.

**Every skill has a skip gate.** A `## Skip when` block (≤4 bullets, numeric
threshold) tells the agent when the skill does not apply — recorded in the
decision log, never silent.

## Blocker protocol

Any agent that hits a blocker appends a row
(`wave | task | symptom | attempted | help-needed`) to the ledger and escalates.
Never a silent workaround. Brook heals what the ledger lists.
