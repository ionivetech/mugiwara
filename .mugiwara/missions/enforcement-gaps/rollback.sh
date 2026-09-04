#!/usr/bin/env bash
# Rollback map for mission "enforcement-gaps" — generated at closure.
# Human-executed. Review before running; mugiwara never runs this.
# Branch: enforcement-gaps
# Base:   74599fa145757a12ba3d7598387ff925323cead4

set -euo pipefail

# Revert newest-first so earlier reverts never conflict with later ones.
git revert --no-edit \
  a065cdfbd31a70ff7089082cf2179e274ef37966 \
  41173216998d4faee829790400f4c1d7c3f09128 \
  a0102ebd2310e39e6e4ce8fc8e4393154cb6db57 \
  1e363f4cc96d8ccc0935a8b868217446018f2b2b \
  23d01d62f66417e6b8df601a88f415c1b5b6b4f6 \
  cf09b72e181e1967c00b843e9a0ff695ddf33dce \
  2220ba10a1b8d898b3934885812e7dcffde60828 \
  f848ae0f351209ce7365c378cfdfb1188749ce2f \
  1792f90b455b68b99bef2464cba8d6d53531159e \
  304ed085a57f738478156a41bcd090e13a057c49 \
  7be4b9fb28ba6b70b7a01ff83505acedb37bea99 \
  9820a5604560cd5dd2907d588a399613ed223ff6 \
  d546176acb5cb5183f5bd7521d2bc1b8b35822bc \
  6d965bb4bfc4ea9fb803e4e61e78cbc55e843e22

# Files this mission touched (verify the working tree is clean afterwards):
#   .opencode/plugins/mugiwara.mjs
#   content/agents/luffy-orchestrator.md
#   content/skills/mugiwara-ship/SKILL.md
#   docs/concepts/enforcement.md
#   docs/concepts/security.md
#   docs/reference/harness-matrix.md
#   hooks/hooks.json
#   hooks/pipeline-guard.js
#   hooks/pipeline-guard.ts
#   hooks/pretool-guard.js
#   hooks/pretool-guard.ts
#   scripts/build-hooks.ts
#   scripts/gate-selftest.ts
#   scripts/validate-content.ts
#   src/guards.ts
#   src/targets/claude.ts
#   test/guards.test.ts
#   test/hooks.test.ts
#   test/plugin.test.ts
