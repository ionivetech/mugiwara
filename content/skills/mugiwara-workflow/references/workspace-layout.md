# Workspace layout

Every mission creates and works inside `.mugiwara/` at the repo root.

```
.mugiwara/
├── config              → runtime mode config (gitignored; project overrides global)
├── state.json          → computed mission state at every wave boundary (scripts/savepoint.sh)
├── spec/               → brainstorm output: YYYY-MM-DD-<mission>.md
├── plans/              → plan doc: YYYY-MM-DD-<mission>.md — CLEAN, Nami-only, source of truth from Wave 2
├── results/            → per-mission folder: results/<mission>/ holds every wave artifact
│   └── <mission>/
│       ├── 01-execution.md   → wave 3: task table + evidence
│       ├── 02-audit.md       → wave 4: checkpoint report
│       ├── 03-quality.md     → wave 5: quality report
│       ├── 04-gates.md       → wave 6: gate verdict
│       ├── 05-healing.md     → wave 8: healing report (only when heal ran)
│       ├── 06-closure.md     → wave 9: closure summary (KEEP at cleanup)
│       ├── 07-pr-verdict.md  → wave 9: PR material (KEEP at cleanup)
│       └── todos.md          → execution checkbox list
├── reports/            → mission report (aggregate): YYYY-MM-DD-<mission>.md — one-file summary of all waves
├── review/             → review + security findings
├── issues/             → blocker log: YYYY-MM-DD-<mission>-blockers.md
└── logs/               → Luffy's decision + check-in log: YYYY-MM-DD-<mission>.md (deleted at cleanup)
```

Naming rule: every artifact inside `results/<mission>/` uses the SAME mission
name, no date prefix — the folder is the grouping, numbered by wave order
(`01-`, `02-`, …). `reports/` and `logs/` and `plans/` files carry the
`YYYY-MM-DD-` date prefix because they are cross-mission folders; `results/`
does not, because each mission owns its folder.

The plan doc stays clean: it holds ONLY the execution plan (waves, tasks,
criteria, risks). Who did what, route decisions, and check-in verdicts go to
`logs/`; the closure report goes to `results/<mission>/06-closure.md`. Nothing
non-plan pollutes the plan doc.

The owning agent creates the folder it needs on first write. No mission
artifacts go outside `.mugiwara/`.

## Cleanup (Wave 9)

Delete consumed: `results/<mission>/01-execution.md` through
`05-healing.md` and `todos.md` (wave artifacts), `logs/`, `spec/`, `review/`,
`issues/`. Keep: `results/<mission>/06-closure.md`,
`results/<mission>/07-pr-verdict.md`, `plans/`, `reports/`, `config`,
`state.json`, `lessons.md` (cross-mission state: `logs/lessons.md`, `backup/`,
`manifest.json`). List candidates before deleting.
