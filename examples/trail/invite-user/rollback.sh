#!/usr/bin/env bash
# Rollback map for mission "invite-user" — generated at closure.
# Human-executed. Review before running; mugiwara never runs this.
# Branch: feat/invite
# Base:   f90a1f832fdb963ab1c187cbda9e2065de0b6ad6

set -euo pipefail

# Revert newest-first so earlier reverts never conflict with later ones.
git revert --no-edit \
  f1fcc323c428af4b4017e47792279e23486fceb3

# Files this mission touched (verify the working tree is clean afterwards):
#   src/auth/invite.ts
