#!/usr/bin/env bash
# Rollback map for mission "seamless-pipeline" — generated at closure.
# Human-executed. Review before running; mugiwara never runs this.
# Branch: fix/seamless-pipeline
# Base:   6aeac9c9da24bc6af8d13e6efa95c0d7ffc2853c

set -euo pipefail

# Revert newest-first so earlier reverts never conflict with later ones.
git revert --no-edit \
  6b6dc87cc0fb3de3d4fbed870caf2137e6daa916 \
  b4742862e3ce7f111c7959fcb865d35c189351ee \
  ac635d92a9d05aef06a26f12e98d3b3a688ca934 \
  72324e87128f0ed9535440f63fb5903eca6464d9 \
  51d93fdde0586767d06082ee20b2ef7ea0f95cf0 \
  9181386434ecc77ee09cdfa84eeab819811e455f \
  07df95cfe8fcb0f73ed59b79e4a98f8a61a01be2 \
  1cf3598e4f328f00d8690a93fcf94ba7e0d96f47 \
  5828c72b58fad36ed72f37008062db6f93206abe \
  eb85aaf70c0b4aa3254e0ae8feabeb477d7a8f7e \
  15d7f5e6107ece027ff7d7b5b50e10b7e09d7f0c \
  9a6dc07256cf51826b41aa27ed82e86115cc9767 \
  4d75aa9e4502f97e4e906ca4c66ab664e5efd459 \
  d17eb13dbdc99cb9e37d9d020297cc5992ea050d \
  af191a925a311a3a21475df8f751ff15e39f9f5e

# Files this mission touched (verify the working tree is clean afterwards):
#   .mugiwara/missions/seamless-pipeline/context-registry.jsonl
#   .mugiwara/missions/seamless-pipeline/continue.json
#   .mugiwara/missions/seamless-pipeline/decisions.md
#   .mugiwara/missions/seamless-pipeline/flows/06-closure.md
#   .mugiwara/missions/seamless-pipeline/flows/07-pr-verdict.md
#   .mugiwara/missions/seamless-pipeline/flows/todos.md
#   .mugiwara/missions/seamless-pipeline/plan.md
#   .mugiwara/missions/seamless-pipeline/spec.md
#   .mugiwara/missions/seamless-pipeline/state.json
#   README.md
#   content/skills/mugiwara-checkpoint/SKILL.md
#   content/skills/mugiwara-execution/SKILL.md
#   content/skills/mugiwara-gates/SKILL.md
#   content/skills/mugiwara-healing/SKILL.md
#   content/skills/mugiwara-orchestration/SKILL.md
#   content/skills/mugiwara-orchestration/references/check-ins.md
#   content/skills/mugiwara-orchestration/references/output-contract.md
#   content/skills/mugiwara-quality/SKILL.md
#   content/skills/mugiwara-review/SKILL.md
#   content/skills/mugiwara-security/SKILL.md
#   content/skills/mugiwara-workflow/SKILL.md
#   docs/adoption.md
#   docs/concepts/execution-model.md
#   docs/concepts/features.md
#   docs/concepts/workflow.md
#   docs/reference/glossary.md
#   hooks/engagement-marker.js
#   hooks/engagement-marker.ts
#   hooks/pipeline-guard.js
#   hooks/pipeline-guard.ts
#   references/wave-banners.md
#   scripts/gate-selftest.ts
#   scripts/savepoint.sh
#   scripts/validate-content.ts
#   src/cli.ts
#   src/initiative.ts
#   test/cli-coverage.test.ts
#   test/hooks.test.ts
#   test/initiative.test.ts
