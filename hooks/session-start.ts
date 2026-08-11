#!/usr/bin/env bun
// hooks/session-start.ts — SessionStart hook: reminds the agent the crew is available.
console.log(
  JSON.stringify({
    additionalContext:
      "Mugiwara crew available. The workflow auto-activates for non-trivial requests (no need to call `/using-mugiwara` at session start; it is optional and routes to the right crew member). The crew runs inline in the main thread — Never Task-dispatch a crew member. Subagents only for [PARALLEL] task batches, concurrent review/security, and independent re-run checks. Checkpoint reports at wave/stage boundaries. Mode: guided / semi / auto (see .mugiwara/config). See skills/mugiwara-workflow."
  })
);
