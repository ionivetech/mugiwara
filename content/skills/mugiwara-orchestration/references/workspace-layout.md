# Workspace layout

Every mission creates and works inside `.mugiwara/` at the repo root.
One directory per mission — everything about a mission lives together.

Language of artifacts: `_shared/references/agent-protocol.md`.

```
.mugiwara/
├── config                  → runtime mode config (gitignored; project overrides global)
├── lessons.md              → cross-mission lessons ledger (memory keeper)
├── index.md                → one line per archived mission (written by mugiwara archive/clean)
└── missions/<mission>/     → ONE dir per mission; bare names, no date prefixes
    ├── plan.md             → CLEAN execution plan — Nami-only, source of truth from the plan stage
    ├── spec.md             → brainstorm output / spec bridge (consumed by planning)
    ├── decisions.md        → Luffy's decision + check-in log (route reasons, mode flips)
    ├── blockers.md         → blocker ledger rows
    ├── review.md           → Robin's findings
    ├── security.md         → Jinbe's findings
    ├── report.md           → closure report; archive folds the flow files into it
    ├── state.json          → computed state per (mission): solo = state.json,
    │   │                     team = <member>.json  (gitignored)
    │   └── continue.json   → machine resume point: solo = continue.json,
    │                         team = continue-<member>.json  (gitignored)
    └── flows/              → per-flow-stage artifacts, ordered by prefix
        ├── 01-execution.md → build stage: task table + evidence
        ├── 02-audit.md     → check stage: report
        ├── 03-quality.md   → quality stage: report
        ├── 04-gates.md     → gates stage: verdict
        ├── 05-healing.md   → fix stage: report (only when a fix ran)
        ├── 06-closure.md   → closing: summary (seeds report.md)
        ├── 07-pr-verdict.md→ closing: PR material
        ├── 08-verifier.md  → doubt pass: findings (optional)
        └── todos.md        → execution checkbox list
```

The `NN-` prefixes only order the files; they do not match Flow numbers (`05-healing.md` is the fix stage, `08-verifier.md` the doubt pass). The stage table in `mugiwara-orchestration` (stages.md) is the source for Flow numbers.

Naming rule: bare names only. The date lives in `state.json` (`updated_at`)
and in git history; the folder is the grouping. Lane 0/1 missions write the
minimum: `state.json`, `flows/01-execution.md`, and `report.md` at closure —
no plan/spec/blockers unless a blocker actually occurs (audit-lite).

The plan doc stays clean: it holds ONLY the execution plan (flow stages, tasks,
criteria, risks). Who did what, route decisions, and check-in verdicts go to
`decisions.md`; the closure summary goes to `report.md`. Nothing non-plan
pollutes the plan doc.

The owning agent creates the folder it needs on first write. No mission
artifacts go outside `.mugiwara/`.

## Cleanup (closing)

Run `mugiwara archive <mission>` (dry-run first). It folds every flow file,
review, security, blockers, and decisions into `report.md`, then removes them
along with session state (`*.json`). The PR material
(`flows/07-pr-verdict.md`) survives as a standalone `pr-verdict.md` at the
mission root — it is the handoff to the user and must not fold away. The
mission dir ends as durable files: `plan.md` + `report.md` +
`pr-verdict.md` (+ rollback/provenance). Batch form for several closed
missions: `mugiwara clean`.
