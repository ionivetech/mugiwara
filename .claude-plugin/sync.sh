#!/usr/bin/env sh
# Regenerate the plugin copies at repo root from the single source of truth in content/.
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cp -R "$ROOT/content/agents/." "$ROOT/agents/"
cp -R "$ROOT/content/skills/." "$ROOT/skills/"
echo "Plugin agents/skills synced from content/."
