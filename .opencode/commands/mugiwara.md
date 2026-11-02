---
description: Mugiwara crew router — modes, state commands (archive, clean, continue, status, cost, handoff, sign, lesson, migrate), workflow entry
---
Mugiwara: $ARGUMENTS

Two jobs: runtime mode switches and crew state commands. Never silently ignore
an argument — every token below routes somewhere.

## 1. Mode switches (in-session phrases, no CLI)

```
/mugiwara guided    # human decides every GO
/mugiwara semi      # auto branch + commit, plan needs GO
/mugiwara auto      # hands-off except high-risk
/mugiwara           # show current mode
```

The flip applies from the next wave, never mid-flow-stage. If a flip arrives
mid-flow-stage, acknowledge it — "recorded, applies from Flow N+1" — never apply
silently, never ignore. Valid modes: guided, semi, auto.

## 2. State commands (run the CLI, print verbatim)

The state-command router is a crew-wide capability — the canonical routing
table and exit-code protocol live in the orchestration skill at
`mugiwara-orchestration/references/state-router.md`. Every harness's agent
loads orchestration and follows that table; this slash command is that same
router surfaced for the hosts that have slash commands.

Run it down the ladder — global `mugiwara <cmd>` if present, else
`npx -y @ionivetech/mugiwara@1.0.5 <cmd>`, else `.mugiwara/bin/` shell
fallbacks, else direct `.mugiwara/missions/` file ops — print stdout/stderr
verbatim, then follow the exit code from the reference. Full ladder:
workflow skill → CLI availability (`references/cli-ladder.md`).

| `/mugiwara ...` | Runs |
|---|---|
| `archive [<m>]` | `mugiwara archive` — bare lists missions to pick |
| `clean [--include-live] [--stale <date>]` | `mugiwara clean` |
| `continue [<m> [member]]` | `mugiwara continue` |
| `status [--all]` | `mugiwara status` |
| `cost [--mission <id>] [--ledger]` | `mugiwara cost` |
| `crew` | `mugiwara crew` — who is on the crew, when each appears, what each may write |
| `handoff [<m>] [--path <file>]` | `mugiwara handoff` — bare lists in-flight |
| `sign [<m>] [--verify]` / `sign --gen-key` | `mugiwara sign` — bare lists signable |
| `lesson "<text>"` | `mugiwara lesson` |
| `migrate [--dry-run] [--to-team\|--to-solo <member>]` | `mugiwara migrate` |

Exit-code protocol: `0` done; `2` picker printed, STOP and let the user pick;
`1` error printed verbatim, fix or escalate. Destructive (`archive`/`clean` on
a live mission, `migrate`, `reset`) needs `--dry-run` + explicit confirmation
first. Unknown word (not a mode, not a table row): do NOT ignore it — show the
table and ask which job was meant.

## 3. Workflow entry

Size the request BEFORE loading anything. A small request must cost about what
a plain agent costs.

- **Full process**: the request mentions or implies login or auth, roles or
  permissions, payments or billing, secrets or tokens, migrations or schema, or
  CI; or it touches 9 or more files; or the user says "use the full crew". FIRST
  load the `mugiwara-orchestration` skill and run triage: record the mission
  with `mugiwara savepoint <mission> --flow 0` (the CLI form; the shell
  fallback takes the same flags). Then follow
  skills/mugiwara-orchestration/references/pipeline.md.
- **Everything else** (one feature or fix, a few files, no risk area above):
  work directly, test-first. Do not load the skill, do not create a mission, do
  not read references, do not delegate. Write the failing test, make it pass,
  run the repo's tests, answer in a few lines: what changed, what ran, what
  you did not check. Treat each edge case the request implies as part of the
  work, not as a follow-up.

If the real diff turns out risky (a sensitive path, 9 or more files), the stop
hook holds the session open and you switch to the full process. `mugiwara off`
for a request stands the crew down.
