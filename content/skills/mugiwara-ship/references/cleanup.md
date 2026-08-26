# Cleanup (after the terminal step)

Once the branch is pushed and the PR material is written, compact the mission
dir to its durable core. Never touch anything outside `.mugiwara/`.

**KEEP** (the audit trail and PR material):

- `config`, `lessons.md` — cross-mission
- `missions/<mission>/plan.md` — the clean plan doc
- `missions/<mission>/report.md` — the consolidated evidence: closure report
  with every flow file, review, security, blockers, and decisions folded in
- any cross-mission state (`backup/`, `manifest.json`)

**FOLDED, then removed by archive**:

- `missions/<mission>/flows/01-execution.md` … `08-verifier.md`, `todos.md`
- `missions/<mission>/spec.md` — consumed by planning
- `missions/<mission>/review.md`, `security.md`, `blockers.md`, `decisions.md`
- `missions/<mission>/state.json | <member>.json`,
  `continue.json | continue-<member>.json` — session state dies with the mission

Procedure: run `mugiwara archive <mission>` (dry-run first) — it folds the wave
files into `report.md`, removes the loose files, and appends an index line to
`.mugiwara/index.md`. Batch form for several closed missions:
`mugiwara clean [--all] [--before <date>]`.
A mission is only closed after the archive runs — the trail must survive the merge.
