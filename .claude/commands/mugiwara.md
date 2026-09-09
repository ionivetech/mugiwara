---
description: Mugiwara crew router — modes, mission state commands (archive, clean, continue, status, cost, handoff, sign, lesson, migrate), workflow entry
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

`mugiwara <cmd>` means the global binary if present, else
`npx -y @ionivetech/mugiwara@latest <cmd>` (same fallback as mugiwara-workflow).
Run it via bash, print stdout/stderr verbatim, then follow the exit code:

| `/mugiwara ...` | Runs | Needs |
|---|---|---|
| `archive [<m>]` | `mugiwara archive` | mission optional — bare lists missions to pick from |
| `clean [--include-live] [--stale <date>]` | `mugiwara clean` | nothing |
| `continue [<m> [member]]` | `mugiwara continue` | see `/mugiwara continue` |
| `status [--all]` | `mugiwara status` | nothing |
| `cost [--mission <id>] [--ledger]` | `mugiwara cost` | nothing |
| `handoff [<m>] [--path <file>]` | `mugiwara handoff` | mission optional — bare lists in-flight |
| `sign [<m>] [--verify]` / `sign --gen-key` | `mugiwara sign` | mission optional — bare lists signable |
| `lesson "<text>"` | `mugiwara lesson` | the text |
| `migrate [--dry-run] [--to-team\|--to-solo <member>]` | `mugiwara migrate` | `--dry-run` first |

Exit-code protocol (same as `/mugiwara continue`):

- `0` → done, report briefly.
- `2` → picker list printed. STOP. The user picks. Never guess a mission.
- `1` → error printed verbatim. Fix or escalate, never retry blindly.

Destructive first: `archive`/`clean` on a live mission (`--force`,
`--include-live`) and any `reset` need explicit user confirmation — show the
`--dry-run` output, then ask. Never `--force` on your own.

Unknown word (not a mode, not a table row): do NOT ignore it — print the table
above and ask which job was meant.

## 3. Workflow entry

For workflow: `mugiwara-orchestration` auto-loads as gatekeeper — classify, route, check-in, close. See skills/mugiwara-workflow for the full pipeline. `mugiwara off` for a request stands the crew down.
