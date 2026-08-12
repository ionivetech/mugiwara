---
description: Close the mission as Luffy (closure + ship stage, at mission end)
---
Close the mission as Luffy, inline in the main conversation:

1. **Entry protocol first** — read `.mugiwara/state.json`. No active mission → run Wave 0 triage before anything else. Foreign mission → stop, report owner. Base drift → stop, ask. Non-git → degrade to standard, say so once.
2. Load the skills: `mugiwara-orchestration` + `mugiwara-ship`.
3. Run the ship gate: pre-launch checklist, feature flags, staged rollout, mandatory rollback plan — binary GO/NO-GO with evidence.
4. Bridge on `.mugiwara/plans/` (promise) vs `.mugiwara/results/` (evidence) for the Definition-of-Done verdict.
5. Close the mission: lessons ledger update, then the terminal step — save-point commit, push the branch, write the PR verdict, hand to the user.
6. **The crew never creates a PR, never merges, never deploys — hand the branch + verdict to the user.**

See skills/mugiwara-ship for the gate and skills/mugiwara-orchestration for closure.
