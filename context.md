# PLAN.md — Native Cost Governor & Slop Control

**Project:** Mugiwara
**Initiative:** Native Cost Governor
**Status:** Planned
**Scope:** Native Mugiwara capability
**Primary Goal:** Minimize unnecessary AI work while preserving correctness, quality, security, evidence, and delivery confidence.

---

# 1. Objective

Build a native **Cost Governor** that makes Mugiwara inherently efficient when executing software engineering work.

The Cost Governor must control not only token consumption, but the amount of **unnecessary work** performed by the AI.

It must continuously answer:

> **Is this work necessary to complete the mission correctly?**

If the answer is no, Mugiwara should avoid it.

The system must optimize:

- workflow
- agent invocation
- stage execution
- context
- investigation
- reasoning
- output
- code
- scope
- dependencies
- retries
- healing
- delegation
- evidence
- trail size

The objective is:

```text
Correct result
+
Required verification
+
Required evidence
+
Minimum necessary AI work
```

Cost optimization must never mean reducing engineering quality.

---

# 2. Core Principle

Mugiwara should follow:

> **Do the smallest amount of AI work necessary to produce the strongest justified engineering result.**

This applies to every layer.

```text
Don't run what isn't needed.
Don't read what isn't needed.
Don't investigate what isn't needed.
Don't think about what isn't needed.
Don't explain what isn't needed.
Don't build what isn't needed.
Don't retry what isn't productive.
Don't heal what isn't progressing.
Don't delegate what isn't worth delegating.
Don't keep working after the mission is proven complete.
```

---

# 3. Current Foundation

Mugiwara already contains several primitives that can become the foundation of the Cost Governor:

- Direct / Lean / Standard / Full lanes
- lane budgets
- mission token tracking
- budget thresholds
- delegation threshold
- three-layer skill disclosure
- context budget
- healing limits
- configurable verbosity
- evidence/trail mechanisms
- stage-based crew workflow

The implementation should **extend and unify these capabilities**, not create competing parallel systems.

---

# 4. Cost Governor Architecture

```text
                         Mission
                            │
                            ▼
                         Luffy
                          Triage
                            │
                            ▼
                   ┌─────────────────┐
                   │  COST GOVERNOR  │
                   ├─────────────────┤
                   │ Work            │
                   │ Context         │
                   │ Cognition       │
                   │ Scope           │
                   │ Code            │
                   │ Output          │
                   │ Delegation      │
                   │ Retry           │
                   │ Healing         │
                   │ Slop Detection  │
                   │ Budget          │
                   └────────┬────────┘
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
           Lane          Execution       Gates
             │              │              │
             └──────────────┼──────────────┘
                            ▼
                       Mission Result
```

The Cost Governor is a **control layer**, not another crew member.

---

# 5. Cost Dimensions

The governor must measure cost across multiple dimensions.

## 5.1 Token Cost

Track:

```text
planned
reserved
actual
remaining
projected
overrun
avoided
```

---

## 5.2 Context Cost

Track:

```text
files loaded
bytes loaded
estimated context tokens
repeated reads
duplicate content
irrelevant content
trail context
command output
test output
```

---

## 5.3 Work Cost

Track:

```text
stages executed
stages skipped
agents invoked
agents avoided
skills loaded
skills avoided
commands executed
investigation passes
```

---

## 5.4 Code Cost

Track:

```text
files changed
LOC added
LOC removed
LOC changed
new abstractions
new dependencies
new files
generated boilerplate
```

Code size is not inherently bad.

The governor must detect **unnecessary code**, not blindly minimize LOC.

---

# 6. Cost Profile

Every mission should have a cost profile.

Example:

```yaml
cost:
  mode: balanced

  budget:
    max_tokens: 25000

  context:
    mode: adaptive
    max_chars: 120000

  investigation:
    max_passes: 2

  scope:
    mode: minimal

  output:
    mode: concise

  retry:
    mode: progressive

  healing:
    max_cycles: 3

  slop:
    detection: true
```

Supported modes:

```text
minimal
balanced
strict
```

Default:

```text
balanced
```

---

# 7. Work Efficiency Governor

Before executing a stage, Mugiwara should determine:

```text
Is this stage necessary?
Does it materially reduce uncertainty?
Does it provide required evidence?
Does it protect quality/security?
```

Stages should be classified:

```text
required
conditional
optional
```

Only required or justified conditional work should execute.

Every skipped stage must have an explicit reason.

Example:

```text
Stage: Brainstorm
Decision: skipped

Reason:
Requirements are explicit and implementation is localized.

Evidence:
E004
```

---

# 8. Agent Invocation Control

An agent must not be invoked simply because it exists in the crew.

Before invocation:

```text
Does this agent have unique responsibility here?
Can existing evidence answer this?
Can the current stage safely perform the work?
Is the expected value greater than the invocation cost?
```

Example:

```text
Security-sensitive auth change
→ security review required

Simple text change
→ security review unnecessary
```

---

# 9. Skill Loading Optimization

Mugiwara should load the minimum sufficient skills.

Use the existing layered skill disclosure system.

Prefer:

```text
task
 ↓
required capability
 ↓
specific skill
```

over:

```text
task
 ↓
load all skills
```

Skills should be loaded only when:

- required by the task
- required by policy
- required by a discovered dependency
- required by a failing verification

---

# 10. Context Governor

The governor should construct **minimum sufficient context**.

Priority:

```text
P0 — directly relevant files
P1 — direct dependencies
P2 — affected tests
P3 — configuration
P4 — related implementation
P5 — historical/broad repository context
```

Do not load lower-priority context until higher-priority context is insufficient.

---

# 11. Context Reuse

Evidence discovered once should be reused.

Instead of:

```text
Agent A reads file
Agent B reads file
Agent C reads file
Agent D reads file
```

use:

```text
Agent A
  ↓
Evidence E012
  ↓
Agent B/C/D reuse E012
```

Evidence should have stable references.

Example:

```text
E012
src/auth/middleware.ts:42-91
```

Agents should reference existing evidence rather than reproducing it.

---

# 12. Context Deduplication

Detect:

- repeated file reads
- repeated symbols
- repeated command output
- repeated test output
- repeated git diff
- repeated evidence
- duplicated agent responses

If the same information is already available:

```text
reuse
```

instead of:

```text
read again
```

---

# 13. Investigation Governor

AI must not investigate indefinitely.

Introduce limits:

```yaml
investigation:
  max_passes: 2
  max_unrelated_files: 5
  repeated_read_threshold: 2
```

Investigation must stop when:

```text
acceptance criteria mapped
+
affected surface understood
+
implementation path established
```

Further exploration requires a concrete reason.

---

# 14. Scope Governor

Mugiwara should prefer the smallest correct scope.

Before expanding implementation:

```text
Can existing code solve this?
Can an existing utility be reused?
Can an existing component be modified?
Can this remain local?
Is a new abstraction actually required?
Is a new dependency actually required?
```

Default rule:

> Prefer reuse and local modification over introducing new architecture.

---

# 15. Code Minimization

The governor should actively prevent unnecessary implementation.

Detect:

```text
unnecessary helper
unnecessary abstraction
unnecessary wrapper
unnecessary interface
unnecessary configuration
unnecessary dependency
unnecessary generated code
unnecessary refactor
```

The system should distinguish:

```text
necessary complexity
```

from:

```text
incidental complexity
```

Do not optimize for minimum LOC at the expense of maintainability.

The target is:

> **Minimum sufficient code.**

---

# 16. Dependency Discipline

Before adding a dependency:

```text
Is equivalent functionality already available?
Can the requirement be solved with existing dependencies?
Is the dependency justified by long-term value?
Does the dependency introduce more maintenance cost than it removes?
```

A new dependency should require explicit justification.

---

# 17. Cognitive Efficiency

Agent reasoning should remain focused on the mission.

Agents should avoid:

- speculative architecture
- unrelated edge cases
- hypothetical future requirements
- repeated reconsideration
- unnecessary alternatives
- explaining obvious decisions
- exploring unrelated implementations

Reasoning should follow:

```text
Question
 ↓
Evidence
 ↓
Decision
 ↓
Action
```

rather than:

```text
Question
 ↓
many possibilities
 ↓
many hypothetical possibilities
 ↓
more possibilities
 ↓
eventual decision
```

---

# 18. Output Efficiency

Agent output should prioritize useful information.

Preferred structure:

```text
Decision
Action
Result
Evidence
Blocker
```

Avoid:

- repeated context
- repeated conclusions
- unnecessary narration
- verbose summaries
- speculative commentary
- duplicate explanations

The full execution trail remains available for audit.

The interactive output should remain concise.

---

# 19. Completion Detection

Mugiwara must know when enough work has been done.

A mission should be considered ready for closure when:

```text
acceptance criteria satisfied
+
required implementation complete
+
required tests complete
+
required quality gates complete
+
required evidence collected
```

Once these conditions are satisfied:

```text
STOP
```

Do not continue exploring merely because more exploration is possible.

---

# 20. Stop-Slop System

Introduce a native **Stop-Slop** mechanism.

Stop-Slop exists to detect and prevent work that consumes AI resources without producing meaningful engineering value.

It applies continuously throughout the mission.

```text
                    WORK
                     │
                     ▼
              Is it producing
               useful progress?
                /          \
              YES           NO
               │             │
               ▼             ▼
           continue      classify slop
                             │
                ┌────────────┼────────────┐
                ▼            ▼            ▼
             harmless      wasteful     harmful
                │            │            │
             tolerate       stop        stop/escalate
```

---

# 21. Slop Categories

## 21.1 Investigation Slop

Examples:

```text
reading unrelated files
searching without narrowing
repeated repository exploration
looking for hypothetical future issues
```

Action:

```text
stop investigation
return to mission objective
```

---

## 21.2 Context Slop

Examples:

```text
duplicated context
irrelevant files
repeated command output
old evidence that no longer matters
```

Action:

```text
discard
compress
reuse reference
```

---

## 21.3 Reasoning Slop

Examples:

```text
repeated reconsideration
unbounded alternatives
speculative architecture
hypothetical requirements
```

Action:

```text
force decision based on available evidence
```

---

## 21.4 Output Slop

Examples:

```text
repeating the same conclusion
long narration
restating the user's request
explaining obvious implementation details
```

Action:

```text
compress output
```

---

## 21.5 Code Slop

Examples:

```text
unnecessary abstraction
unused helper
duplicate utility
unnecessary wrapper
unnecessary refactor
boilerplate
```

Action:

```text
remove
simplify
reuse existing implementation
```

---

## 21.6 Retry Slop

Examples:

```text
same command
same change
same test
same hypothesis
```

Action:

```text
STOP
```

unless new evidence exists.

---

## 21.7 Healing Slop

Examples:

```text
multiple healing cycles with no progress
fixing symptoms without new evidence
repeating failed approaches
```

Action:

```text
stop healing
escalate or close as blocked
```

---

## 21.8 Scope Slop

Examples:

```text
unrelated refactor
cleanup outside task
architecture modernization
style changes unrelated to acceptance criteria
```

Action:

```text
reject scope expansion
```

unless explicitly justified.

---

# 22. Slop Detection Signals

The governor should use measurable signals.

Examples:

```text
same file read N times
same command repeated
same test repeated without code changes
token usage increases without evidence increase
context increases without scope increase
LOC increases without acceptance criteria expansion
new abstraction appears without justification
new dependency appears without requirement
agent output repeats previous output
investigation continues after acceptance mapping is complete
```

No single signal should automatically classify legitimate work as slop.

Use multiple signals where possible.

---

# 23. Progress Measurement

Introduce a lightweight progress model.

Track:

```text
evidence gained
criteria satisfied
files understood
tests fixed
implementation completed
blockers removed
```

Compare progress against consumption.

Example:

```text
Before:
  8k tokens
  4 evidence items
  2 criteria mapped

After:
  +5k tokens
  +0 evidence
  +0 criteria
  +0 code
```

This is a strong slop signal.

The governor should intervene.

---

# 24. Work-to-Cost Ratio

Track:

```text
useful progress
----------------
AI consumption
```

The metric should not be treated as an absolute quality score.

It is an anomaly signal.

A sudden drop can indicate:

- investigation slop
- context slop
- reasoning loop
- retry loop
- scope drift
- ineffective healing

---

# 25. Budget Reservation

Before expensive stages:

```text
remaining budget
       ↓
reserve expected maximum
       ↓
execute
       ↓
release unused reservation
```

Example:

```text
Remaining: 14k

Review:
expected 2k
maximum 4k

Reserve 4k

Available execution budget:
10k
```

This protects later mandatory stages.

---

# 26. Budget Projection

Continuously calculate:

```text
current usage
+
remaining required work
+
expected conditional work
+
possible healing
=
projected final cost
```

Example:

```text
Current: 11.2k

Projected:
Audit       2k
Quality   2.5k
Review      2k
Healing   0–5k

Final:
18.7–23.7k
```

The governor can then decide:

```text
continue
optimize
stop optional work
protect mandatory work
pause
```

---

# 27. Adaptive Budget

Budget may expand only when evidence justifies it.

Valid reasons:

```text
scope legitimately expanded
security-sensitive path discovered
test surface larger than expected
architecture dependency discovered
legitimate healing required
```

Invalid reasons:

```text
agent was verbose
agent explored unrelated files
agent reread context
agent repeated itself
agent generated unnecessary code
```

---

# 28. Budget Escalation

Suggested thresholds:

```text
60%
→ optimization mode

75%
→ aggressive optimization

90%
→ protect mandatory work

100%
→ pause / controlled continuation

150%
→ hard warning

300%
→ hard stop
```

Thresholds remain configurable.

---

# 29. Cost Circuit Breaker

Stop execution when consumption becomes abnormal.

Example:

```text
Expected: 13k
Current: 26k

No scope expansion
No new evidence
No meaningful progress
```

Result:

```text
COST_CIRCUIT_BREAKER
```

Mission should pause or escalate rather than continue blindly.

---

# 30. Delegation Governor

Delegation must consider overhead.

Use:

```text
parallel work value
>
delegation overhead
```

Do not delegate tiny tasks.

Delegate when:

```text
tasks are sufficiently independent
+
parallelism saves meaningful work/time
+
delegation overhead is justified
```

---

# 31. Retry Governor

Every retry requires a reason.

Classify:

```text
transient
environment
implementation
test
reasoning
unknown
```

Same action + same evidence + same failure:

```text
STOP
```

New attempt requires:

```text
new evidence
OR
new hypothesis
OR
changed environment
```

---

# 32. Healing Governor

Healing must be progress-driven.

Example:

```text
Cycle 1
+3 useful fixes

Cycle 2
+1 useful fix

Cycle 3
+0 useful fixes
```

Stop.

Do not consume another cycle simply because the configured maximum has not been reached.

---

# 33. Evidence Reuse

All useful evidence should become reusable mission state.

Example:

```text
E001 → affected API
E002 → relevant component
E003 → failing test
E004 → security boundary
```

Agents consume evidence references instead of rediscovering the same information.

---

# 34. Stage Optimization

The governor should understand stage relationships.

Example:

```text
Requirements clear
↓
Brainstorm unnecessary

No security-sensitive changes
↓
Security review conditional/skip

No frontend changes
↓
Frontend-specific investigation unnecessary
```

Every optimization decision must be auditable.

---

# 35. Lane Integration

Do not replace existing lanes.

Use:

```text
Lane
 ↓
initial cost envelope
 ↓
Cost Governor
 ↓
adaptive execution
```

The governor may:

```text
tighten execution
remain
expand
recommend escalation
```

based on evidence.

---

# 36. Lane Escalation

Escalation should happen because the nature of the work changed.

Example:

```text
Lean task
 ↓
authentication boundary discovered
 ↓
risk increased
 ↓
required security verification
 ↓
expand/escalate
```

Do not escalate because an agent is merely confused.

---

# 37. Security Protection

Cost optimization must never bypass mandatory security controls.

If security verification is required:

```text
budget low
+
security check mandatory
```

Result:

```text
protect security work
```

not:

```text
skip security work
```

If insufficient budget remains:

```text
pause
```

rather than silently weakening the control.

---

# 38. Quality Protection

The governor may optimize:

```text
context
investigation
verbosity
agent count
stage selection
retry behavior
```

It may not remove mandatory:

```text
tests
quality gates
security checks
acceptance verification
required evidence
```

---

# 39. Cost Ledger

Introduce a normalized mission cost ledger.

Example:

```json
{
  "mission": "add-search-filter",
  "budget": {
    "planned": 25000,
    "reserved": 22000,
    "used": 14200,
    "remaining": 10800,
    "projected": 18100
  },
  "context": {
    "estimated_tokens": 9800,
    "duplicate_tokens": 700,
    "avoided_tokens": 3200
  },
  "work": {
    "stages_executed": 6,
    "stages_skipped": 2,
    "agents_invoked": 7,
    "agents_avoided": 2
  },
  "slop": {
    "events_detected": 3,
    "events_stopped": 2,
    "events_compressed": 1
  },
  "healing": {
    "cycles": 1,
    "avoided_cycles": 1
  }
}
```

Follow Mugiwara's existing state conventions.

Do not create an incompatible parallel state system.

---

# 40. Avoided Work Accounting

Mugiwara should measure work it intentionally avoided.

Example:

```text
Baseline estimate:
22k

Actual:
14k

Avoided:
~8k
```

Breakdown:

```text
Stage skipping          2.0k
Context reuse           2.1k
Investigation control   1.4k
Agent avoidance         0.9k
Code simplification     0.8k
Retry prevention        0.5k
Output compression      0.3k
```

Estimates must be clearly marked as estimates.

---

# 41. Optimization Decision Trail

Every meaningful optimization decision should be inspectable.

Example:

```text
COST GOVERNOR

Decision: skip Brainstorm
Reason: requirements unambiguous
Evidence: E002

Decision: reuse E014
Reason: required source already inspected
Evidence: E014

Decision: stop investigation
Reason: acceptance criteria fully mapped
Evidence: E019

Decision: reject new helper
Reason: existing utility is sufficient
Evidence: E021

Decision: stop healing
Reason: no progress in previous cycle
```

This makes optimization trustworthy.

---

# 42. CLI

Add:

```bash
mugiwara cost <mission>
```

Example:

```text
Mission: add-search-filter

Budget
  Planned       25,000
  Used          14,200
  Remaining     10,800
  Projected     18,100

Work
  Stages            6 executed / 2 skipped
  Agents            7 invoked / 2 avoided

Context
  Used              9,800
  Duplicate           700
  Avoided           3,200

Slop
  Detected              3
  Prevented             2
  Compressed             1

Healing
  Cycles                 1
  Avoided                 1
```

JSON:

```bash
mugiwara cost <mission> --json
```

---

# 43. Mission Report

Add a Cost section to the mission report.

```markdown
## Cost

| Metric            |  Value |
| ----------------- | -----: |
| Planned           | 25,000 |
| Used              | 14,200 |
| Projected         | 18,100 |
| Estimated avoided | ~7,800 |
| Context           |  9,800 |
| Duplicate context |    700 |
| Agents invoked    |      7 |
| Agents avoided    |      2 |
| Stages executed   |      6 |
| Stages skipped    |      2 |
| Slop events       |      3 |
| Healing cycles    |      1 |

### Optimization decisions

- Brainstorm skipped because requirements were unambiguous.
- Existing evidence reused instead of rereading source files.
- Investigation stopped after affected surface was established.
- New helper rejected because existing utility was sufficient.
- Healing stopped after no additional progress.

### Quality protection

- Required gates executed.
- Required tests executed.
- Required security controls preserved.
- No acceptance criteria removed.
```

---

# 44. Cost Efficiency Score

Do not optimize purely for token count.

Measure:

```text
useful verified result
----------------------
AI consumption
```

A cheaper failed mission is worse than a slightly more expensive successful mission.

Therefore:

```text
Correctness
Evidence
Quality
Security
Completion
```

must be evaluated before cost efficiency.

---

# 45. Stop-Slop Evaluation

Create dedicated benchmark scenarios:

1. endless repository exploration
2. repeated file reading
3. repeated command execution
4. repeated failed test
5. repeated reasoning
6. unnecessary abstraction
7. unnecessary dependency
8. unrelated refactor
9. verbose output
10. no-progress healing
11. premature completion
12. excessive context expansion

Expected behavior:

```text
detect
→ classify
→ intervene
→ continue only when justified
```

---

# 46. Testing Strategy

## Unit Tests

Test:

- budget calculation
- budget reservation
- budget projection
- threshold behavior
- stage eligibility
- stage skipping
- agent invocation decisions
- context deduplication
- evidence reuse
- investigation bounds
- scope detection
- unnecessary abstraction detection
- dependency justification
- retry classification
- healing progress
- slop classification
- progress measurement
- anomaly detection
- circuit breaker
- avoided-cost calculation

---

# 47. Integration Tests

## Case 1 — Trivial Change

Expected:

```text
Direct
minimal work
no unnecessary agents
minimal context
```

## Case 2 — Small Bug

Expected:

```text
Lean
bounded investigation
minimal context
no unnecessary stages
```

## Case 3 — Standard Feature

Expected:

```text
Standard
required verification preserved
conditional work optimized
```

## Case 4 — Security Change

Expected:

```text
security verification preserved
```

## Case 5 — Repository Exploration Loop

Expected:

```text
Stop-Slop intervention
investigation stopped
```

## Case 6 — Duplicate Reads

Expected:

```text
evidence reused
duplicate context avoided
```

## Case 7 — Repeated Retry

Expected:

```text
retry stopped
```

## Case 8 — No-Progress Healing

Expected:

```text
healing stopped
```

## Case 9 — Unnecessary Abstraction

Expected:

```text
simpler implementation preferred
```

## Case 10 — Scope Drift

Expected:

```text
unrelated work rejected
```

---

# 48. Cost Benchmark

Create a representative workload suite.

Each benchmark should define:

```text
task
expected lane
required stages
expected evidence
acceptable cost range
acceptable context range
expected changed surface
required quality gates
```

Measure:

```text
token consumption
context consumption
agent invocations
stage executions
retry count
healing count
LOC
scope expansion
slop events
correctness
evidence completeness
```

---

# 49. Regression Rules

A release must not be considered successful merely because it reduces tokens.

Regression occurs when:

```text
cost decreases
BUT
correctness decreases

OR

required evidence decreases

OR

security coverage decreases

OR

quality gates are skipped

OR

scope becomes incorrectly under-implemented
```

Cost improvements are valid only when engineering confidence is preserved.

---

# 50. Documentation

Add:

```text
docs/cost-governor.md
docs/cost-model.md
docs/stop-slop.md
docs/cost-debugging.md
docs/cost-evaluation.md
```

Update:

```text
README.md
ROADMAP.md
configuration documentation
lane documentation
policy documentation
mission report documentation
```

Documentation should explain:

- what Cost Governor does
- how optimization decisions are made
- how Stop-Slop works
- how budgets are calculated
- how users override behavior
- how to inspect mission cost
- how to debug an optimization decision

---

# 51. Implementation Phases

## Phase 1 — Cost Governor Foundation

1. Create Cost Governor domain/module.
2. Normalize existing cost state.
3. Centralize budget calculations.
4. Centralize threshold handling.
5. Introduce cost events.
6. Introduce optimization decision records.
7. Preserve existing behavior.
8. Add regression tests.

---

## Phase 2 — Context Governor

1. Context accounting.
2. Context budget enforcement.
3. Duplicate detection.
4. Evidence references.
5. Evidence reuse.
6. Investigation limits.
7. Context efficiency metrics.

---

## Phase 3 — Work Governor

1. Required/conditional/optional stage classification.
2. Evidence-backed stage skipping.
3. Agent invocation control.
4. Skill loading control.
5. Delegation optimization.
6. Completion detection.

---

## Phase 4 — Scope & Code Governor

1. Scope drift detection.
2. Existing-code reuse checks.
3. Abstraction justification.
4. Dependency justification.
5. Minimum sufficient implementation policy.
6. Code waste detection.
7. Change-surface measurement.

---

## Phase 5 — Cognitive & Output Governor

1. Focused reasoning policy.
2. Investigation termination.
3. Alternative limitation.
4. Output compression.
5. Duplicate explanation detection.
6. Mission-focused output structure.

---

## Phase 6 — Stop-Slop

1. Slop taxonomy.
2. Detection signals.
3. Progress measurement.
4. Work-to-cost anomaly detection.
5. Intervention rules.
6. Retry slop detection.
7. Healing slop detection.
8. Scope slop detection.
9. Context slop detection.
10. Investigation slop detection.
11. Code slop detection.

---

## Phase 7 — Adaptive Budget & Circuit Breaker

1. Budget reservation.
2. Budget projection.
3. Adaptive budget.
4. Evidence-backed budget expansion.
5. Progressive thresholds.
6. Cost circuit breaker.
7. Anomaly detection.

---

## Phase 8 — Reporting & CLI

1. Cost ledger.
2. `mugiwara cost`.
3. JSON output.
4. Cost section in mission reports.
5. Avoided work accounting.
6. Cost efficiency metrics.
7. Optimization decision trail.

---

## Phase 9 — Benchmark & Hardening

1. Cost benchmark suite.
2. Stop-Slop benchmark suite.
3. Large repository tests.
4. Long mission tests.
5. Runaway execution tests.
6. Regression thresholds.
7. Cross-platform verification.
8. CI enforcement.
9. Documentation completion.

---

# 52. Configuration Philosophy

Do not expose every internal decision as configuration.

The default system should be smart enough to work automatically.

Configuration should exist for:

```text
policy boundaries
budget limits
risk tolerance
strictness
user overrides
```

Not for micromanaging every optimization decision.

---

# 53. User Overrides

Users may explicitly override optimization.

Examples:

```text
"Use aggressive cost optimization."

"Do a deeper investigation."

"Spend the remaining budget and perform a deeper review."

"Do not optimize this mission."

"Stop if projected cost exceeds 20k."
```

Overrides must be recorded in the mission trail.

---

# 54. Non-Goals

This initiative does NOT implement:

- model routing
- model selection
- provider selection
- automatic model downgrade
- automatic model upgrade
- pricing intelligence
- provider economics
- external cost management
- external AI optimization dependencies
- automatic billing management

Those may become future initiatives.

---

# 55. Future Architecture

The Cost Governor should expose clean extension points.

```text
                    MUGIWARA
                 COST GOVERNOR
                        │
        ┌───────────────┼────────────────┐
        │               │                │
      Native          Policy          Evidence
    Optimization      Control          System
        │
 ┌──────┼────────┬──────────┬───────────┐
 ▼      ▼        ▼          ▼           ▼
Work  Context  Cognition  Scope      Stop-Slop
```

Future systems may consume these signals without becoming dependencies of the core governor.

---

# 56. Definition of Done

## Cost

- [ ] every mission has a cost envelope
- [ ] planned/reserved/actual/projected costs are tracked
- [ ] adaptive budget works
- [ ] abnormal consumption triggers protection
- [ ] budget expansion requires justification

## Work

- [ ] unnecessary stages can be skipped
- [ ] unnecessary agents can be avoided
- [ ] unnecessary skills can be avoided
- [ ] delegation considers overhead
- [ ] completion detection prevents unnecessary continuation

## Context

- [ ] context consumption is measurable
- [ ] duplicate context is detected
- [ ] evidence can be reused
- [ ] investigation is bounded
- [ ] context budget is enforceable

## Cognition

- [ ] speculative investigation is controlled
- [ ] unnecessary alternatives are controlled
- [ ] reasoning remains mission-focused
- [ ] unnecessary narration is reduced

## Scope & Code

- [ ] scope drift is detected
- [ ] unnecessary abstractions are detected
- [ ] unnecessary dependencies are discouraged
- [ ] minimum sufficient implementation is preferred
- [ ] unnecessary code can be detected

## Stop-Slop

- [ ] investigation slop is detected
- [ ] context slop is detected
- [ ] reasoning slop is detected
- [ ] output slop is detected
- [ ] code slop is detected
- [ ] retry slop is detected
- [ ] healing slop is detected
- [ ] scope slop is detected
- [ ] no-progress work can be stopped

## Safety & Quality

- [ ] mandatory security checks are protected
- [ ] mandatory quality gates are protected
- [ ] required tests are protected
- [ ] required evidence is protected
- [ ] optimization cannot silently reduce acceptance criteria

## Observability

- [ ] cost ledger exists
- [ ] optimization decisions are auditable
- [ ] avoided work is measurable
- [ ] `mugiwara cost` exists
- [ ] mission reports contain cost information

## Validation

- [ ] unit tests pass
- [ ] integration tests pass
- [ ] cost benchmarks pass
- [ ] Stop-Slop benchmarks pass
- [ ] runaway execution tests pass
- [ ] large repository tests pass
- [ ] documentation is complete

---

# 57. Success Criteria

The Cost Governor is successful when Mugiwara demonstrates:

```text
Less unnecessary context
+
Less unnecessary agent work
+
Less unnecessary investigation
+
Less unnecessary reasoning
+
Less unnecessary output
+
Less unnecessary code
+
Less unnecessary scope
+
Less unnecessary retries
+
Less unnecessary healing
+
Less unnecessary delegation
+
Less unnecessary workflow
```

while maintaining:

```text
Correctness
+
Security
+
Quality
+
Required evidence
+
Acceptance criteria
+
Engineering confidence
```

---

# 58. Final Product Principle

Mugiwara should behave like this:

```text
User
 │
 ▼
Mission
 │
 ▼
Understand the objective
 │
 ▼
Determine the minimum sufficient work
 │
 ▼
Load the minimum sufficient context
 │
 ▼
Use the minimum sufficient agents
 │
 ▼
Investigate only until uncertainty is resolved
 │
 ▼
Implement the minimum sufficient change
 │
 ▼
Verify the required result
 │
 ▼
Stop unnecessary work
 │
 ▼
Produce evidence
 │
 ▼
Close
```

The desired outcome is not:

> "Mugiwara uses fewer tokens."

The desired outcome is:

> **Mugiwara wastes less AI work.**

Token reduction is a consequence.

The real product capability is **engineering work efficiency under AI execution**.
