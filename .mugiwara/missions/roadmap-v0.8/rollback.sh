#!/usr/bin/env bash
# Rollback map for mission "roadmap-v0.8" — generated at closure.
# Human-executed. Review before running; mugiwara never runs this.
# Branch: feat/roadmap-v0.8
# Base:   91a8880735d17eeba0bbe54e41e0bdefcc74dd69

set -euo pipefail

# Revert newest-first so earlier reverts never conflict with later ones.
git revert --no-edit \
  af06f933340fa9b61ff1f36c5c5881a1e1a8e94a \
  e9e89e23e5883cfa3367d6c1e342577a7e7d3428 \
  1d8ff4a6bcdaa50dfaa94e0873d1566cd865cf67 \
  274ce9c2ba5491077f781ea71dcb98a00cafb143 \
  25a46c576152740d206274edeb71b90dc8ec7170 \
  17007a92e1bfee39b671ec9e65e9f758cb205b63 \
  93e63f4901f28c12980da7725eb1fc34b9ad2af0 \
  d53f73596458fca2d3de600dd01b826c4241841b \
  faeb3202245abdc7ceb7e1c275dcfa3e404c0934 \
  8985e3a170e32b4f8719aacb227c4ecc8174c644 \
  515e9341fec29e55f3f3cffd8d8e3401796df3ec \
  adb709a3e403ec7ceacd40f6912b05ed44ace314 \
  14d6757765f7ffd15f57236de7dc78dc104ac3c5 \
  dda63d086012fb0b535956d1166061d4c21f837d \
  8926efeab6b014d33efd0a10f30d5b35d6b0a2b4 \
  98fde73cd887bffdda771407950447a5692301ab \
  6485f3506ecddf3331c8896b2700662d89d24339 \
  e3c2afe2b9fc9a3328eafb2b7d75b8a682ca22da \
  6bbb2ce3e65d10c2bba391ffe7da2e32bbf0ae17 \
  85f92a016b71eb97d9d4c1f184242cac9f62eeb4 \
  d1d631f91e3a65bd7c0f7a7bfe51fc783fdc044f

# Files this mission touched (verify the working tree is clean afterwards):
#   ROADMAP.md
#   content/skills/mugiwara-backend/SKILL.md
#   content/skills/mugiwara-checkpoint/SKILL.md
#   content/skills/mugiwara-contract-first/SKILL.md
#   content/skills/mugiwara-execution/SKILL.md
#   content/skills/mugiwara-frontend/SKILL.md
#   content/skills/mugiwara-gates/SKILL.md
#   content/skills/mugiwara-healing/SKILL.md
#   content/skills/mugiwara-planning/SKILL.md
#   content/skills/mugiwara-quality/SKILL.md
#   content/skills/mugiwara-review/SKILL.md
#   content/skills/mugiwara-security/SKILL.md
#   docs/archive/ROADMAP-0.7.0.md
#   evals/cases/retrieval/backend.json
#   evals/cases/retrieval/checkpoint.json
#   evals/cases/retrieval/contract-first.json
#   evals/cases/retrieval/execution.json
#   evals/cases/retrieval/frontend.json
#   evals/cases/retrieval/gates.json
#   evals/cases/retrieval/healing.json
#   evals/cases/retrieval/planning.json
#   evals/cases/retrieval/quality.json
#   evals/cases/retrieval/review.json
#   evals/cases/retrieval/security.json
#   evals/floor.json
#   scripts/lib/lane-base.sh
#   scripts/retrieval-eval.ts
#   scripts/savepoint.sh
#   scripts/validate-content.ts
#   src/args.ts
#   src/budget.ts
#   src/check-artifacts.ts
#   src/cli.ts
#   src/config.ts
#   src/installer.ts
#   src/mission.ts
#   src/sign.ts
#   test/check-artifacts.test.ts
#   test/cli.test.ts
#   test/closure-runtime.test.ts
#   test/config.test.ts
#   test/sign.test.ts
#   test/validate-content.test.ts
