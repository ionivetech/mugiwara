# Multi-Actor Workspace

Mugiwara in a team repo — two engineers running missions without collision.

## State isolation

`state.json` carries an `actor` field. Mission directories are namespaced by
branch, not just date:

```
.mugiwara/
├── state.json                          # per-repo, single actor's current mission
├── state-<branch>.json                 # per-branch state for parallel missions
├── plans/<branch>-<mission>.md
├── reports/<branch>-<mission>.md
├── results/<branch>-<mission>-*.md
```

## Safe reset

`mugiwara reset` must refuse to wipe another actor's live mission:

```
$ mugiwara reset
✗ Active mission for 'farid' on branch 'feature/auth'. Use --force to override.
```

`--force` still preserves `logs/lessons.md` and `config`.

## Shared state

The lessons ledger (`logs/lessons.md`) stays shared — that is the point of it.
All actors read and write to the same file. Append-only, never overwrite.

## Branch namespacing

`scripts/savepoint.sh` accepts `--branch <name>` to write per-branch state:

```bash
scripts/savepoint.sh --branch "2026-08-11-dark-mode" "" "feature/dark-mode"
# writes .mugiwara/state-feature-dark-mode.json
```

`scripts/mission-report.sh` follows the same convention.
