# Sub-plan 01 — §10 Resume Fast-Path

Phase: §10
Goal: `continue`/`status` become read-only position commands — dispatch before
config bootstrap; no `.mugiwara/config` created by read-only commands; exit 2
lists missions/members immediately.

## Tasks

| # | Task | Files | Size | Depends-on | Acceptance |
|---|------|-------|------|------------|------------|
| T1 | Hoist continue/status above config bootstrap | `src/cli.ts` | S | — | read-only commands skip ensureConfig; other commands unchanged |
| T2 | Reinforce CLI-first in resume skill | `content/skills/mugiwara-resume/SKILL.md` | S | T1 | rule #1 states CLI first, exit 2 hard stop |
| T3 | Classify continue/status as control commands | `content/skills/mugiwara-orchestration/SKILL.md` | S | T1 | control commands bypass Flow 0 |

## Detail

### T1 — Hoist continue/status in `src/cli.ts`
- In `run()`, after help/version short-circuits (cli.ts:27-28), before the
  `isDryRunInstall`/`ensureConfig` block (cli.ts:33-39), add:
  ```ts
  if (command === 'continue' || command === 'status') {
    return command === 'continue' ? continueCmd(flags, _) : statusCmd(flags);
  }
  ```
- Both cmd functions already resolve projectDir + read state/continue internally.
- No schema/selection/actor/mode/Cost Governor change.
- Acceptance: `bun test test/continue.test.ts test/cli.test.ts`; fresh-project
  `continue`/`status` create no config; exit 2 lists immediately.

### T2 — resume skill
- Rule #1 already says run CLI first. Verify and make explicit: CLI command is
  the FIRST action, before model planning/orchestration/flow-artifact reads;
  exit 2 = hard stop. One-line edit if already present.

### T3 — orchestration skill
- Add a line under "## Flow transitions" or a new "## Control commands" note:
  `continue`/`status` are control commands — dispatch before Flow 0 and crew
  dispatch until deterministic lookup completes.

## Acceptance
- `bun test test/continue.test.ts test/cli.test.ts` green.
- `bun run typecheck` green.
- Fresh project: `mugiwara continue` creates no `.mugiwara/config`, prints no
  setup chatter, exit 2 on no/ambiguous selection.
