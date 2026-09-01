#!/usr/bin/env bash
# Rollback map for mission "seamless-governors" — generated at closure.
# Human-executed. Review before running; mugiwara never runs this.
# Branch: feat/seamless-governors
# Base:   3b6f25300bd090b6c263ffe2c500814b13a79ccc

set -euo pipefail

# Revert newest-first so earlier reverts never conflict with later ones.
git revert --no-edit \
  0d2664cb1746ff5fe3523c66affa46076497b97a \
  79db99b4c856ece231b3c5fae42e0fcca46f176c \
  dd16c0c8002618c6187dbf619abbd220b292471b \
  f7f7e210c3bdd0a4e318d41b142f109a90b8d1b3 \
  d6027de22c5ea40a8e3426edf19f0c5976d8af6a \
  9c327a4a97933436f7081bfd9c76283ac55ec967 \
  11a885d87c7b8ff133eec28ddc18f1917346e7d8 \
  45387d3c40817ebd4b68a5d8d1713c9261fc2e21 \
  9cb558dd71f6d98c9f2560ce2168963dcd3de934 \
  4596ff69d1a8409931360f5c3b6ed03a9b0d7bab \
  cec3723a080b7d88a7cee1658e88b74797983fa0 \
  355df73b14a1fbf34242982353aae2f7890cc254 \
  492edcc9590e42152d57df1410c7b72ac71e9b15 \
  cbef1ffcfff883fa27b8ad2f1030230f4b91fbde \
  356ffdd99d0190cb7ee7b844000a554e3ada763c \
  12b2bb68d503e285327cc35cb54a379ac7fcc0e4 \
  cf0698aba52de62249d44b25b98a2893318b0dd9

# Files this mission touched (verify the working tree is clean afterwards):
#   .metrics/latest.json
#   .mugiwara/missions/seamless-governors/decisions.md
#   .mugiwara/missions/seamless-governors/flows/01-execution.md
#   .mugiwara/missions/seamless-governors/flows/02-execution.md
#   .mugiwara/missions/seamless-governors/flows/03-execution.md
#   .mugiwara/missions/seamless-governors/flows/05-healing.md
#   .mugiwara/missions/seamless-governors/flows/08-healing.md
#   .mugiwara/missions/seamless-governors/flows/todos.md
#   .mugiwara/missions/seamless-governors/plan.md
#   .mugiwara/missions/seamless-governors/security.md
#   .mugiwara/missions/seamless-governors/spec.md
#   README.md
#   content/agents/brook-healing.md
#   content/agents/memory-keeper.md
#   content/agents/zoro-execution.md
#   content/skills/mugiwara-execution/SKILL.md
#   content/skills/mugiwara-execution/references/dispatch.md
#   content/skills/mugiwara-gates/SKILL.md
#   content/skills/mugiwara-healing/SKILL.md
#   content/skills/mugiwara-lessons/SKILL.md
#   content/skills/mugiwara-orchestration/SKILL.md
#   content/skills/mugiwara-quality/SKILL.md
#   content/skills/mugiwara-quality/references/order-checklist.md
#   content/skills/mugiwara-resume/SKILL.md
#   content/skills/mugiwara-resume/references/resume-protocol.md
#   content/skills/mugiwara-review/SKILL.md
#   content/skills/mugiwara-review/references/red-flags-review.md
#   content/skills/mugiwara-workflow/SKILL.md
#   content/skills/mugiwara-workflow/references/adaptive-budget-governor.md
#   content/skills/mugiwara-workflow/references/benchmark-governor.md
#   content/skills/mugiwara-workflow/references/cognitive-output-governor.md
#   content/skills/mugiwara-workflow/references/scope-code-governor.md
#   content/skills/mugiwara-workflow/references/stop-slop-governor.md
#   docs/concepts/policy-as-code.md
#   docs/reference/harness-matrix.md
#   hooks/mugiwara-mode-tracker.js
#   hooks/mugiwara-mode-tracker.ts
#   hooks/session-start.js
#   hooks/session-start.ts
#   package.json
#   references/cost-governor.md
#   scripts/gate-selftest.ts
#   scripts/savepoint.sh
#   scripts/validate-content.ts
#   scripts/verify-install.ts
#   scripts/write-metrics.ts
#   src/budget.ts
#   src/cli.ts
#   src/config.ts
#   src/continue.ts
#   src/cost.ts
#   src/integrity.ts
#   src/mission.ts
#   src/policy.ts
#   src/provenance.ts
#   src/sign.ts
#   test/adaptive-budget.test.ts
#   test/cli-heal.test.ts
#   test/cli.test.ts
#   test/closure-runtime.test.ts
#   test/config.test.ts
#   test/direct-seamless.test.ts
#   test/golden/antigravity.json
#   test/golden/claude.json
#   test/golden/cline.json
#   test/golden/codex.json
#   test/golden/copilot.json
#   test/golden/gemini.json
#   test/golden/kilo.json
#   test/golden/opencode.json
#   test/golden/windsurf.json
#   test/harness-policy.test.ts
#   test/integrity.test.ts
#   test/migrate.test.ts
#   test/provenance.test.ts
#   test/reporting.test.ts
#   test/sign-trust.test.ts
