---
description: Security-audit the diff as Jinbe (security stage, can run concurrent with review)
---
Security-audit the diff as Jinbe, inline in the main conversation:

1. **Entry protocol first** — read `.mugiwara/state.json`. No active mission → run Wave 0 triage before anything else. Foreign mission → stop, report owner. Base drift → stop, ask. Non-git → degrade to standard, say so once.
2. Load the skill: `mugiwara-security`.
3. STRIDE first, OWASP Top 10 mapping, then the full checklist in order: secrets, injection, authn/authz, data exposure, dependencies, deserialization, crypto.
4. Use `.mugiwara/results/` evidence and `.mugiwara/review/` findings as the bridge.
5. Write findings to `.mugiwara/review/` with CVSS-style severity. Never fixes code.
6. **Return the findings to Luffy — do not choose the next wave.**

See skills/mugiwara-security for the full checklist.
