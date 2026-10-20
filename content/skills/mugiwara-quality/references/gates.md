# Gates (Franky)

## Skip when
- No code changed: a docs-only or README-only diff with zero production surface.
- The repo has no coverage tooling and no test suite: record the skip and its reason, do not invent a verdict.

Gates are binary: pass or fail, with evidence. No negotiation, no "almost passes". Franky owns this one stage and reads the quality stage's evidence (`flows/03-quality.md`) for coverage and build context. Stage number and owner: stage table (`mugiwara-orchestration`, stages.md). The release go or no-go is not decided here; it belongs to Luffy through `mugiwara-ship`.

## Coverage gate
1. Measure coverage with the project's existing tooling.
2. Read `coverage_new` and `coverage_modified` from `.mugiwara/config`, then `~/.mugiwara/config`. Defaults and rules: coverage thresholds in the stage table (`mugiwara-orchestration`, stages.md). Identify new and modified code through `git diff` against `base_sha`.
3. No coverage tooling or no test suite: record a SKIP with its reason. Never a fake pass; propose minimal tooling and ask the user to add it or waive.
4. Never lower a threshold or exclude a file to make it pass: add the missing tests.
5. When user acceptance tests are declared (per `references/testcases.md`), the thresholds apply to unit-level code only, and the user-test verdict governs ship readiness. That verdict must come from the quality stage's recorded runs, never be asserted.

## Build gate
Run the project's build, or its typecheck for interpreted stacks. It must exit 0; capture the tail of the output. Skip when `flows/03-quality.md` already recorded an exit-0 build on an unchanged diff.

## Diff size gate (reviewability)
The diff against `base_sha` must be 400 lines or fewer (`git diff --numstat`). Larger fails with the count; split the change before re-checking. ASSUMPTION: 400 is a project default, unverified against an external source.

## Optional e2e gate
Runs only when the quality stage triggered it (e2e setup, matching changed files, user consent). A skipped or unrun e2e is logged and never blocks a pass.

## Definition of Done
A fixed bar across projects: `_shared/references/definition-of-done.md`. PASS only when all five axes hold with evidence.

## Waiver record
A waived gate leaves one record in the verdict file; no record, no waiver:

`| gate | waived by | reason | scope (files/tasks) | expires (mission/date) |`

Scope is the gate, not the mission. Expiry is mandatory: an unexpired waiver blocks the next mission's gate until re-decided. A waiver without an explicit user decision is a failed gate.

## Lane-aware gates
Which gates run in each lane comes from the lane table (stage table, `mugiwara-orchestration`, stages.md) and the policy; this skill does not restate it.

## Verdict
PASS only when coverage, build, diff size, and Definition of Done all pass with evidence. Write the verdict to `.mugiwara/missions/<mission>/flows/04-gates.md`, each criterion with actual value and threshold. Return to Luffy: `recommend: continue` on PASS, `recommend: Brook` on FAIL, listing each file under threshold and by how much. Never start the next stage yourself. A clean pass is one line plus the evidence path.

## Red flags
- A stage closed without its one-line summary, or padded with prose.
- Missing coverage tooling treated as a pass.
- A PASS with no evidence, or coverage measured against the wrong base.
- A FAIL negotiated into a pass.
- A gate waived without an explicit user decision and a waiver record.
- A PASS on coverage and build while Definition of Done fails.
- A diff over 400 lines passed without a split.

All mean: the gate has not actually run. Report the gap or the failure.
