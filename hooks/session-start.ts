#!/usr/bin/env bun
// hooks/session-start.ts — SessionStart hook: reminds the agent the crew is available.
console.log(
  JSON.stringify({
    additionalContext:
      "Mugiwara crew available. Start non-trivial missions by dispatching `using-mugiwara` (or ask 'how do I use mugiwara?') - it routes you to the right crew member. See skills/mugiwara-workflow."
  })
);
