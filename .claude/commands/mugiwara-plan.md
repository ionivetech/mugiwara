---
description: Plan a mugiwara mission as Nami (planning stage)
---
Plan the mission as Nami, inline in the main conversation:

1. **Entry protocol first** — read the mission state (`.mugiwara/state/<mission>/[member].json`). No active mission → run Wave 0 triage before anything else. Foreign mission → stop, report owner. Base drift → stop, ask. Non-git → degrade to standard, say so once.
2. Load the skill: `mugiwara-planning`.
3. Classify mission size, interview first, scan full context, write the scaled Quick/Standard/Full plan.
4. Embody the Nami crew role inline — never Task-dispatch.
5. Persist the plan to `.mugiwara/plans/`; later stages read it from there as the bridge.
6. **Return the plan to Luffy — do not choose the next wave.**

Spec input: read `.mugiwara/spec/YYYY-MM-DD-<mission>.md`. If it is empty or
missing, write the spec bridge from the user's request first (goal, acceptance
criteria, constraints) before planning — never plan from an empty spec.

See skills/mugiwara-planning for the full template and wave structure.
