#!/usr/bin/env bash
set -euo pipefail

PKG="@ionivetech/mugiwara"

if ! command -v node >/dev/null 2>&1; then
  echo "mugiwara requires Node.js >= 20. Install it first: https://nodejs.org" >&2
  exit 1
fi

MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$MAJOR" -lt 20 ]; then
  echo "mugiwara requires Node.js >= 20 (found $(node --version))." >&2
  exit 1
fi

exec npx -y "${PKG}@latest" "$@"
