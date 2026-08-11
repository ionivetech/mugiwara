#!/usr/bin/env bun
// hooks/session-start.ts — SessionStart hook: reminds the agent the crew is available.
console.log(
  JSON.stringify({
    additionalContext:
      "Mugiwara crew available. Run the crew inline in the main conversation — start by invoking `using-mugiwara` (embodied inline) which routes to the right crew member; embody ONE crew role at a time using its skill. Never Task-dispatch a crew member: Luffy delegates to Usopp or Nami, then the pipeline flows usopp -> nami -> zoro -> chopper -> sanji -> franky -> review -> healing -> closure. Subagents only for [PARALLEL] task batches (Zoro workers), concurrent review/security (Robin || Jinbe), and independent re-run checks. See skills/mugiwara-workflow."
  })
);
