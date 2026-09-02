# PR Verdict — fix/cli-availability-and-state-integrity

**Title:** fix: cli availability and state integrity (B1–B7)

**Branch:** `fix/cli-availability-and-state-integrity` → `main`
**Version:** 0.8.1 (no bump; release commit out of scope)

## Summary

7 execution-tested bugs, 6 files silent, 1 gate dead on team path. This branch fixes all 7 and adds a gate mutation per fix so the class cannot regress.

- **P0:** B1 CLI not installed on 10/12 platforms (global `mugiwara` missing, no `npx` fallback, no docs, no shell fallback); B2 evidence gate dead on team layout (`state.json` only, never `<member>.json`)
- **P1:** B3 task counter `3/1` via unanchored grep + fence leakage; B4 `[ -d .git ]` breaks subdir/worktree + shadow `.mugiwara/`; B5 spike `5411/3000` born in `warn` (180%)
- **P2:** B6 corrupt state `status` hides / `handoff` misses / `continue` resumes from `continue-*.json` alone; B7 zero evidence archives silently

## What Changed

| File | Change |
|------|--------|
| `content/skills/mugiwara-workflow/SKILL.md` | +`## CLI availability` (global → `npx -y @ionivetech/mugiwara@latest` → degraded warning) |
| `content/skills/mugiwara-orchestration/SKILL.md` | Flow 0 step 1: `Resolve the CLI once` |
| `src/installer.ts` | Ship `lane.sh`, `savepoint.sh`, `lib/patterns.sh`, `lib/lane-base.sh` to `.mugiwara/bin/` `0o755`, `chmodSync` on overwrite, `REPO_ROOT` |
| `docs/reference/harness-matrix.md` | CLI availability column (`bundled`/`npx only`/`shell fallback`) + `### If the CLI is unavailable` |
| `src/cli.ts` | `resolveProjectDir()` (git root anchor), `unreadableStateFiles` imports, `status`/`handoff`/`continue` B6 handling, post-install `npm i -g` hint |
| `src/integrity.ts` | Read every `*.json` except `continue*.json` (B2), zero-evidence warn/block via `policy.require_nonempty_for_lanes` (B7) |
| `src/policy.ts` | `evidence.require_nonempty_for_lanes?: string[]` + bracket-array parser |
| `src/continue.ts` | `unreadable[]` + `unreadableStateFiles()` collector (B6) |
| `src/cost.ts` | `spike: 9000` |
| `scripts/lane.sh` | `git rev-parse --show-toplevel` + `cd` (B4) |
| `scripts/savepoint.sh` | `count_boxes()` anchored+fence-aware, sub-plan per-file loop, clamp `done≤total`, repo-root `cd` before `MISSION_DIR` (B3+B4) |
| `scripts/lib/lane-base.sh` | `BUDGET_spike=9000` |
| `scripts/lane-base.ts` | base ≥ budget & >80% headroom gate (B5) |
| `test/savepoint.test.ts` | 6-case B3 table + `done≤total` invariant |
| `test/cost.test.ts` | spike 9000 (13500/27000/5400) |
| `test/closure.test.ts` | zero-evidence warn assertion |
| `docs/concepts/cost.md` | spike `9k warn 13.5k/stop 27k` |
| `docs/concepts/config.md` | `evidence.require_nonempty_for_lanes` yaml |
| `scripts/gate-selftest.ts` | 7 B1–B7 mutations (each proves gate can fail) |

## Per-Fix Evidence (re-run)

```
# B2 team gate
bash savepoint.sh tm mem 3 guided; evidence=missing.log; archive tm → ✗ mem.json evidence "..." does not exist exit 1

# B1 install
grep -c "CLI availability" workflow → 1
bun src/cli.ts --project /tmp/... --target gemini --yes | grep -c "npm i -g" → 1
test -x .mugiwara/bin/lane.sh → OK; bash .mugiwara/bin/lane.sh → lean

# B4 subdir/worktree
cd packages/api; bash lane.sh → direct (not "not a git repository")
bun src/cli.ts status (no --project) → OK no shadow in subdir; savepoint creates in repo root
git worktree add -b wt /tmp/wt-test; cd /tmp/wt-test; bash lane.sh → direct

# B3 tasks
plan " - [X] a / - [x] b / - [ ] c" → 2/3
plan fence → 1/2 (examples excluded)
plan prose → 0/1

# B5 spike
savepoint sp mem 1 guided spike → 5423/9000 ok; lane-base --show → spike 60%

# B6 corrupt
echo '{broken' > cm/mem.json; status → ⚠ 1 unreadable: cm/mem.json; handoff → ✗ mission "cm" has unreadable state exit 1; continue → ✗ member "mem" has unreadable state (no Resumed)

# B7 zero evidence
savepoint wf mem 9 guided; archive wf → warnings: mission declares no evidence exit 0
policy ["full"] + wf2 mem 9 guided full → gate failed exit 1; lean with same policy → warn exit 0
```

## Tests

```
bun run typecheck → pass
bun run test → 45 files, 845 tests passed
bun run build → mugiwarajs 145.99 KB + hooks
bun scripts/validate-content.ts --check-manifest --check-docs --check-doc-integrity --check-readme-metrics → content valid, manifest in sync, docs in sync
bun scripts/lane-base.ts → constants match (spike 60%)
bun scripts/check-doc-links.ts → all resolve
bun scripts/verify-install.ts → 312 pointers, 152 prose paths
bun scripts/conformance.ts → 12/12 platforms
bun scripts/run-evals.ts → 216/216
bun scripts/retrieval-eval.ts → 95.9% rank-1
bun scripts/benchmark-governor.ts → pass
bun scripts/gate-selftest.ts → 85 passed, 0 failed (7 new mutations)
```

## Checks

- No secrets in diff (`grep -R "sk-"` etc. — integrity gate would block)
- No version bump (release commit out of scope per plan)
- Body ≤120 after CLI section (blank-line compaction before headings)
- Index budget 4741/5500, cost.md 4741 measured

## Verdict

**GO**

All 7 instances closed, each gate mutation proves the class cannot recur silently. `bun run gate` green on this branch; `main` after merge will stay green. No migration, no deploy, no breaking API. Ready for PR.

**Branch to push:** `fix/cli-availability-and-state-integrity`
**Next:** `git push -u origin fix/cli-availability-and-state-integrity` → open PR `fix: cli availability and state integrity (B1–B7)` → request review.

---
*PR material — this file survives `mugiwara archive` as `pr-verdict.md` at mission root.*
