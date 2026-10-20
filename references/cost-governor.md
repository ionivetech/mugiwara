# Cost Governor — Terse & Low-Cost Execution

Single source for Work, Scope/Code, Cognitive/Output, Stop-Slop, Adaptive Budget, Benchmark. Verdicts recommended, not enforced; crew acts. Trail rows → `.mugiwara/missions/<mission>/decisions.md` → `## Cost governor decisions`. `savepoint`/`lane-base`/`config` untouched.

Host capabilities (repo name, native in brackets): terse-output [anti-stuff] is terse dense writing; minimal-diff [just-enough] is the minimal-code ladder, YAGNI-first; waste-guard [anti-slop] is waste detection and intervention; scan-format [have-adhd] is scannable rendering, verdict and evidence first.

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
- healing §21.7/§32 no progress → stop; `heal_halt` true → halt (cap: `heal_max_cycles`, see the stage table in `mugiwara-orchestration`)
- scope §21.8 out-of-scope without acceptance → reject
- context §21.2 duplicate/irrelevant → discard/compress
- investigation §21.1 unbounded exploration → stop
- code §21.5 unnecessary abstraction/dependency/boilerplate → remove/simplify

Trail row `slop-governor`.

## On stop — findings handoff (mandatory)

Every stop (investigation limit, breaker trip, heal halt, budget stop) leaves
a handoff — stopped work without one is wasted work. Write it where the work
lived (decision log, or the mission dir for mission work):

- Findings so far (facts with evidence, no conclusions without them)
- Dead ends tried (action + result — the next attempt must not repeat these)
- Next step + owner (concrete action, who runs it: user, next session, named crew)
- Re-entry cost (what must be re-read/re-run to resume — keep it small)

One paragraph each, max. A stop with no handoff is a defect — flag it at
review like a missing test.

## Budget — reserve, projection, thresholds, breaker

Reserve expected max before expensive stages (Review/Security/Healing). Continuously project `current + remaining required + expected conditional + possible healing` (§26).

Expand only with evidence (§27 valid: scope legitimately expanded, security-sensitive path, test surface larger, architecture dependency, legitimate healing; invalid: verbosity/reread/repeat/unnecessary code).

Thresholds (§28): 60% → optimize, 75% → aggressive, 90% → protect, 100% → pause, 150% → warning, 300% → stop.

Breaker (§29): actual ≥ 2× expected without progress/scope/evidence → trip.

Anomaly (§24): flag 5k-zero-progress, re-consumes slop signal.

Record every non-ok verdict via `recordBudgetDecision` (§41). Trail row `budget-governor`. Ledger aggregates envelope+events+registry+trail; `mugiwara cost` surfaces ledger (--json); report Cost section renders ledger+avoided+efficiency+trail (§43).

## Benchmark

`scripts/benchmark-governor.ts` is the deterministic harness (no network) that checks token and context projections per lane; thresholds live in `scripts/benchmark-thresholds.json`. It measures, it does not enforce. Maintainer detail stays in that script, not in crew instructions.

## Reporting & trail

Ledger aggregates envelope+events+registry+trail; `mugiwara cost` surfaces ledger; report Cost section renders ledger+avoided+efficiency+trail (§43). Every verdict lands as trail row in decisions.md.

## Checklist

- [ ] ladder run before each code addition, no skipped rung
- [ ] output Decision/Action/Result/Evidence/Blocker, deduped
- [ ] scope/code: reuse checked, abstraction & dep justified
- [ ] slop: taxonomy classified, signals measured, intervention applied
- [ ] budget: reserved, projected, thresholds respected, breaker armed
- [ ] every stop left a findings handoff (facts, dead ends, next step + owner)
- [ ] trail rows written for every non-trivial verdict

Unchecked boxes are not done.
