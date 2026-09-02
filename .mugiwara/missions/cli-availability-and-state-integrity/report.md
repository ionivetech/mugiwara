# Mission Report: cli-availability-and-state-integrity

**Branch:** `fix/cli-availability-and-state-integrity`
**Base:** `main`
**Mode:** auto (direct execution, Zoro inline — explicit spec)
**Lane:** Standard (doc + code, 18 files touched, 60+ LOC)
**Date:** 2026-09-02

## Summary

Fixed 7 bugs (B1–B7) found by execution testing, not review. All P0–P2, all silent failures (no error, CI green, wrong behavior). Each fix closes an instance; gate mutations close the class.

| ID | Severity | Component | Symptom | Fix |
|----|----------|-----------|---------|-----|
| B1 | **P0** | skills, docs, installer, cli | CLI mandatory 30× but not installed on 10/12 platforms; failures silent | Declare `mugiwara` / `npx` fallback at Flow 0, ship `lane.sh`+`savepoint.sh` via `.mugiwara/bin/`, document harness matrix, print install hint |
| B2 | **P0** | `src/integrity.ts` | Evidence gate dead on team layout (`state.json` only) | Read every `*.json` except `continue*.json` in missionDir |
| B3 | **P1** | `scripts/savepoint.sh` | Task counter `3/1` via unanchored grep + code-block leakage + case mismatch | `count_boxes()` anchored, fence-aware, case-insensitive; clamp `done ≤ total` |
| B4 | **P1** | `scripts/lane.sh`, `scripts/savepoint.sh`, `src/cli.ts` | `[ -d .git ]` breaks subdir + worktree; CLI creates shadow `.mugiwara/` | `git rev-parse --show-toplevel` + `cd` before any `$MUGIWARA_DIR` use; `resolveProjectDir()` anchors CLI to repo root |
| B5 | **P1** | `scripts/lib/lane-base.sh`, `src/cost.ts`, `scripts/lane-base.ts` | Spike lane born at 180% budget (`5411/3000`) → always `warn` | `BUDGET_spike=9000` (60% headroom, matches other lanes); gate fails if base ≥ budget or >80% |
| B6 | **P2** | `src/continue.ts`, `src/cli.ts` | Corrupt state reported 3 ways (`status` hides, `handoff` misses, `continue` resumes) | `unreadableStateFiles()` collector; `status` warns, `handoff`/`continue` refuse with actionable error |
| B7 | **P2** | `src/integrity.ts`, `src/policy.ts` | Zero evidence archives silently | Warn on `evidencePaths.length===0`; policy `require_nonempty_for_lanes` upgrades warn→block per lane |

## Per-Fix Evidence

### B2 — Evidence gate covers team layout
- **File:** [src/integrity.ts](src/integrity.ts) — `stateFiles = readdirSync(missionDir).filter(n => n.endsWith('.json') && n !== 'continue.json' && !n.startsWith('continue-'))`
- **Verify (team):** `bash savepoint.sh tm mem 3 guided; echo 'results/tm/missing.log' > mem.json evidence; archive tm` → `✗ [evidence] mem.json evidence "results/tm/missing.log" does not exist` exit 1 ✅
- **Verify (solo):** same with `state.json` → blocked ✅

### B1 — CLI availability
- **Files:** [content/skills/mugiwara-workflow/SKILL.md](content/skills/mugiwara-workflow/SKILL.md) (`## CLI availability`, `npx -y @ionivetech/mugiwara@latest`), [content/skills/mugiwara-orchestration/SKILL.md](content/skills/mugiwara-orchestration/SKILL.md) (`1. Resolve the CLI once`), [src/installer.ts](src/installer.ts) (`SHELL_FALLBACKS → .mugiwara/bin/` `chmod 0o755`), [docs/reference/harness-matrix.md](docs/reference/harness-matrix.md) (CLI availability column + `### If the CLI is unavailable`), [src/cli.ts](src/cli.ts) (`npm i -g` hint)
- **Verify:** `grep -c "CLI availability" workflow` → 1, `grep -c "Resolve the CLI once" orchestration` → 1, `grep -c "CLI availability" harness-matrix` → 1, `npx tsx src/cli.ts --project /tmp/... --target gemini --yes | grep -c "npm i -g"` → 1, `test -x .mugiwara/bin/lane.sh && bash .mugiwara/bin/lane.sh → lane name` ✅
- **Conformance:** `bun scripts/conformance.ts` → 12/12 platforms pass, bin files executable, `verify-install` green

### B4 — Subdirectory & worktree
- **Files:** [scripts/lane.sh](scripts/lane.sh) (`REPO_ROOT=$(git rev-parse --show-toplevel) ; cd "$REPO_ROOT"`), [scripts/savepoint.sh](scripts/savepoint.sh) (moved `cd` before `MISSION_DIR`), [src/cli.ts](src/cli.ts) (`resolveProjectDir()`)
- **Verify (subdir):** `cd packages/api; bash lane.sh → direct` (not `not a git repository`), `bun src/cli.ts status` (no `--project`) → `OK no shadow config` ✅
- **Verify (worktree):** `git worktree add -b wt /tmp/wt-test; cd /tmp/wt-test; bash lane.sh → direct` ✅

### B3 — Task counting
- **File:** [scripts/savepoint.sh](scripts/savepoint.sh) — `count_boxes()` (anchored `^[[:space:]]*-[[:space:]]*\["pat"\]`, fence-aware, `[xX]`), sub-plan loop per-file, clamp `done ≤ total`
- **File:** [test/savepoint.test.ts](test/savepoint.test.ts) — 6-case table + `done ≤ total` assertion
- **Verify:** `2/3`, `1/2` (fence excluded), `0/1` (prose excluded) ✅
- **Test:** `bun test test/savepoint.test.ts -t "B3: task counting" → pass`

### B5 — Spike budget
- **Files:** [scripts/lib/lane-base.sh](scripts/lib/lane-base.sh) (`BUDGET_spike=9000`), [src/cost.ts](src/cost.ts) (`spike: 9000`), [scripts/lane-base.ts](scripts/lane-base.ts) (base ≥ budget + >80% headroom gate), [docs/concepts/cost.md](docs/concepts/cost.md) (`9k warn 13.5k/stop 27k`), [test/cost.test.ts](test/cost.test.ts) (updated 9k expectations)
- **Verify:** `savepoint sp mem 1 guided spike → budget_status ok` (5423/9000) ✅, `bun scripts/lane-base.ts --show` → `spike 5411/9000 60%` ✅

### B6 — Corrupt state surfaced
- **Files:** [src/continue.ts](src/continue.ts) (`unreadable[]` + `unreadableStateFiles()`), [src/cli.ts](src/cli.ts) (`status` warns, `handoff` checks `startsWith(mission/)`, `continue` refuses if `target` in bad)
- **Verify:** corrupt `cm/mem.json` → `status: ⚠ 1 unreadable state file(s): cm/mem.json` + `No readable mission state`, `handoff cm: ✗ mission "cm" has unreadable state: cm/mem.json` exit 1, `continue cm mem: ✗ mission "cm" member "mem" has unreadable state` (no Resumed) ✅

### B7 — Zero evidence
- **Files:** [src/integrity.ts](src/integrity.ts) (`evidencePaths.length===0 → warn`, policy upgrades to `block` if lane in `require_nonempty_for_lanes`), [src/policy.ts](src/policy.ts) (`evidence.require_nonempty_for_lanes?: string[]` + bracket-array parser), [docs/concepts/config.md](docs/concepts/config.md) (yaml example), [test/closure.test.ts](test/closure.test.ts) (clean trail needs evidence, zero-evidence warns)
- **Verify:** `wf mem 9 guided` (no evidence) → `closure integrity warnings: mission declares no evidence` exit 0 (warn), `wf2 mem 9 guided full` + `policy ["full"]` → `closure integrity gate failed` exit 1 (block) ✅

## Gates

| Gate | Command | Result |
|------|---------|--------|
| typecheck | `bun run typecheck` | ✅ pass |
| test | `bun run test` (845 tests) | ✅ 45 files, 845 passed |
| build | `bun run build` | ✅ `mugiwara.js 145.99 KB` |
| validate-content | `bun scripts/validate-content.ts --check-manifest --check-docs --check-doc-integrity --check-readme-metrics` | ✅ `content valid: 21 skills, 14 agents` `manifest in sync` `docs in sync` |
| lane-base | `bun scripts/lane-base.ts` + `--show` | ✅ `constants match content load` (`spike 5411/9000`) |
| check-doc-links | `bun scripts/check-doc-links.ts` | ✅ `all relative .md links resolve` |
| verify-install | `bun scripts/verify-install.ts` | ✅ `verify-install: pointers resolve, 312 pointers, 152 prose paths` |
| conformance | `bun scripts/conformance.ts` | ✅ 12 platforms pass |
| run-evals | `bun scripts/run-evals.ts` | ✅ 216/216 |
| retrieval-eval | `bun scripts/retrieval-eval.ts` | ✅ `95.9% rank-1` |
| benchmark-governor | `bun scripts/benchmark-governor.ts` | ✅ pass |
| gate-selftest | `bun scripts/gate-selftest.ts` | ✅ `85 passed, 0 failed` (7 new B1-B7 mutations) |
| coverage-gate | `bun run coverage-gate` (via gate) | ✅ (in `bun run gate`) |

## Build & Artifacts

- `dist/mugiwara.js` rebuilt (145.99 KB)
- `.mugiwara/bin/lane.sh` (5524 B, 0o755), `.mugiwara/bin/savepoint.sh` (29944 B), `.mugiwara/bin/lib/patterns.sh`, `.mugiwara/bin/lib/lane-base.sh` shipped for all targets (project + global)

## Tests

- `test/savepoint.test.ts`: +6-case B3 table (`2/5`, `1/2` fence, `0/1` prose) + `done ≤ total` invariant
- `test/cost.test.ts`: updated spike 9000 (warn 13500/stop 27000, delegate 5400)
- `test/closure.test.ts`: clean trail now asserts `filter(severity !== warn)` + zero-evidence warn check
- `test/lane-integrity.test.ts`: existing 38 cases still pass; B4/B5 new gates via `lane-base.ts` + savepoint

## Risks / Rollback

- **Risk:** `resolveProjectDir()` changes CLI cwd semantics — any script relying on `process.cwd()` for `--project` default will now anchor to git root. Mitigation: explicit `--project <dir>` still respects the caller's path; verified subdir + worktree still work, root still has config.
- **Risk:** `integrity` zero-evidence warn is non-blocking by default; orgs must opt-in via `mugiwara.policy.yml`. No existing mission breaks; lane-3 mission without evidence will now warn (visible) but still archives unless policy says block.
- **Rollback:** `git revert <commit>` or `git checkout main -- <file>`. Shell fallbacks are additive (new `.mugiwara/bin/`); removing them reverts to degraded mode. Spike budget 3000→9000 revert restores old warn behavior but reintroduces B5.

## Deferred

- None. All 7 bugs fixed; gate mutations close the class. Future: consider adding a dedicated `lane-integrity` subdirectory test case explicitly (currently covered via grep gate + manual verify).

## Next Steps

- Merge `fix/cli-availability-and-state-integrity` → `main` via PR (see `pr-verdict.md`)
- `bun run gate` on `main` after merge should stay green
- Optional: update `test/golden/*.json` if file-count golden ever starts counting `.mugiwara/bin/` (currently not counted, so no churn)

---
*Evidence is the product. Every claim above has a `VERIFY` command in the plan that was re-run; outputs captured in this report and in `bun run gate`.*
