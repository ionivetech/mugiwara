# Audit Trail

A mission that ends with "trust me" leaves nothing to review. Claims without artifacts cannot be checked. This page answers "what is recorded" with one example, then the artifact table. Every verdict points at files a reviewer can open.

Example: a reviewer opens `report.md` and finds the closure summary with gate verdicts, token cost, and a ranked reading order. The second file is the gate verdict, which shows coverage from config plus build plus DoD. The third is the audit report, where each criterion carries a re-run command and an evidence row. Three files answer whether the mission earned its PASS.

Rule: one directory per mission under `.mugiwara/missions/<mission>/`, bare names, no date prefixes. Dates live in state JSON and git history. Savepoint writes state at every flow-stage boundary. Archive folds the trail into `report.md`.

| Group | Files | Written by | When |
|---|---|---|---|
| Plan and spec | `plan.md`, `spec.md` | Nami, Usopp | Flow 1 to 2 |
| Decisions and blockers | `decisions.md`, `blockers.md` | Luffy, any agent | Every stage, on hit |
| State and resume | state JSON, continue JSON | savepoint script | Every boundary |
| Execution | execution file, todos file | Zoro | Flow 3 |
| Audit, quality, gates | audit, quality, gates files | Chopper, Sanji, Franky | Flow 4 to 6 |
| Review, security, healing | review, security, healing files | Robin, Jinbe, Brook | Flow 7 to 8 |
| Closure and report | closure, `report.md`, PR verdict | Luffy, archive | Flow 9 |
| Ledger and index | `lessons.md`, `index.md`, provenance, rollback | Keeper, archive | Cross-mission |

Small work writes a small trail: state, one execution file, and the closure report. Plan, spec, and per-flow-stage files appear on lean lanes only when a blocker occurs. After archive the mission dir keeps plan plus report with provenance and rollback beside them when derivable.

Reviewer order: report first, gate verdict second, audit spot-check third, findings count fourth, provenance fifth, raw state numbers last. Commit the trail: plan, spec, decisions, blockers, review, security, flows, and report stay versioned. State JSON stays ignored and recomputed. A trail that vanishes at merge is no trail.
