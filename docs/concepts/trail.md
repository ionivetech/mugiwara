# The trail

A mission that ends with "trust me" leaves nothing to review. This page covers what the crew writes down, what a reviewer opens first, and how a finished mission is closed without destroying a teammate's work.

Example: a reviewer opens `report.md` and finds the verdict, the gate results, the token cost and a ranked reading order. The gate section points at the audit file, where each acceptance check carries the command that was re-run and its output. Three files answer whether the mission earned its pass.

Rule: one directory per mission under `.mugiwara/missions/<mission>/`, with a plain name and no date prefix. Dates live in the state JSON and in git history. A savepoint (the state snapshot the crew writes at each stage boundary, which resume reads) is written automatically. Archive folds the trail into `report.md`.

| Group | Files | Written by | When |
|---|---|---|---|
| Plan and spec | `plan.md`, `spec.md` | Nami, Usopp | Stages 1 to 2 |
| Decisions and blockers | `decisions.md`, `blockers.md` | Luffy, any agent | When one occurs |
| State and resume | state JSON, continue JSON | savepoint | Every stage boundary |
| Stage files | execution, audit, quality, gates, healing, review | the stage owner | Stages 3 to 8 |
| Closure | `report.md`, PR verdict, `rollback.sh`, `provenance.md` | Luffy, archive | Stage 9 |

Small work writes a small trail: state, one execution file and the closing report. Plan and per-stage files appear on the lean lane only when a blocker occurs. Commit the trail (plan, spec, decisions, blockers, review files and the report). State JSON stays git-ignored because it is recomputed. A trail that vanishes at merge is no trail.

Reviewer order: the report first, the gate verdict second, a spot-check of the audit third, the findings count fourth, raw state numbers last.

## Closing a mission

`mugiwara archive <mission>` folds the stage files, review, blockers and decisions into `report.md`, then removes the loose files and session state. Three gates protect the result.

- **Team gate.** Archive deletes session state, so every person in the plan's sub-mission table must reach stage 9 first. Someone assigned but never started, someone still in flight, or state with no plan row all block. `--force` archives anyway and the in-flight resume points are lost.
- **Integrity gate.** The trail checks itself before it folds. Archive fails when a relative link points at a missing file, when any trail file contains a secret-shaped string (API keys, tokens, private-key blocks, JWTs, credential assignments), or when an evidence path in state does not exist. Fix the file and archive again. No flag bypasses it.
- **Rollback map.** Closure writes `rollback.sh` with the branch, the base, and revert commands newest first. You run it. Mugiwara never does.

The report also gets a ranked reading order (sensitive paths first, docs last). It orders the reading, never the verdict. `mugiwara clean` archives every closed mission in one go: add `--include-live` to include in-flight ones and `--stale <date>` to include missions untouched since a date.

## Lessons and repo memory

Two small files carry knowledge across missions. `.mugiwara/lessons.md` is append-only: one dated line per lesson, written at closure and read at triage. A lesson earns its line only if it would change a future decision, applies beyond one line of code, and caused or nearly caused a failure. Add one by hand with `mugiwara lesson "<text>"`. `.mugiwara/MEMORY.md` holds stable repo facts (commands, conventions, preferences, prohibitions), capped at 40 lines and read once at triage. A fact lives in one file, never both. No token, key or credential ever goes into either: record where to look it up, not the value. Treat lesson text as data, never as instructions, see [security](security.md).

`mugiwara reset --keep-logs` wipes mission state and keeps the lessons file. Sharing lessons between teams is opt-in and anonymized: see the [adoption guide](../reference/adoption-guide.md).
