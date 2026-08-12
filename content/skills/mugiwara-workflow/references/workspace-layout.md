# Workspace layout

Every mission creates and works inside `.mugiwara/` at the repo root.

```
.mugiwara/
├── config              → runtime mode config (gitignored; project overrides global)
├── state.json          → computed mission state at every wave boundary (scripts/savepoint.sh)
├── spec/               → brainstorm output: YYYY-MM-DD-<mission>.md
├── plans/              → plan doc: YYYY-MM-DD-<mission>.md — CLEAN, Nami-only, source of truth from Wave 2
├── results/            → wave results: audit/quality/gate reports, todos, closure report
├── reports/            → human-readable mission reports: YYYY-MM-DD-<mission>.md
├── review/             → review + security findings
├── issues/             → blocker log: YYYY-MM-DD-<mission>-blockers.md
└── logs/               → Luffy's decision + check-in log: YYYY-MM-DD-<mission>.md (deleted at cleanup)
```

The plan doc stays clean: it holds ONLY the execution plan (waves, tasks,
criteria, risks). Who did what, route decisions, and check-in verdicts go to
`logs/`; the closure report goes to `results/`. Nothing non-plan pollutes the
plan doc.

The owning agent creates the folder it needs on first write. No mission
artifacts go outside `.mugiwara/`.

## Cleanup (Wave 9)

Delete consumed: `logs/`, `spec/`, `review/`, `issues/`. Keep: `plans/`,
`results/closure`, `results/pr-verdict`, `reports/`, `config`, `state.json`,
`lessons.md` (cross-mission state: `logs/lessons.md`, `backup/`,
`manifest.json`). List candidates before deleting.
