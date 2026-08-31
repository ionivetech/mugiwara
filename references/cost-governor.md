# Cost Governor — Terse & Low-Cost Execution

Single source for Work, Scope/Code, Cognitive/Output, Stop-Slop, Adaptive Budget, Benchmark. Verdicts recommended, not enforced; crew acts. Trail rows → `.mugiwara/missions/<mission>/decisions.md` → `## Cost governor decisions`. `savepoint`/`lane-base`/`config` untouched.

## Ladder — before adding code, run top to bottom, stop at first that holds

1. Does this need to exist at all? Speculative need → skip, one line why (YAGNI).
2. Already in codebase? Reuse helper/util/pattern nearby → reuse it.
3. Stdlib does it? Use it.
4. Native platform covers it? `<input type="date">` over picker lib, CSS over JS, DB constraint over app code → native.
5. Already-installed dependency solves it? Use it. Never add new dep for a few lines.
6. Can it be one line? One line.
7. Only then: minimum code that works. No unrequested abstraction (one impl → no interface/factory/config), no boilerplate for later, deletion over addition, fewest files, shortest diff.

Each step: grep callers first; fix root cause in shared function, not symptom in caller. One guard in shared path beats guards in every caller.

## Output — terse, deduped

Reasoning: Question → Evidence → Decision → Action. No speculative architecture, hypothetical requirements, repeated reconsideration, unrelated implementations. Investigation ends when `acceptance_mapped + surface_understood + path_established` or limits hit with concrete reason (§13). Alternatives ≤3, evidence-backed only.

Output: Decision / Action / Result / Evidence / Blocker only, mission-focused. Duplicate explanations fingerprinted and dropped. Every verdict → `cognitive-governor` trail row.

## Scope & code

Prefer smallest correct scope — reuse + local modification over new architecture (§14). Abstraction justified only when used in ≥2 places or required by contract, never speculative (§15). Dependency added only with explicit justification (§16). Minimum sufficient implementation, never minimum LOC at expense of verification/quality (§15/§38). Measure change surface. Code waste (unnecessary helper/abstraction/wrapper/interface/config/dependency/generated code/refactor) named. Trail row `scope-governor`.

## Slop — taxonomy, signals, measurement, intervention

Taxonomy 8 kinds (§21): investigation, context, reasoning, output, code, retry, healing, scope.

Signals (§22): repeated reads/commands, token-without-evidence, LOC-without-acceptance, abstraction-without-justification.

Measure (§23): evidence/criteria/tests/code vs cost delta — cost grows without progress → slop. Flag anomaly (§24): 5k tokens zero progress, work-to-cost drop.

Intervene (§20): tolerate / stop / compress / escalate by severity.

Detectors — six categories:
- retry §21.6/§31 same-action same-evidence same-failure → STOP
- healing §21.7/§32 no progress → stop; `heal_cycle ≥ 3` → halt
- scope §21.8 out-of-scope without acceptance → reject
- context §21.2 duplicate/irrelevant → discard/compress
- investigation §21.1 unbounded exploration → stop
- code §21.5 unnecessary abstraction/dependency/boilerplate → remove/simplify

Trail row `slop-governor`.

## Budget — reserve, projection, thresholds, breaker

Reserve expected max before expensive stages (Review/Security/Healing). Continuously project `current + remaining required + expected conditional + possible healing` (§26).

Expand only with evidence (§27 valid: scope legitimately expanded, security-sensitive path, test surface larger, architecture dependency, legitimate healing; invalid: verbosity/reread/repeat/unnecessary code).

Thresholds (§28): 60% → optimize, 75% → aggressive, 90% → protect, 100% → pause, 150% → warning, 300% → stop.

Breaker (§29): actual ≥ 2× expected without progress/scope/evidence → trip.

Anomaly (§24): flag 5k-zero-progress, re-consumes slop signal.

Record every non-ok verdict via `recordBudgetDecision` (§41). Trail row `budget-governor`. Ledger aggregates envelope+events+registry+trail; `mugiwara cost` surfaces ledger (--json); report Cost section renders ledger+avoided+efficiency+trail (§43).

## Benchmark & hardening

Tracks `scripts/benchmark-governor.ts` harness (deterministic, no network).

Cost suite (§48) — 4 workloads:
- lean-trivial: projected 8000 + overhead 1000, context ≤20000, evidence ≥1, surface 2 files 50 LOC
- standard-feature: projected 15000 + overhead 1500, context ≤40000, evidence ≥3
- large-repo: projected 22000 + overhead 2200, context ≤80000, evidence ≥5, surface 50 files
- long-mission: projected 23000 + overhead 2300, context ≤90000, 9 stages projection ≤ budget
Check: `measured.tokens ≤ projected + overhead` else fail; `measured.context ≤ max` else fail

Stop-Slop suite (§45) — 12 scenarios detect→classify→intervene:
- endless-exploration → investigation slop → stop
- repeated-reads (3× no evidence) → context slop → stop; with concrete reason → tolerate
- repeated-commands (same cmd+evidence fail) → retry slop → stop
- repeated-failed-test → retry slop → stop
- repeated-reasoning → reasoning slop → stop
- unnecessary-abstraction → code slop → stop
- unnecessary-dependency → code slop → stop
- unrelated-refactor → scope slop → stop
- verbose-output → output slop → stop
- no-progress-healing (cycle ≥3, 0 fixes) → healing slop → stop
- premature-completion → scope slop → escalate
- excessive-context (repeated reads + duplicate chars) → context slop → stop

Stress (bench-only, no runtime): large repository 50 files within scope → pass; long mission 9 stages projection ≤ full budget → pass; runaway 2× expected no progress → breaker tripped.

Thresholds live in `scripts/benchmark-thresholds.json` (or THRESHOLDS const) — `tokens > projected+overhead` fail, `context > max` fail, only move on explicit fixture update, ratchet like retrieval-eval. Regression (§49): cost down but correctness/evidence/security/quality/scope down → fail. Determinism: harness pure over explicit fixture inputs, no Date.now/Math.random/network. CI: `package.json:gate` includes harness; `gate-selftest` tampers thresholds → harness must exit 1. Harness measures, not enforces.

## Reporting & trail

Ledger aggregates envelope+events+registry+trail; `mugiwara cost` surfaces ledger; report Cost section renders ledger+avoided+efficiency+trail (§43). Every verdict lands as trail row in decisions.md.

## Checklist

- [ ] ladder run before each code addition, no skipped rung
- [ ] output Decision/Action/Result/Evidence/Blocker, deduped
- [ ] scope/code: reuse checked, abstraction & dep justified
- [ ] slop: taxonomy classified, signals measured, intervention applied
- [ ] budget: reserved, projected, thresholds respected, breaker armed
- [ ] benchmark: 4 cost + 12 slop + 3 stress green, thresholds ratcheted
- [ ] trail rows written for every non-trivial verdict

Unchecked boxes are not done.
