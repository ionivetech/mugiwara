#!/usr/bin/env bash
# Rollback map for mission "invite-user" — generated at closure.
# Human-executed. Review before running; mugiwara never runs this.
# Branch: feat/invite
# Base:   d2c85c3480523592aa5a3e244f4937ca65b2110e

set -euo pipefail

# Revert newest-first so earlier reverts never conflict with later ones.
git revert --no-edit \
  fc4e81faf82f4daddbcb88873281b137d78b2afa

# Files this mission touched (verify the working tree is clean afterwards):
#   src/auth/invite.ts
