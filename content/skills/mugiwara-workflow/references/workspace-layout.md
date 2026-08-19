# Workspace layout

Every mission creates and works inside `.mugiwara/` at the repo root.

**Language:** every artifact the crew writes into `.mugiwara/` — plans, logs,
results, reports, spec, state, continue, issues, review — is English, one
language only. The audit trail is shared by the whole team and by future
sessions; it must not depend on the author's conversational language. A
mission artifact in any other language is a defect, not a style choice.

```
.mugiwara/
├── config              → runtime mode config (gitignored; project overrides global)
├── state/<mission>/    → computed mission state per (mission, member): state.json (solo) or <member>.json (mugiwara savepoint)
├── continue/<mission>/ → machine-written resume point per (mission, member): state.json (solo) or <member>.json
├── spec/               → brainstorm output: YYYY-MM-DD-<mission>.md
├── plans/              → plan doc: YYYY-MM-DD-<mission>.md — CLEAN, Nami-only, source of truth from Flow 2
├── results/            → per-mission folder: results/<mission>/ holds every flow-stage artifact
│   └── <mission>/
│       ├── 01-execution.md   → flow stage 3: task table + evidence
│       ├── 02-audit.md       → flow stage 4: checkpoint report
│       ├── 03-quality.md     → flow stage 5: quality report
│       ├── 04-gates.md       → flow stage 6: gate verdict
│       ├── 05-healing.md     → flow 8: healing report (only when heal ran)
│       ├── 06-closure.md     → flow stage 9: closure summary (KEEP at cleanup)
│       ├── 07-pr-verdict.md  → flow stage 9: PR material (KEEP at cleanup)
│       └── todos.md          → execution checkbox list
├── reports/            → mission report (aggregate): YYYY-MM-DD-<mission>.md — one-file summary of all flow stages
├── review/             → review + security findings
├── issues/             → blocker log: YYYY-MM-DD-<mission>-blockers.md
└── logs/               → Luffy's decision + check-in log: YYYY-MM-DD-<mission>.md (deleted at cleanup)
```

Naming rule: every artifact inside `results/<mission>/` uses the SAME mission
name, no date prefix — the folder is the grouping, numbered by flow-stage order
(`01-`, `02-`, …). Unnumbered support files may sit alongside the numbered
ones (`todos.md`, `resume.md`, `eval.md`, evidence logs) and are not part of
the flow-stages table. `reports/` and `logs/` and `plans/` files carry the
`YYYY-MM-DD-` date prefix because they are cross-mission folders; `results/`
does not, because each mission owns its folder.

The plan doc stays clean: it holds ONLY the execution plan (flow stages, tasks,
criteria, risks). Who did what, route decisions, and check-in verdicts go to
`logs/`; the closure report goes to `results/<mission>/06-closure.md`. Nothing
non-plan pollutes the plan doc.

The owning agent creates the folder it needs on first write. No mission
artifacts go outside `.mugiwara/`.

## Cleanup (Flow 9)

Step results are evidence — KEEP every file in `results/<mission>/`
(`01-execution.md` through `05-healing.md`, `todos.md`, `06-closure.md`,
`07-pr-verdict.md`); they feed the mission report and closure links. Delete
only consumed cross-artifacts: `logs/`, `spec/`, `review/`, `issues/`,
`state/<mission>/`, `continue/<mission>/`. Keep
`plans/`, `reports/`, `config`, `logs/lessons.md` (canonical
lessons ledger; cross-mission state: `backup/`, `manifest.json`). List
candidates before deleting.
