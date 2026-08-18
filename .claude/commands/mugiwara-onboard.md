---
description: Run the Mugiwara onboarding wizard — zero-LLM terminal wizard via `mugiwara onboard`, writes .mugiwara/config.
---
Mugiwara onboard: $ARGUMENTS

Run the onboarding wizard. One path only — the zero-LLM terminal wizard:

1. Tell the user to run `mugiwara onboard` in their terminal (or `bunx @ionivetech/mugiwara onboard`).
2. Do NOT ask the questions yourself. Do NOT write .mugiwara/config. The wizard is a plain
   script — no LLM, no network, works on every platform.
3. After the user finishes, verify `.mugiwara/config` exists and summarize the values.

The wizard never writes .mugiwara/onboard.json. All 14 crew agents are always active —
no agent-selection step.