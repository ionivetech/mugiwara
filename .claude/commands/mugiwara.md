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

Run it through the CLI — `mugiwara <cmd>` = global binary if present, else
`npx -y @ionivetech/mugiwara@latest <cmd>` — print stdout/stderr verbatim, then
follow the exit code from the reference:

| `/mugiwara ...` | Runs |
|---|---|
| `archive [<m>]` | `mugiwara archive` — bare lists missions to pick |
| `clean [--include-live] [--stale <date>]` | `mugiwara clean` |
| `continue [<m> [member]]` | `mugiwara continue` |
| `status [--all]` | `mugiwara status` |
| `cost [--mission <id>] [--ledger]` | `mugiwara cost` |
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

For workflow: `mugiwara-orchestration` auto-loads as gatekeeper — classify, route, check-in, close. See skills/mugiwara-workflow for the full pipeline. `mugiwara off` for a request stands the crew down.
