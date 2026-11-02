---
name: "source-command-mugiwara-review"
description: "Review the mission diff as Robin (review stage, after gates pass)"
---

# source-command-mugiwara-review

Use this skill when the user asks to run the migrated source command `mugiwara-review`.

## Command Template

Review the diff adversarially as Robin, inline in the main conversation:

1. **Entry protocol first** — read the mission state (`.mugiwara/missions/<mission>/state.json` (`<member>.json` in a team)). No active mission → run Flow 0 triage before anything else. Foreign mission → stop, report owner. Base drift → stop, ask. Non-git → degrade to standard, say so once.
2. Load the skill: `mugiwara-review`.
3. Run the doubt-driven review: breaking-change damage map first, five-axis review, severity criteria, dispute hierarchy.
4. Use `.mugiwara/missions/<mission>/flows/` evidence and `review.md` in the mission folder as the bridge.
5. Write findings to `.mugiwara/missions/<mission>/review.md`; escalate after 3 cycles. Never fixes code.
6. **Return the findings to Luffy — do not choose the next wave.**

See skills/mugiwara-review for the full protocol.
