---
name: "source-command-mugiwara-security"
description: "Security-audit the diff as Jinbe (security stage, can run concurrent with review)"
---

# source-command-mugiwara-security

Use this skill when the user asks to run the migrated source command `mugiwara-security`.

## Command Template

Security-audit the diff as Jinbe, inline in the main conversation:

1. **Entry protocol first** — read the mission state (`.mugiwara/missions/<mission>/state.json` (`<member>.json` in a team)). No active mission → run Flow 0 triage before anything else. Foreign mission → stop, report owner. Base drift → stop, ask. Non-git → degrade to standard, say so once.
2. Load the skill: `mugiwara-security`.
3. STRIDE first, OWASP Top 10 mapping, then the full checklist in order: secrets, injection, authn/authz, data exposure, dependencies, deserialization, crypto.
4. Use `.mugiwara/missions/<mission>/flows/` evidence and `security.md` in the mission folder as the bridge.
5. Write findings to `.mugiwara/missions/<mission>/security.md` with CVSS-style severity. Never fixes code.
6. **Return the findings to Luffy — do not choose the next wave.**

See skills/mugiwara-security for the full checklist.
