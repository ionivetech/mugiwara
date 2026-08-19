# Troubleshooting

Common problems, what they mean, and how to fix them.

## Installation

### "conflict (not overwritten; run update to replace with backup)"

The target already has a file that differs from what mugiwara wants to write —
likely a previous install or a local edit. `mugiwara update` (or `--force`)
replaces it and backs up the existing file to `.mugiwara/backup/<timestamp>/`
first.

### `mugiwara install` writes nothing for a target

- **Project scope only.** Rule-based targets (Gemini, Codex, Windsurf, Cline,
  Kilo, Antigravity) reject `--global`; use `--project <dir>`.
- **Skill already current.** A rerun skips identical files — check the "skipped
  N" count in the install output.

### `npx @ionivetech/mugiwara` fails on an old Node

Mugiwara requires **Node.js >= 20.11**. Check `node --version`; upgrade or use
a version manager (nvm, fnm, volta).

## Mission runtime

### The workflow did not auto-activate

- **Restart the harness.** Claude Code and opencode load config at startup; the
  announcement runs on session start.
- **Check the install.** Verify the skills directory exists for your harness
  (`.claude/skills`, `.opencode/skills`, `.kilo/rules`, …). Reinstall with
  `mugiwara update`.

### A skill that should fire does not

- **Trigger match.** Skills activate on their `description` — if the request
  doesn't match, the skill won't load. Rephrase toward the trigger keywords.
- **Skip gate.** Every skill has a `## Skip when` block. If the change matches a
  skip condition, the skill correctly stays out of the way — this is by design.
- **Tier-3 stub.** On rules-dir harnesses, the loaded file is a stub pointing at
  `.mugiwara/refs/<name>.md`. If the full body is missing, reinstall.

### The crew ran too many / too few flow stages

Lane routing sizes the mission at Flow 0. If the estimate was wrong, the lane
escalates when the work outgrows it. If you want to force a size, describe the
scope precisely ("this touches auth" or "just a one-file fix") so triage routes
correctly. There is no config key for the lane.

### A flow stage is skipped silently

Not by design. Luffy records every omitted flow stage and its reason in the decision
log (`.mugiwara/logs/`). If a flow stage vanished with no record, it is a harness bug —
report it with the mission log.

### Context grows too large over a long mission

Evidence lives in `.mugiwara/` files; the conversation carries terse verdicts
and pointers. On tier-3 harnesses the crew also flushes full state to
`.mugiwara/` at each flow stage so a resume does not need the prior context. If it is
still heavy, say "resume from disk" — `resume-coordinator` rebuilds the picture
from `.mugiwara/`.

## Recovery

### I lost context mid-mission

Do not restart. Say "where were we?" — the crew rebuilds from
`.mugiwara/plans/`, results, and the decision log.

### I want to start clean

```bash
mugiwara reset            # wipe spec/plans/results/review/issues/logs
mugiwara reset --keep-logs  # keep the lessons ledger
```

Config, manifest, and backups are always kept.

### A mission branch was pushed by mistake

Nothing on the remote is deleted by mugiwara. Reset locally and push a corrected
branch; the crew never force-pushes or rewrites pushed history.

## Reporting a bug

Open an issue with: harness, install method, the failing command or request,
the `.mugiwara/logs/` decision log, and the relevant `.mugiwara/results/`
output.
