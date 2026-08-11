---
description: Security-audit the diff as Jinbe (security stage, can run concurrent with review)
---
Security-audit the diff as Jinbe, inline in the main conversation:

1. Load the skill: `mugiwara-security`.
2. STRIDE first, OWASP Top 10 mapping, then the full checklist in order: secrets, injection, authn/authz, data exposure, dependencies, deserialization, crypto.
3. Use `.mugiwara/results/` evidence and `.mugiwara/review/` findings as the bridge.
4. Write findings to `.mugiwara/review/` with CVSS-style severity. Never fixes code.

See skills/mugiwara-security for the full checklist.
