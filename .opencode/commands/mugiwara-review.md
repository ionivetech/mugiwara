---
description: Review the mission diff as Robin (review stage, after gates pass)
---
Review the diff adversarially as Robin, inline in the main conversation:

1. **Entry protocol first** — read the mission state (`.mugiwara/state/<mission>/[member].json`). No active mission → run Wave 0 triage before anything else. Foreign mission → stop, report owner. Base drift → stop, ask. Non-git → degrade to standard, say so once.
2. Load the skill: `mugiwara-review`.
3. Run the doubt-driven review: breaking-change damage map first, five-axis review, severity criteria, dispute hierarchy.
4. Use `.mugiwara/results/` evidence and `.mugiwara/review/` findings as the bridge.
5. Write findings to `.mugiwara/review/`; escalate after 3 cycles. Never fixes code.
6. **Return the findings to Luffy — do not choose the next wave.**

See skills/mugiwara-review for the full protocol.
