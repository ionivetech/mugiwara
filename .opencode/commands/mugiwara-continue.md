---
description: Resume an interrupted mission from the exact point — reads .mugiwara/state.json + continue.md, states next_action
---
# /mugiwara continue

Resume mid-mission, never restart. Loads `mugiwara-resume` (the continuation skill).

1. Read `.mugiwara/state.json` — wave, tasks done/total, blockers, mode.
2. Read `.mugiwara/continue.md` if present — it overrides state.json for next_action (state.json proves what is done, continue.md says what is next).
3. State the exact resume point: "Resumed: <mission> <sub_mission>, Wave N, X/Y tasks — next_action: <exact> — run: <next_session_prompt>".
4. If continue.md exists: execute its next_session_prompt.
5. If continue.md is absent: run Wave 0 triage (classify, size the lane, write the decision log, savepoint).
6. Never re-run completed work; never restart from Wave 0 when a resume point exists.
