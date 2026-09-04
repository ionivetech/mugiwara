# enforcement-gaps

## Key decisions

- Explicit-class mission: the user-supplied plan (WHY/FILE/WHAT/VERIFY per
  task, literal FIND blocks) is the spec; `spec.md` is a restating bridge.
  Flow 1 skipped with recorded reason. No interview round: nothing ambiguous
  except the opencode hook capability, which is tasked research (T9, Stage A),
  not triage ambiguity.
- Lane Full, solo, inline-sequential. No mission split: ~16 h estimate is
  under the 2-day multi-PR threshold; single branch, single PR verdict.
- Two corrections to the supplied plan, both verified by reading the repo:
  1. `test/enforcement.test.ts` (343 lines) already executes the built
     `pipeline-guard.js` and `engagement-marker.js` through vitest. The
     "zero hook tests" premise holds only for `pretool-guard` (new),
     the E3 artifact case, `mode-tracker`, and `auto-savepoint`. T7 is
     scoped to the uncovered surface and must not duplicate existing cases.
  2. `docs/concepts/enforcement.md` does not exist yet (T11 creates it), and
     `docs/reference/harness-matrix.md` already links to it — creating the
     file also repairs a dead link that `check-doc-links.ts` polices.
- Tests exercise the built `hooks/*.js`, never the `.ts` source (repo
  convention: the wired artifact is what ships; a `.ts`-only test stayed
  green through a whole release of stale builds).
- New hook files must be registered in three places: `HOOK_ENTRIES` in
  `scripts/build-hooks.ts` (build + `--check` freshness gate), `hooks/hooks.json`
  (plugin installs), and the `events` table in `src/targets/claude.ts`
  (CLI installs). Missing any one of the three is a silent no-op on one
  install path.

## Architecture overview

Three enforcement surfaces, one honesty rule:

1. **Entry (Flow 0):** agent file carries the checklist (T1), the validator
   enforces it on all 14 agents (T2), the Stop/SubagentStop guard blocks
   work without triage — for source edits AND artifact writes (T4).
2. **Terminal prohibition:** a PreToolUse guard refuses irreversible commands
   before they run (T5), documented where it can be read (T6).
3. **Visibility + portability:** banner warnings (T8), hook tests (T7),
   honest per-tier matrix after verifying the opencode API (T9).
4. **Anti-regression:** one mutation per fix (T10) plus a gate that asks
   "does this rule have a mechanism?" (T11).

Data flow for T8 is unresolved in the supplied plan: the PostToolUse payload
carries tool input, not response text, so "record when a response contains
`## Flow N`" cannot be implemented literally in the marker. T8 starts by
verifying the Stop-hook payload shape and falls back to detecting banners in
mission files written this session. Warning only, never a block.

## Project structure

```
content/agents/luffy-orchestrator.md   T1, T3
scripts/validate-content.ts            T2, T11
scripts/gate-selftest.ts               T10
hooks/pipeline-guard.ts + .js          T4, T8
hooks/engagement-marker.ts + .js       T8
hooks/pretool-guard.ts + .js (new)     T5
hooks/hooks.json                       T5
scripts/build-hooks.ts                 T5
src/targets/claude.ts                  T5
src/targets/opencode.ts                T9 (read-only unless Stage B)
src/guards.ts (new, conditional)       T9 Stage B only
.opencode/plugins/mugiwara.mjs         T9 (verify provenance before editing)
content/skills/mugiwara-ship/SKILL.md  T6
docs/concepts/security.md              T6
docs/concepts/enforcement.md (new)     T11
docs/reference/harness-matrix.md       T6, T9
test/hooks.test.ts (new)               T7
```

## Waves

| Wave | Focus | Tasks | Gate |
|------|-------|-------|------|
| 1 | Flow 0 hole: entry protocol + gate + stale path | T1–T3 | `bun scripts/validate-content.ts` green + negative probe on T1 |
| 2 | Guard fires on artifact work | T4 | fixture probe: artifact-only work with no triage blocks |
| 3 | Terminal prohibition + its docs | T5–T6 | deny/allow matrix from T5 VERIFY green; ship SKILL ≤120 lines |
| 4 | Visibility: hook tests + banner warning | T7–T8 | `vitest run test/hooks.test.ts` 15 pass; banner-less session warns |
| 5 | Opencode capability, honestly recorded | T9 | `bun scripts/conformance.ts` green; matrix states every tier |
| 6 | Anti-regression: invariant table + mutations | T11 then T10 | `gate-selftest.ts` green incl. 6 new mutations |

Rollback point: tag `enforcement-gaps-waveN` after each green wave gate;
a failed wave gate means `git revert` to the previous tag, fix, re-run.

## CODEOWNERS

| Area | Owner task(s) |
|------|---------------|
| `content/agents/` | T1, T3 (same file → sequential) |
| `scripts/` | T2, T10, T11 |
| `hooks/` | T4, T5, T8 |
| `src/targets/` | T5 (claude.ts events), T9 (opencode.ts read-only unless Stage B) |
| `content/skills/mugiwara-ship/` | T6 |
| `docs/` | T6, T9, T11 |
| `test/` | T7 |

No two tasks share a file except T1/T3 (same agent file, sequential) and
T4/T8 (`pipeline-guard.ts`, sequential across waves). Nothing is `[PARALLEL]`.

## Implementation graph

- T1 produces `## Before you start` + routing rule → consumed by T2
  (gate asserts the routing-rule string).
- T4 produces `artifactWorkNow` in guard → consumed by T7 (artifact-only case).
- T5 produces `hooks/pretool-guard.js` + FORBIDDEN table → consumed by T6
  (docs list the commands) and T7 (deny/allow cases).
- T8 produces banner facts → consumed by T7 only as warning-path coverage;
  no test may assert a block on banners.
- T9 produces the matrix enforcement rows → consumed by T11 (invariant table
  cites per-tier mechanisms) and T10 (matrix-row mutation target).
- T11 produces `--check-invariants` + table → consumed by T10 (mutations
  for the new gate).

## Task index

| # | Task | Files | Size | Depends-on | Acceptance |
|---|------|-------|------|------------|------------|
| T1 | E1 entry protocol for the captain | `content/agents/luffy-orchestrator.md` | S | — | two greps = 1, validator green |
| T2 | E2 gate covers all 14 agents | `scripts/validate-content.ts` | S | T1 (`luffy-orchestrator.md`) | validator green + negative probe fails naming luffy |
| T3 | E8 stale `logs/` path | `content/agents/luffy-orchestrator.md` | XS | T1 (same file) | `logs/` grep = 0, doc-integrity green |
| T4 | E3 guard on artifact work | `hooks/pipeline-guard.ts` + built `.js` | M | — | artifact-only fixture blocks |
| T5 | E4 PreToolUse guard + registration | `hooks/pretool-guard.ts`+`.js`, `hooks.json`, `build-hooks.ts`, `src/targets/claude.ts` | M | — | 6 denies + 4 allows |
| T6 | Prohibition docs | ship SKILL, `security.md`, `harness-matrix.md` | S | T5 (command list) | validator green, matrix row present, SKILL ≤120 lines |
| T7 | Hook tests, 15 cases | `test/hooks.test.ts` | M | T4+T5 (built `.js`) | vitest 15 pass, no dupes of `enforcement.test.ts` |
| T8 | Banner warning | `engagement-marker.ts`+`.js`, `pipeline-guard.ts`+`.js` | S | T4 (same guard file) | banner-less work warns, exit 0 |
| T9 | Opencode port, Stage A first | matrix, `opencode.ts`/`mugiwara.mjs`/`src/guards.ts` per finding | M | T5 (guard logic to share) | conformance green, matrix honest per tier |
| T11 | Invariant table + `--check-invariants` | `docs/concepts/enforcement.md`, `validate-content.ts` | M | T9 (per-tier mechanisms) | new flag green, dead link fixed |
| T10 | One mutation per fix | `scripts/gate-selftest.ts` | S | T11 (new-gate mutation) | selftest green, each mutation reds one gate |

## Detail tasks

**Task 1: E1 entry protocol for the captain** `[SEQUENTIAL, depends-on: none]`
- Files: modify `content/agents/luffy-orchestrator.md`
- Interfaces: produces `## Before you start` + `Brainstorm is Usopp` for Task 2
- Size: S
- Break: none
- Steps: [ ] Insert the `## Before you start` block verbatim from the spec immediately after the `# Luffy — Orchestrator (Captain)` heading (line 8), before `## Role`; run the VERIFY greps; run `bun scripts/validate-content.ts`; commit.
- Acceptance: `grep -c "## Before you start" content/agents/luffy-orchestrator.md` prints 1, `grep -c "Brainstorm is Usopp"` prints 1, validator exits 0 (also confirms the new section trips no other gate such as F4).
- Risk: F4 handoff-target gate on new wording — covered by the validator run itself.

**Task 2: E2 gate covers all 14 agents** `[SEQUENTIAL, depends-on: Task 1 (file: content/agents/luffy-orchestrator.md)]`
- Files: modify `scripts/validate-content.ts`
- Interfaces: consumes routing-rule string from Task 1 → produces gate for Task 10
- Size: S
- Break: none
- Steps: [ ] Replace lines 189–193 with the spec block; run validator green; negative probe (stash the Task 1 section, expect FAIL naming luffy, restore); commit.
- Acceptance: validator exits 0 on the tree; negative probe exits non-zero naming `luffy-orchestrator`.
- Risk: none.

**Task 3: E8 stale path** `[SEQUENTIAL, depends-on: Task 1 (file: content/agents/luffy-orchestrator.md)]`
- Files: modify `content/agents/luffy-orchestrator.md` line 34
- Interfaces: none
- Size: XS (folds into the Wave 1 history beside T1/T2, one commit with its own message)
- Break: none
- Steps: [ ] Replace `` still log the route + reason in `logs/` `` with `` still log the route + reason in `.mugiwara/missions/<mission>/decisions.md` ``; run `grep -c "in \`logs/\`"` expecting 0 plus a repo-wide `grep -rn "logs/" content/agents/ content/skills/ --include=*.md` expecting no stale mission-log references; run `--check-doc-integrity`; commit.
- Acceptance: both greps clean, doc-integrity exits 0.
- Risk: none.

**Task 4: E3 guard on artifact work** `[SEQUENTIAL, depends-on: none]`
- Files: modify `hooks/pipeline-guard.ts`; rebuild `hooks/pipeline-guard.js` via `bun run build-hooks`
- Interfaces: produces `artifactWorkNow` predicate for Task 7
- Size: M
- Break: none
- Steps: [ ] Read `main()` (lines 81–220) to confirm the exact trigger conditions (engagement scoping) and shape the fixture probe to satisfy them — the spec VERIFY omits engagement and may stay silent; adapt, do not blindly pipe. [ ] Add `artifactWorkNow` beside `sourceChangedNow`, apply the predicate REPLACE and the message update; `bun run build-hooks`; `bun run build-hooks:check`; run the adapted fixture probe (artifact-only, no triage → blocks; no work → silent); commit implementation + built `.js` together.
- Acceptance: artifact-only fixture blocks with the dual-case message; `build-hooks:check` exits 0; fail-open preserved (any throw inside `artifactWorkNow` returns false — point at the catch).
- Risk: over-broad predicate policing idle sessions — mitigated by engagement scoping + TTL cutoff reuse; if the probe shows false positives on idle checkouts, STOP and report instead of widening.

**Task 5: E4 PreToolUse guard + registration** `[SEQUENTIAL, depends-on: none]`
- Files: create `hooks/pretool-guard.ts`; register `pretool-guard` in `HOOK_ENTRIES` (`scripts/build-hooks.ts`); add the `PreToolUse` + `Bash` entry in `hooks/hooks.json`; add the `PreToolUse` event in the `events` table in `src/targets/claude.ts`; verify the installer copy loop in `src/targets/claude.ts` picks up the new `.js` (extend it if it iterates an explicit list); `bun run build-hooks`
- Interfaces: produces FORBIDDEN table + built `.js` for Tasks 6, 7, 9
- Size: M
- Break: split `src/targets/` edits out if the installer surface diverges.
- Steps: [ ] Write the guard (spec table; `enforce` key read exactly like pipeline-guard: off|warn|block, default block; deny message verbatim from spec; fail open on any internal error). [ ] Register in all three places; build; run the spec deny-list (6 commands → denied) and allow-list (feature push, `gh pr view`, `terraform plan`, `git log` → allowed) plus `enforce=off` allows everything; run `bun run build-hooks:check` and `bun run typecheck`; commit.
- Acceptance: 6/6 denied, 4/4 allowed, `enforce=off` allows all, `build-hooks:check` and `typecheck` exit 0.
- Risk: over-correction blocking the crew terminal push — covered by the `git push -u origin feature/*` allow case; if the regex cannot distinguish protected-branch from feature pushes, STOP and report.

**Task 6: prohibition docs** `[SEQUENTIAL, depends-on: Task 5 (file: hooks/pretool-guard.ts)]`
- Files: modify `content/skills/mugiwara-ship/SKILL.md`, `docs/concepts/security.md`, `docs/reference/harness-matrix.md`
- Interfaces: consumes FORBIDDEN command list from Task 5
- Size: S
- Break: none
- Steps: [ ] Add `## Never` to the ship SKILL (command list + tier-1-enforced/prose-elsewhere note); extend `## What mugiwara defends against` in security.md; add the Irreversible-command guard row to the matrix; verify `wc -l` body ≤120 on the SKILL and run the validator; commit.
- Acceptance: `grep -c "Irreversible-command guard" docs/reference/harness-matrix.md` ≥ 1, validator exits 0, SKILL body ≤120 lines.
- Risk: none.

**Task 7: hook tests, 15 cases** `[SEQUENTIAL, depends-on: Tasks 4, 5 (files: hooks/pipeline-guard.js, hooks/pretool-guard.js)]`
- Files: create `test/hooks.test.ts`
- Interfaces: consumes built `.js` artifacts; must read `test/enforcement.test.ts` fully first and cover only the gap
- Size: M
- Break: none
- Steps: [ ] Read `enforcement.test.ts` end to end, list its cases, then write `test/hooks.test.ts` in its style (`vitest` import, `node` spawn on built `.js`, tmp-repo fixtures, `CLAUDE_PROJECT_DIR=cwd`): E3 artifact-only blocks; no-work silence; Lane 0 savepoint pass; `enforce=off` pass; `enforce=warn` warns exit 0; malformed state fails open; pretool deny ×2 (`gh pr create`, `git push origin main`); pretool allow ×2 (feature push, `terraform plan`); pretool `enforce=off`; `mode-tracker` turn updates config; `auto-savepoint` records mode; marker dispatch fact. Cap at 15 by folding the remaining spec cases into these where they overlap; every case names the spec case it satisfies. [ ] `bunx vitest run test/hooks.test.ts`; commit.
- Acceptance: 15 pass, 0 fail; no case duplicates `enforcement.test.ts` (each new test names the gap: E3, pretool, tracker, savepoint).
- Risk: `auto-savepoint`/`mode-tracker` may be untestable in isolation (shell-outs, env) — if so, record the reason in the test file header, drop to 13, and say so at check-in rather than faking coverage.

**Task 8: banner warning** `[SEQUENTIAL, depends-on: Task 4 (file: hooks/pipeline-guard.ts)]`
- Files: modify `hooks/engagement-marker.ts` (+ built `.js`), `hooks/pipeline-guard.ts` (+ built `.js`)
- Interfaces: none (warning path only)
- Size: S
- Break: none
- Steps: [ ] Verify what text the Stop-hook payload carries (fixture: log stdin JSON). If response text is present, record `last_banner_flow` on `## Flow <n> —` match in the marker. If absent, implement detection over mission files written this session (decision/flow files containing the banner) — same warning string either way. [ ] Guard emits the spec warning when work happened, state exists, no banner recorded; rebuild both `.js`; fixture probe (work + state, no banner → stderr warning, exit 0); commit.
- Acceptance: warning text on stderr, exit code 0 in all banner cases; `build-hooks:check` exits 0.
- Risk: response-text matching false positives → warning only, never block (spec constraint, enforced by asserting exit 0 in the probe).

**Task 9: opencode port, Stage A first** `[SEQUENTIAL, depends-on: Task 5 (file: hooks/pretool-guard.ts)]`
- Files: modify `docs/reference/harness-matrix.md`; conditionally `src/targets/opencode.ts`, `src/guards.ts` (new), `.opencode/plugins/mugiwara.mjs` — verify the plugin file provenance (generated vs hand-written) before touching it
- Interfaces: consumes guard predicate from Task 5 for sharing
- Size: M
- Break: split Stage A research from implementation if the API is unclear.
- Steps: [ ] Stage A: research the current opencode plugin API for a tool-before/session-end event (plugin docs, installed package surface); record the finding in the matrix either way. [ ] Stage B if the hook exists: extract shared predicates to `src/guards.ts`, port pretool then pipeline guard, conformance green. [ ] Stage C if absent: strongest available surface (`chat.message` missing-banner correction) + honest matrix entry. [ ] Stage D: tiers 2/3 rows as prose-only; run `bun scripts/conformance.ts`; commit.
- Acceptance: conformance exits 0; matrix contains the Irreversible-command guard row and per-tier Flow 0 rows; no tier claims enforcement it does not have (overstatement is a defect, re-verify by reading the final rows).
- Risk: opencode API churn — Stage A finding may be "no"; that is a valid outcome, not a blocker.

**Task 11: invariant table + `--check-invariants`** `[SEQUENTIAL, depends-on: Task 9 (file: docs/reference/harness-matrix.md)]`
- Files: create `docs/concepts/enforcement.md`; modify `scripts/validate-content.ts`
- Interfaces: consumes per-tier mechanisms from Task 9; produces gate for Task 10
- Size: M
- Break: none
- Steps: [ ] Write the table (one row per invariant: Flow 0 triage, write-scope, heal max 3, lane only rises, evidence per gate, plan-is-Nami's, flow banner, no-PR/merge/deploy — each with mechanism or prose-only + reason) plus the never/always rule. [ ] Implement `--check-invariants` (grep skills+agents for never/always/MUST, require table coverage, seeded allowlist passing today); run full validator incl. new flag; run `check-doc-links.ts` (new file repairs the matrix dead link — confirm); commit.
- Acceptance: `bun scripts/validate-content.ts --check-config --check-wiring --check-doc-integrity --check-invariants` exits 0; doc-links green.
- Risk: allowlist seeding masks real gaps — seed from the current set only, each entry traceable to a table row.

**Task 10: one mutation per fix** `[SEQUENTIAL, depends-on: Task 11 (file: scripts/validate-content.ts)]`
- Files: modify `scripts/gate-selftest.ts`
- Interfaces: consumes every prior task's surface
- Size: S
- Break: none
- Steps: [ ] Add six mutations in the file's mutate→RED→restore→GREEN style (luffy section delete; Luffy `continue` restore; source-only predicate restore; `gh pr create` row delete; over-broad push matcher add; matrix guard row delete → the gate that owns that row, resolving the spec mapping so each mutation reds exactly one gate). [ ] `bun scripts/gate-selftest.ts` green; commit.
- Acceptance: selftest exits 0; each mutation verified to fail its gate (temporarily break each target string to confirm the selftest itself errors on a missing target, per existing behavior).
- Risk: none.

## Risk & rollback

- Highest-consequence surface is T5 (refusing commands). Contained by: fail-open on internal error, `enforce=off` escape hatch, allow-list cases guarding the crew terminal push, default-deny only on the 10 listed classes. A bad regex ships as disabled-guard-by-users, which is why the allow cases are acceptance, not advisory.
- T4 predicate widening could police idle sessions. Contained by engagement scoping (existing) + TTL reuse; STOP-and-report trigger is explicit.
- T8 banner detection depends on payload shape the plan assumed. Resolved by verify-first step; warning-only invariant holds regardless.
- The E7 premise correction (T7 scope) is the largest plan-vs-repo delta found in the scan; if `enforcement.test.ts` already covers more than mapped, T7 shrinks and says so at check-in.
- Rollback: `enforcement-gaps-waveN` tags per wave; revert-to-tag on red gates. No migrations, no deploys, no data changes — every wave is revertible by `git revert`.

## Mission split

None. Single-PR scope (~16 h, one branch, one verdict). Revisit only if T9 Stage A discovers an opencode surface requiring a second install-path PR — that would become a tracked follow-up, not a split.

## Acceptance

```
bun run gate && bun scripts/gate-selftest.ts && bun scripts/conformance.ts
bun scripts/validate-content.ts --check-config --check-wiring --check-doc-integrity --check-invariants
bunx vitest run test/hooks.test.ts
```

- [x] E1 entry protocol with the routing rule (T1)
- [x] E2 gate on all 14 agents, no exemption (T2)
- [x] E3 artifact-only work blocks (T4)
- [x] E4 PreToolUse denies 10 classes, allows feature pushes and reads (T5)
- [x] E5 capability verified, matrix honest per tier (T9)
- [x] E6 banner absence warns, never blocks (T8)
- [x] E7 15 hook tests green incl. both over-correction guards (T7)
- [x] E8 no `logs/` reference (T3)
- [x] enforcement.md lists every invariant and mechanism (T11)
- [x] one mutation per fix, each reds one gate (T10)

## Anti-patterns

- No TBD, no "works correctly" — every acceptance above is a literal command.
- No assumed tooling: CLI form (`bun src/cli.ts`), test runner (vitest), hook build (`build-hooks.ts` + `--check`), payload shapes (T4/T8 verify-first steps) all confirmed in the scan.
- No `[PARALLEL]`: shared files and interface edges documented above.
- No gold-plating: `src/guards.ts` exists only under Stage B; the plugin file is touched only after provenance check.
