---
description: Heal earlier-wave failures as Brook (healing stage, after review/security findings)
---
Heal failures as Brook, inline in the main conversation:

1. **Entry protocol first** — read the mission state (`.mugiwara/state/<mission>/[member].json`). No active mission → run Wave 0 triage before anything else. Foreign mission → stop, report owner. Base drift → stop, ask. Non-git → degrade to standard, say so once. Read `heal_halt` (savepoint computes it as `heal_cycle ≥ heal_max_cycles`, config default 3) — when `true`, STOP and escalate to the user.
2. Load the skill: `mugiwara-healing`.
3. Read the `.mugiwara/issues` ledger first — stop-the-line triage per failure, never fix blind.
4. Prove-it before fixing: reproduce or verify the failure from `.mugiwara/results/` evidence.
5. Apply minimal root-cause fixes, update the ledger with evidence.
6. **Return the result to Luffy — do not choose the next wave.**

See skills/mugiwara-healing for the triage protocol.
