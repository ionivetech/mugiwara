# CLI reference

You need the exact flags for a command and do not want to guess. This page lists every `mugiwara` command as printed by the real CLI (v1.0.5), then the usage of the commands that print their own.

Example: list in-flight missions, then print the resume point for one.

```bash
mugiwara continue
mugiwara continue crew1 jane-doe
```

```
3 missions in flight:

  MISSION  MEMBER           FLOW  TASKS  LANE    MODE
  crew1    jane-doe         2     0/0    direct  guided
  ...
Pick one: mugiwara continue <mission> [member]
```

```
Resumed: crew1 [jane-doe], Flow 2, 0/0 tasks — next_action: verify this flow stage against the plan, then continue per plan (next stage or closure) — run: (no next_session_prompt recorded)
```

Rule: commands that need a mission and are not given one list the candidates and exit with code 2. Nothing is guessed, and `continue` never resumes anything for you. Without a global install, run any command as `npx -y @ionivetech/mugiwara@latest <command>`.

## `mugiwara --help`

Output of `mugiwara --help`:

```
mugiwara 1.0.5 — the Straw Hat crew for AI agents

Usage:
  mugiwara [install]     install the crew (wizard; with --yes uses project + all)
  mugiwara update        replace existing files (backs up differences first)
  mugiwara uninstall     remove installed files via manifest
  mugiwara list          show installations
  mugiwara list --check  health check: show installations + missing files
  mugiwara doctor [--json]
                         read-only repo check (install, hooks, config, lane, missions, version pin);
                         one fix line per failure, exit 1 on any failure
  mugiwara reset         wipe mission state (missions/ + legacy dirs)
  mugiwara archive [<m>]  fold a closed mission's flow files into its report, then remove loose files
                         (no <m>: list missions, exit 2 = pick one)
  mugiwara clean [--include-live] [--stale <date>]
                         batch-archive every closed mission (report.md present, no live state)
  mugiwara continue      list in-flight missions (exit 2 = pick one, nothing resumed)
  mugiwara continue <m> [member]
                         print the exact resume point for that mission/member
  mugiwara status        computed mission state: flow stage, tasks, lane, blockers, budget
  mugiwara cost [--mission <id>] [--json] [--ledger]
                          show cost ledger, avoided work, efficiency, trail (human + JSON)
   mugiwara features explain|list [--mission <id>] [--json]
                           show resolved features= extensions: rows (human) + replay JSON
   mugiwara waste [--mission <id>] [--files <scope>]
                           advisory waste detectors over the mission diff (never blocks)
  mugiwara handoff [<m>] write .mugiwara/missions/<m>/handoff.md — a report the next
                         engineer can act on (computed state + staleness check)
                         [--path <file>: append the provenance note for <file>]
                         (no <m>: list in-flight, exit 2 = pick one)
  mugiwara sign [<m>]    attestation: sign report.md (auto/minisign/pure/off; --verify to check)
                         (no <m>: list signable, exit 2 = pick one)
  mugiwara sign --gen-key [--backend pure|minisign]
                         create signing keys (pure ed25519 default)
  mugiwara migrate [--dry-run] [--project <dir>]
                           move legacy .mugiwara/state/ layout to .mugiwara/missions/
  mugiwara migrate --to-team <member> [--mission <id>] [--dry-run]
                           move state.json -> <member>.json (solo -> team)
  mugiwara migrate --to-solo <member> [--mission <id>] [--dry-run]
                           move <member>.json -> state.json (team -> solo; refuses if >1 member)
  mugiwara lesson "<text>" append a dated row to .mugiwara/lessons.md
  mugiwara run <script> [args...]
                          run a bundled harness script here (savepoint.sh, lane.sh)
  mugiwara savepoint <mission> [member] [flow] [mode]   (or: savepoint <mission> --flow <N>)
                          shorthand for: mugiwara run savepoint.sh ...
                          (--solo forces solo even with an active-member cache)
  mugiwara --help        this help
  mugiwara --version     print version

Flags:
  --global               user-wide install
  --project <dir>        project install (default: cwd)
  --target <ids|all>     comma-separated: claude, opencode, copilot, gemini, codex, windsurf, cline, kilo, antigravity
  --yes, -y              non-interactive (defaults: project, all targets)
  --force                overwrite differing files (with backup)
  --dry-run              print actions without writing
  --check                with list: report missing + stale files (health check)
   --all                  with continue/status: every actor
   --include-live         with clean: include in-flight missions
   --force                with clean --include-live: archive in-flight missions anyway
   --stale <date>         with clean: also archive missions untouched since this date
   --keep-logs            with reset: keep lessons.md (lessons ledger survives)
```

Two commands work but are not listed in `--help`: `mugiwara join` and `mugiwara plan`. Their usage is below. `sign` is an optional add-on, see [signing](../optional/signing.md).

## `mugiwara doctor`

Read-only repo check: install, hooks, config, lane, mission files. Each failure gets a fix line. Exit 1 on any failure. `--json` prints `{ version, ok, checks }`.

It also compares the npx pin in `.claude/commands/mugiwara.md` with the CLI. `install` warns on the same mismatch.

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

- `--target` accepts the nine ids printed above. Cursor, Kimi and Pi install through their own marketplace manifests, and the CLI refuses them with a message saying so. See [install](../install.md).
- `mugiwara run lane.sh` prints the computed lane (`direct`, `lean`, `standard`, `full`) for the current diff.
- `mugiwara mode <guided|semi|auto>` is something you say in chat, not a CLI command.
- Closing a mission: `archive` folds one, `clean` folds every closed one. See [the trail](../concepts/trail.md).
