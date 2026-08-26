#!/usr/bin/env bash
# Rollback map for mission "invite-user" — generated at closure.
# Human-executed. Review before running; mugiwara never runs this.
# Branch: feat/invite
# Base:   8f7d60d9234794cf04d28fda3842d71a7f8ced0b

set -euo pipefail

# Revert newest-first so earlier reverts never conflict with later ones.
git revert --no-edit \
  0b237ce8bd42a930af4142e3a065d40919ebd028

# Files this mission touched (verify the working tree is clean afterwards):
#   src/auth/invite.ts
