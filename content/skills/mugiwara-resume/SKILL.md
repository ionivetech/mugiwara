---
name: mugiwara-resume
description: Use when mission interrupted, context lost, or new session mid-mission — rebuild from .mugiwara/state.json, continue never restart.
---

# Session Resume (Never Start Over)

## Skip when

- Fresh mission: no `.mugiwara/` state exists to rebuild from.
- No interruption, compaction, or new-session-mid-mission happened.

The host AI can lose context — compaction, new session, crash. Disk state is truth. Rebuild from one file, continue from exact point, never restart.

## State contract

Resume reads one file: `.mugiwara/state.json`. All position data is computed at every wave boundary by `scripts/savepoint.sh`.

```json
{
  "mission": "2026-08-11-invitation-accepted",
  "actor": "farid",
  "branch": "feature/feat-MKR-412",
  "lane": "full",
  "lane_reason": "auth/ path touched",
  "wave": 5,
  "mode": "guided",
  "base_sha": "a3f1c2e",
  "files_touched": 11,
  "loc_delta": 340,
  "sensitive_paths": ["src/auth/invitation.ts"],
  "tasks": { "done": 7, "total": 12 },
  "blockers_open": 1,
  "heal_cycle": 1,
  "tokens_est": 14200,
  "budget": 20000,
  "evidence": [".mugiwara/results/wave4-audit.md"],
  "updated_at": "2026-08-11T12:40:00Z"
}
```

## Resume protocol

1. Read `.mugiwara/state.json`. If absent, this is a fresh mission — no resume needed.
2. Derive position from fields: wave N, tasks done/total, blockers open, heal cycle, mode.
3. If `state.json` is stale or corrupted, fall back to legacy files: plan doc → todos → trace → blocker ledger → config. Then write a fresh `state.json`.
4. State it: "Resumed: Wave 5, 7/12 tasks, 1 blocker, heal cycle 1, mode guided."
5. Read `.mugiwara/continue.md` if present. If it exists, state it: `"Resumed: <mission> <sub_mission>, Wave N, X/Y tasks — next_action: <exact> — run: <next_session_prompt>"`.
6. Continue — do not re-verify completed waves.

## Rules

1. Never trust memory over disk — disk is truth.
2. Never re-run completed work — state.json proves it.
3. Never skip the resume read — guessing position = drift.
4. If state.json is absent and no legacy files exist → fresh mission, escalate to Luffy.
5. continue.md overrides state.json for next_action — state.json proves what is done, continue.md says what is next.
6. Output the handoff line: if continue.md exists, its next_session_prompt is the resume output line.

## Rationalizations

- "I remember where we were" → memory lies after compaction; disk is truth.
- "Re-running is safer" → wastes the mission; trust state.json.
- "I'll update state later" → savepoint.sh runs at every wave boundary; state is always current.

## Red flags

- Resume position stated without citing state.json or legacy files.
- Re-doing a wave state.json shows complete.
- Inventing state instead of escalating when files are missing.
