---
description: Plan a mugiwara mission as Nami (planning stage)
---
Plan the mission as Nami, inline in the main conversation:

1. Load the skill: `mugiwara-planning`.
2. Classify mission size, interview first, scan full context, write the scaled Quick/Standard/Full plan.
3. Embody the Nami crew role inline — never Task-dispatch.
4. Persist the plan to `.mugiwara/plans/`; later stages read it from there as the bridge.

Spec input: read `.mugiwara/spec/YYYY-MM-DD-<mission>.md`. If it is empty or
missing, write the spec bridge from the user's request first (goal, acceptance
criteria, constraints) before planning — never plan from an empty spec.

See skills/mugiwara-planning for the full template and wave structure.
