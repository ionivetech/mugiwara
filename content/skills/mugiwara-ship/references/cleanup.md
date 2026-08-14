# Cleanup (after the terminal step)

Once the branch is pushed and the PR material is written, clean `.mugiwara/` of
consumed intermediates. Never touch anything outside `.mugiwara/`.

**KEEP** (the audit trail and PR material):

- `config`
- `plans/YYYY-MM-DD-<mission>.md` — the clean plan doc
- `results/<mission>/06-closure.md` — closure report
- `results/<mission>/07-pr-verdict.md` — PR material
- `reports/YYYY-MM-DD-<mission>.md` — the mission report (the consolidated evidence)
- `logs/lessons.md` and any cross-mission state (`backup/`, `manifest.json`)

**ARCHIVE, then remove** (fold into the mission report first, never delete outright):

- `results/<mission>/01-execution.md` … `05-healing.md`, `todos.md` — wave artifacts, folded
- `spec/YYYY-MM-DD-<mission>.md` — consumed by planning
- `review/`, `issues/` per-mission findings — folded into the report
- `logs/YYYY-MM-DD-<mission>.md` and mode-flip logs — folded
- `.mugiwara/continue/<mission>/[member].json` — consumed once closed (delete by exact name, never a glob)

Procedure: run `mugiwara archive <mission>` (dry-run first), which folds evidence
into the report, removes the loose files, and appends a summary-index line.
A mission is only closed after the archive runs — the trail must survive the merge.
