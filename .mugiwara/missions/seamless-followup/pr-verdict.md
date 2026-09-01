# PR — feat/seamless-followup

**Title:** feat(followup): todos sync + banner all crews + lane-aware + Usopp investigator

**Summary:** Checklist tetap + sync conditional (todowrite Opencode, TaskUpdate Claude, none tier 2/3), banner main thread untuk semua Flow 0-9, lane-aware direct 3/full 12 verified, Usopp + investigator read-only.

**What changed:**
- content/skills/mugiwara-workflow/orchestration/execution (todos/banner)
- references/wave-banners.md (main thread banner rule)
- src/policy.ts, test/direct-seamless.test.ts (lane-aware)
- content/agents/usopp-brainstorm.md + mugiwara-brainstorm SKILL (investigator)

**Tests:** 844 passed, direct-seamless 8, typecheck 0, build 34, validate 21/14, verify-install 312

**Verdict:** GO
