---
description: Run the Mugiwara onboarding wizard — conversation via the onboarding-guide agent, or the terminal wizard (bun scripts/onboard.ts) for CLI users.
---
Mugiwara onboard: $ARGUMENTS

Run the onboarding wizard. Two paths:

1. Conversation (default): the onboarding-guide agent runs the 9-question
   wizard through the host's native question tool (choices + free type),
   then writes .mugiwara/config. No network.
2. Terminal (CLI users / non-interactive hosts):
   `bun scripts/onboard.ts`

The wizard never writes .mugiwara/onboard.json. All 15 crew agents are always
active — no agent-selection step.
