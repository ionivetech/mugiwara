# Workspace layout

Every mission creates and works inside `.mugiwara/` at the repo root.
One directory per mission — everything about a mission lives together.

**Language:** every artifact the crew writes into `.mugiwara/` — plans, waves,
reports, spec, state, continue, blockers, review, decisions — is English, one
language only. The audit trail is shared by the whole team and by future
sessions; it must not depend on the author's conversational language. A
mission artifact in any other language is a defect, not a style choice.

```
.mugiwara/
├── config                  → runtime mode config (gitignored; project overrides global)
├── lessons.md              → cross-mission lessons ledger (memory keeper)
├── index.md                → one line per archived mission (written by mugiwara archive/clean)
└── missions/<mission>/     → ONE dir per mission; bare names, no date prefixes
    ├── plan.md             → CLEAN execution plan — Nami-only, source of truth from Flow 2
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
    └── flows/              → per-flow-stage artifacts, numbered by flow order
        ├── 01-execution.md → flow stage 3: task table + evidence
        ├── 02-audit.md     → flow stage 4: checkpoint report
        ├── 03-quality.md   → flow stage 5: quality report
        ├── 04-gates.md     → flow stage 6: gate verdict
        ├── 05-healing.md   → flow stage 8: healing report (only when heal ran)
        ├── 06-closure.md   → flow stage 9: closure summary (seeds report.md)
        ├── 07-pr-verdict.md→ flow stage 9: PR material
        ├── 08-verifier.md  → flow stage 4.5: skeptic findings (optional)
        └── todos.md        → execution checkbox list
```

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

## Cleanup (Flow 9)

Run `mugiwara archive <mission>` (dry-run first). It folds every flow file,
review, security, blockers, and decisions into `report.md`, then removes them
along with session state (`*.json`). The PR material
(`flows/07-pr-verdict.md`) survives as a standalone `pr-verdict.md` at the
mission root — it is the handoff to the user and must not fold away. The
mission dir ends as durable files: `plan.md` + `report.md` +
`pr-verdict.md` (+ rollback/provenance). Batch form for several closed
missions: `mugiwara clean [--all] [--before <date>]`.
