#!/usr/bin/env bash
set -euo pipefail

PKG="@ionivetech/mugiwara"

if ! command -v node >/dev/null 2>&1; then
  echo "mugiwara requires Node.js >= 20.11. Install it first: https://nodejs.org" >&2
  exit 1
fi

# floor must match package.json "engines.node" exactly, and install.ps1
if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>20||(a===20&&b>=11)?0:1)'; then
  echo "mugiwara requires Node.js >= 20.11 (found $(node --version))." >&2
  exit 1
fi

exec npx -y "${PKG}@latest" "$@"
