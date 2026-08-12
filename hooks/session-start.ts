#!/usr/bin/env bun
// hooks/session-start.ts — SessionStart hook: reminds the agent the crew is available.
console.log(
  JSON.stringify({
    additionalContext:
      "IRON LAW: Mugiwara crew active. Before ANY task — load \\`mugiwara-orchestration\\` skill as gatekeeper. NEVER execute, answer, or make changes without Wave 0 triage. Classification overhead <15 seconds — cheaper than an incorrect fix. Lane 0 for trivial work (single-file/<20 LOC) skips pipeline; Lane 1+ follows full pipeline. Mode: guided / semi / auto (see .mugiwara/config). Switch with \\`/mugiwara <mode>\\`. See skills/mugiwara-workflow."
  })
);
