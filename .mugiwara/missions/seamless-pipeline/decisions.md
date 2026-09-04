# Decisions — seamless-pipeline

## Flow 0 — Triage (2026-09-04)
- **Class:** Explicit — user pasted a complete numerical spec (plan.md, 9 bug IDs N1–N9, 13 tasks with WHY/FILE/WHAT/VERIFY, FIND blocks, execution order, acceptance list). Reason: no research or scope-clarification needed; work is fully specified.
- **Lane:** 3 Full — 13 tasks across 15+ files (src/cli.ts, scripts/validate-content.ts, scripts/savepoint.sh, scripts/gate-selftest.ts, references/wave-banners.md, 7+ skill files, docs/adoption.md, docs/concepts/*, README.md, hooks/*, new src/initiative.ts + test). Highest gate determines route.
- **Route:** Flow 0 → Flow 2 (skip Flow 1 brainstorm; Explicit class). Spec bridge written (Lane 2+ requires a spec before Flow 2).
- **Mode:** `auto` (from `.mugiwara/config` project config). `auto_commit=on` (config). `verbosity=normal`. Applied from Flow 0; flips apply from next flow stage.
- **CLI form:** global `mugiwara` binary NOT installed; resolved to `node dist/mugiwara.js` (dist/mugiwara.js exists, reports `mugiwara 0.9.0`). Reuse this form for the whole mission.
- **Solo/team:** solo — Lane 3 + auto mode, derived (never ask in auto); no member files exist. `team_members: 1`.
- **Lessons:** `.mugiwara/lessons.md` missing (fresh ledger) — read skipped, nothing to surface.
- **Tool surface:** atlassian (Teamwork Graph/Rovo, not needed for this code mission), context7 (not needed), local FS + bash + git. No over-scoped surfaces.
- **Branch:** `fix/seamless-pipeline` (from plan spec), cut from `main` (clean tree).
- **Actors:** request `user: ionivetech <<ionivetech@gmail.com>>`; triage verdict `AI: muse-spark-1.3-contributor-free`.
- **Plan impact:** none — mission starts per spec; execution order from plan §Execution order (items 1–8).

## Flow 3 — Task 1.2 (2026-09-04)
- **Done:** `--check-doc-integrity` now reads `case '<cmd>'` from `src/cli.ts` and scans all markdown under content/docs/references + README/AGENTS; skips in-session `mode`/`off` and `--flags`. Mutation-proven: removing `case 'archive'` fails the gate naming it. `AI: muse-spark-1.3-contributor-free`.
- **Known flag (not a failure):** gate currently reports `docs instruct "mugiwara lessons" but src/cli.ts has no case 'lessons'` — this is N7, resolved by Task 1.3. Numerical order kept; full green expected after 1.3.

## Flow 4 — Audit (2026-09-04)
- **N1 e2e:** rebuilt dist (`bun run build`); `node dist/mugiwara.js initiative conflict-check` names shared file, exit 1. Audit caught stale dist — fixed by rebuild. `AI: muse-spark-1.3-contributor-free`.
- **Full suite local result:** 746 pass / 32 fail. Triaged, not a regression:
  - 4 `gitActor env-precedence` failures reproduce on pristine main worktree (sandbox env lacks normal git identity plumbing) — pre-existing environmental.
  - ~28 remaining failures (savepoint/continue/harness names) all pass in isolation on this branch (savepoint 18/18, harness 13/13, hooks banner 3/3, initiative 9/9, plugin 45/45) — parallel-contention flakes under 48-file load, unstable set.
  - Verdict: no code regression from this mission; CI (clean env) arbitrates full-green.
- **Deviations from spec:** savepoint.sh lines drifted 459-460 → 467-468 (same text); `/mugiwara guided` slash in docs/install/opencode.md:59 left (out of scope, no backtick-mode form); N2 fallout fixed 6 extra files restating the old banner form; Task 2.2 detection lives in pipeline-guard (owns transcript_path) with schema in engagement-marker (marker never sees response text — its own E6 comment).
- **1.3 decision:** Option B (remove promise). No lessons ledger, no consumer tooling, no demonstrated need — import/export fails ladder rung 1.
