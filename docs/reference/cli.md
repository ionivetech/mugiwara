# CLI reference

You need the exact flags for a command and do not want to guess. This page lists every `mugiwara` command as printed by the real CLI (v1.0.5), then the usage of the commands that print their own.

Example: list in-flight missions. Then `mugiwara continue crew1 jane-doe` prints that handle's resume point.

```bash
mugiwara continue
```

```
3 missions in flight:

  MISSION  MEMBER           FLOW  TASKS  LANE    MODE
  crew1    jane-doe         2     0/0    direct  guided
  ...
Pick one: mugiwara continue <mission> [member]
```

Rule: commands that need a mission and are not given one list the candidates and exit with code 2. Nothing is guessed. `continue` resumes on its own only when exactly one mission is in flight. Without a global install, run any command as `npx -y @ionivetech/mugiwara@latest <command>`.

## `mugiwara --help`

Output of `mugiwara --help`:

```

```

Two commands work but are not listed in `--help`: `mugiwara join` and `mugiwara plan`. Usage is below. `sign` is an optional [add-on](../optional/signing.md).

## `mugiwara doctor`

Read-only repo check: install, hooks, config, lane, mission files. Each failure gets a fix line; exit 1 on any. `--json` prints `{ version, ok, checks }`.

It also compares the npx pin in `.claude/commands/mugiwara.md` with the CLI. `install` warns on the same mismatch. It also flags a config key set twice (the first line wins) and a mode mismatch: a mission keeps the mode it started in, so a later `mode=` edit does not change it. `status` and `continue` show the mismatch note.

## Corrupt state

`continue`, `status`, `cost` and `archive` stop with exit 1 on a corrupt mission file, naming it and the fix:

```
✗ .mugiwara/missions/crew1/state.json: not valid JSON (truncated or corrupt)
  fix: delete .mugiwara/missions/crew1/state.json (the next savepoint rewrites it), or restore it with git
```

An empty mission directory stops only commands that name a mission.

## Commands that print their own usage

```
usage: mugiwara savepoint --flow <N>  (or positional: savepoint <mission> [member] [flow] [mode])
usage: mugiwara join <mission> <member> --area "<area>" [--files "a.ts,b.ts"]
usage: mugiwara cost [--mission <id>] [--json] [--ledger] [--project <dir>]
usage: mugiwara features explain|list [--mission <id>] [--json] [--project <dir>]
usage: mugiwara waste [--mission <id>] [--files <scope>] [--project <dir>]
usage: mugiwara run <script> [args...]
  scripts: savepoint.sh, lane.sh
usage: mugiwara lesson "<text>" [--project <dir>]
```

`mugiwara plan conflict-check <plan.md>` exits 1 when one file belongs to two sub-missions and prints `no conflicts` otherwise.

## Notes

- `--target` accepts the ten ids printed above. Kimi and Pi install through their own marketplace manifests, and the CLI refuses them with a message saying so. See [install](../install.md).
- `mugiwara run lane.sh` prints the computed lane (`direct`, `lean`, `standard`, `full`) for the current diff.
- `mugiwara mode <guided|semi|auto>` is something you say in chat, not a CLI command.
