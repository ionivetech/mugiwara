# Flow 8 — Healing (cycle 1) — Phase 2 must-fix defects

Fixes applied to the three review must-fix findings (`review-phase2.md` H1/M1/M2)
plus Phase 3 security **W1** (reviewer MAJOR #2).
TDD: each fix's test was written first, run red, then the fix landed green.

## W1 (Major, security S8) — one malformed/null line empties whole registry

- **Root cause:** `src/evidence.ts` `loadRegistry` parsed every JSONL line via
  `.map(JSON.parse)` inside one chain, wrapped by a single outer try/catch. A
  `null` literal line (`typeof e.fingerprint` throws on `null`) or any
  unparseable-JSON line threw inside the map → the outer catch returned `[]` →
  the **entire registry** (all valid dedup entries + E### refs) was silently
  discarded for the session, defeating F1's "drop malformed lines *selectively*"
  intent. Real caller: `mission.ts:173`.
- **Fix (one guard in the shared function):** replaced the map/filter chain with
  a per-line loop. Each line's `JSON.parse` is wrapped in its own try/catch
  (unparseable line drops itself and continues), and a guard
  (`e === null || typeof e !== 'object'`) skips JSON literals like `null`.
  All existing valid-entry handling is preserved exactly: drop non-string/missing
  `ref`, non-string/negative/fractional/non-finite `reads`, floor `reads` to int.
- **Tests (TDD, red → green):** added to `test/evidence.test.ts` F1 block —
  "drops a null line and an unparseable-JSON line; valid entries before and after
  load intact (W1)". Writes `E001`, `null`, `E002`, `{ not valid json`, `E003`
  (reads 2) → asserts exactly 3 entries `['E001','E002','E003']` and the last
  entry's `reads === 2`. Red before fix (1 fail / 15 pass), green after
  (16 pass). This closes the reviewer MINOR ("F1 tests lack a null-line case").
- **Commit:** `fix(evidence): drop corrupt registry lines without discarding valid entries (W1)`

## H1 (High) — `context-registry.jsonl` survives archive loose

- **Root cause:** the archive fold set (`src/mission.ts` `archiveMission`) and its
  removal loop only handled `cost-events.jsonl`; `context-registry.jsonl` was
  neither folded into `report.md` nor removed → it survived loose, breaking
  survival parity with its sibling ledger.
- **Fix:** added `if (existsSync(join(dir,'context-registry.jsonl'))) fold.push('context-registry.jsonl')`
  beside the cost-events fold. The shared fold loop both appends `## Archived:
  context-registry.jsonl` to `report.md` and `rmSync`s the file.
- **Test:** `closure-integration.test.ts` "context-registry.jsonl folds into
  report.md and is removed (survival parity)" — asserts `## Archived:
  context-registry.jsonl` and the archived entry id are in report.md AND the
  file no longer exists after archive.
- **Commit:** `17b4c7c fix(context): fold and remove context-registry.jsonl at archive (H1)`

## M1 (Med) — contradictory efficiency metrics

- **Root cause:** `src/mission.ts` fed `unique_chars:0, total_chars:0` into
  `computeContextMetrics` because the registry tracked reads, not char payloads.
  So `duplicate_chars`/`read_avoidance_chars` were always `0` beside a real
  `reuse_rate>0` — a contradiction.
- **Fix (honest-data):** extended `RegistryEntry` with a `chars` field (content
  length); `registerRead` records `chars: e.content.length`. `mission.ts` now
  sums `unique_chars`/`total_chars` from real payloads (`duplicate_chars` =
  `total − unique` = bytes re-read, `read_avoidance_chars` = same). When a
  registry exists but carries no char payloads (legacy/absent field), the char
  fields render as `n/a` with a `(char data not tracked)` note — never a
  fabricated `0` — so `reuse_rate > 0` can never coexist with a false
  `read_avoidance_chars: 0`.
- **Tests:** `closure-integration.test.ts` "renders context metrics from a
  present registry" (now asserts `duplicate_chars: 100`, `read_avoidance_chars:
  100`, `reuse_rate: 0.333…`, and `not read_avoidance_chars: 0`) + new "renders
  n/a for char fields when registry carries no char payloads".
- **Commit:** `115785a fix(context): real char accounting for efficiency metrics (M1)`

## M2 (Med) — `context_status:'over'` unreachable

- **Root cause:** `src/mission.ts` threw on over-budget (context char budget
  exceeded) at the top of the cost block, before `appendCostEvent` ran — so
  every persisted closure event had `context_status:'ok'`; `'over'` could never
  be recorded.
- **Fix (option a):** moved the over-budget throw to AFTER `appendCostEvent`.
  An over-budget closure now writes the closure event (with
  `context_status:'over'`) to the ledger, then the hard gate throws. The
  over-budget condition is captured, not erased.
- **Test:** `closure-integration.test.ts` "over-budget closure records a cost
  event with context_status 'over' before the gate throws" — asserts the
  archive still throws `context budget failed` AND `cost-events.jsonl` contains
  `"context_status":"over"`.
- **Commit:** `5ca71bb fix(context): record 'over' closure event before the budget throw (M2)`

## Verification

- `bun run typecheck` — pass.
- Affected tests (`closure-integration`, `context`, `evidence`, `cost`):
  **73 pass** (baseline 70 → +3 new).
- Full `bun run gate`: blocked by the **pre-existing `enforcement.test.ts`
  "guard: plan written + no planner dispatched → warns" flake** — reproduced on
  the parent commit `02c4d78` (2/5 fails) in this session; tracked in
  blockers.md row 3 as a separate fix mission. My diff does not touch that path.
  485/486 tests pass (the one failure is that flake).
- Every post-test gate step run individually — all green: `build`,
  `validate-content`, `lane-base`, `check-doc-links`, `verify-pack`,
  `run-evals`, `retrieval-eval` (201/201), `verify-install`, `conformance`.
- Coverage (flake excluded, coverage-gate metric = lines): `evidence.ts` **100%**
  (new, limit 90) ✓, `mission.ts` **94.41%** (modified, limit 80) ✓.

## Savepoints

`scripts/savepoint.sh` and `scripts/lane-base.sh` untouched. No PR, no push, no
merge (per Luffy). Escalation: the `enforcement.test.ts` timing flake is the
only thing between the branch and a green gate; it is already a separate
tracked fix mission (blockers.md row 3), not a Phase-2 defect.

---

## ESCALATION — T2 "restore governance lines" (Phase-4 checkpoint) — false premise

**Status: ESCALATED to Luffy. No code committed. Tree left green at 1bfc887.**

### What the checkpoint asked
Restore two governance lines Zoro cut in `eb8229d` —
`Precedence: class decides whether there is work; lane decides how much process — class first, lane second.`
and `Brook reads this at Flow 8. Never silently work around a blocker.` — keep the
Phase-4 additions (rule `2b` + `## Scope & Code Governor`), keep the validator green,
and delete no content to compensate. It asserted the deletion was unnecessary because
"the repo validator caps at 120 CHARACTERS PER LINE, not 120 lines."

### Why the checkpoint is factually wrong
1. **The validator caps at 120 LINES, not 120 chars/line.** `scripts/validate-content.ts:19`:
   `if (kind === 'skill' && body.replace(/\r?\n$/, '').split(/\r?\n/).length > 120)`
   → "body exceeds 120 lines". A repo-wide search (`rg "120.*char|Body lines"`) found
   **zero** 120-char-per-line rules anywhere in `scripts/` or `docs/`. The documented
   limit (AGENTS.md skill-standard table: `Body lines | ≤120`) is a **line** cap.
2. **The file is already AT the cap with the governance lines absent.** Base
   `3490284` = 120 body lines; HEAD `1bfc887` = 120 body lines.
3. **Zoro's rationale was correct.** `git show eb8229d` is net-zero lines: Phase-4
   added `## Scope & Code Governor` (+heading/blank/2 content = +4 lines) and inline
   `2b` (same line); Zoro cut exactly 4 lines (`Precedence:`+blank, `Brook` line, and
   one blank before the pipeline table) to hold 120. The deletions were necessary, not
   a misread.
4. **The requested outcome is unsatisfiable.** Restore (+4 lines) + keep Phase-4 +
   validator exit 0 (= ≤120 lines) + delete no content cannot coexist. Restoring the
   two lines yields 124 body lines → `validate-content` fails (verified: restore pushed
   it to 123, gate red).

### Root cause
Phase-4 represents the Scope & Code Governor rule **twice**: inline `2b` appended to
rule 2, AND a full standalone `## Scope & Code Governor` section. That double
representation overflowed the 120-line body budget, and the two governance lines were
the collateral. Zoro cut the right budget lines but the wrong *content* — the actual
bloat is the duplicated governor representation.

### Options for Luffy (decision is Luffy's — content-budget/scope call, not a heal fix)
- **A — Move a section to `references/`** (sanctioned skill pattern): relocate the
  `## Scope & Code Governor` body to `references/scope-code-governor.md`, leave a
  one-line pointer. Frees ~4 lines with zero content loss. Requires `verify-install`
  pointer resolution. Cleanest; a real (small) refactor.
- **B — De-duplicate the governor rule**: keep inline `2b` OR the standalone section,
  drop the redundant copy. Loses some §15/§16 elaboration unless folded into `2b`.
- **C — Accept the current state**: governance lines stay out; file is at the cap and
  green. Reopens the governance-content gap the checkpoint cares about.
- **D — Raise the cap / weaken the validator**: rejected outright — forbidden.

### Evidence
- Validator on clean HEAD: `validate-content --check-manifest --check-docs --check-doc-integrity` → **exit 0** (21 skills, 14 agents).
- `bun test test/scope.test.ts` → **41 pass, 0 fail** (T1 unaffected).
- Restored-lines attempt reverted; working tree at 1bfc887 (only pre-existing
  plan.md/decisions.md mods remain — untouched per task).
- No commit made; no SHA to report (task requested a SHA — superseded by escalation).

### What I did NOT do (and why)
Did not restore + commit a gate-red file. Did not delete content to compensate
(forbidden). Did not silently agree with the checkpoint's false validator premise
(role rule: a finding that doesn't hold up gets technical reasoning, not agreement).

---

## RESOLUTION — T2 governance lines, heal cycle 1 (Option A, Luffy's decision)

**Status: HEALED. Commit `af8a204`. Option A (move section to `references/`) applied.**

Per Luffy's decision (Option A), the T2 blocker is cleared using the repo's
sanctioned references pattern:

1. **New file** `content/skills/mugiwara-workflow/references/scope-code-governor.md`
   — title + full `## Scope & Code Governor` body (both paragraphs), wrapped to
   ≤120 chars/line. English only.
2. **`content/skills/mugiwara-workflow/SKILL.md`**:
   - Inline `## Scope & Code Governor` section (heading + blank + 2 content lines,
     4 lines) replaced with heading + one-line pointer
     `Full definition: \`references/scope-code-governor.md\` — reuse-first, justification
     for abstractions/dependencies, minimum sufficient implementation.` (2 lines).
   - Restored `Precedence: class decides whether there is work; lane decides how much
     process — class first, lane second.` at line 67 (Flow 0, after the Hotfix row).
   - Restored `Brook reads this at Flow 8. Never silently work around a blocker.` at
     line 82 (Blocker protocol).
   - Rule `2b` on line 91 intact. Every new line ≤120 chars.
   - **Final body line count: 120** (exactly at the validator cap, gate green).

### Verification (all green)
- `bun scripts/validate-content.ts --check-manifest --check-docs --check-doc-integrity` → **exit 0** (content valid: 21 skills, 14 agents; manifest/docs in sync).
- `bun scripts/verify-install.ts` → **exit 0** — 246 pointers checked across 9
  targets, 0 broken; `references/scope-code-governor.md` pointer resolves after
  install; 0/41 reference files unreachable.
- `bun test test/scope.test.ts` → **41 pass, 0 fail** (T1 unaffected).
- `bun run typecheck` → **exit 0**.
- grep confirms both restored governance lines + rule 2b + `## Scope & Code Governor` present.

### Restored-line positions (final SKILL.md)
- line **67** — `Precedence: class decides whether there is work; lane decides how much process — class first, lane second.`
- line **82** — `Brook reads this at Flow 8. Never silently work around a blocker.`
- line **91** — rule 2b intact.
- line **102/103** — `## Scope & Code Governor` heading + references pointer.

### Commit
`fix(workflow): move scope governor to references, restore SKILL.md governance lines`
— SHA **af8a204**, new commit on top of 1bfc887 (not amended). Only
`SKILL.md` + `references/scope-code-governor.md` staged; orchestrator artifacts
(plan.md, decisions.md, blockers.md, flows/05-healing.md) untouched by the commit.

### Untouched
No `src/*.ts`, `savepoint.sh`, `lane-base.sh`, `DEFAULT_CONFIG`, `plan.md`,
`decisions.md`, or `state.json` changed.
