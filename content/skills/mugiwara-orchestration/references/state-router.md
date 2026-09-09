# State-command router (every harness)

`mugiwara <cmd>` means the global binary if present, else
`npx -y @ionivetech/mugiwara@latest <cmd>`. State commands are deterministic
(directory scan + allowlist) — never a reasoning turn. Run them via shell,
print stdout/stderr verbatim, then act on the exit code. This router is a
crew-wide capability: orchestration loads it in every harness (Claude Code,
opencode, Codex, Gemini, Copilot, Windsurf, Cline, Kilo, Antigravity, Pi,
Cursor, Kimi). On Claude Code and opencode it is also surfaced as the
`/mugiwara` slash command, which points here rather than duplicating it.

## Commands

| Command | Needs | No-arg behavior |
|---|---|---|
| `archive [<m>]` | mission optional | lists missions with report + live/closed tags, exit 2 |
| `clean [--include-live] [--stale <date>]` | nothing | batch-archives every closed mission |
| `continue [<m> [member]]` | mission optional | lists in-flight missions/members, exit 2 |
| `status [--all]` | nothing | computed mission state, one screen |
| `cost [--mission <id>] [--ledger]` | nothing | all-mission table; `--mission` drills in |
| `handoff [<m>] [--path <file>]` | mission optional | lists in-flight missions, exit 2 |
| `sign [<m>] [--verify]` / `sign --gen-key` | mission optional | lists report-bearing missions, exit 2 |
| `lesson "<text>"` | the text | usage — a lesson row is appended |
| `migrate [--dry-run] [--to-team\|--to-solo <member>]` | `--dry-run` first | moves solo/team/legacy state |

Bare `archive`, `handoff`, and `sign` (no mission) never guess — they list the
missions that qualify and stop (exit 2). With no candidates they say `nothing
to ...` and stop the same way. Never fabricate a mission name.

## Exit-code protocol

- `0` — done. Report briefly.
- `2` — picker list printed. STOP. The user picks; never auto-pick one of several.
- `1` — error printed verbatim. Fix or escalate; never blind-retry.

## Destructive paths

`archive`/`clean` on a live mission (`--force`, `--include-live`), any
`migrate` (it moves files), and `reset` are destructive. Run the `--dry-run`
first and get explicit user confirmation before the real call. Never `--force`
on your own.

## In-session phrases are not CLI verbs

`mugiwara mode guided|semi|auto` (and `mugiwara off`) are in-session phrases —
no slash, no CLI flag, no `mugiwara mode` argument. Never route them through
this router or to the CLI.
