#!/usr/bin/env sh
# content/ is the single source of truth. Root agents/ and skills/ are
# symlinks to it so the Claude Code marketplace plugin (which reads from the
# plugin root) and the npm package consumers see the same files.
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

for pair in "agents:content/agents" "skills:content/skills"; do
  link="${pair%%:*}"
  target="${pair#*:}"
  if [ -L "$ROOT/$link" ]; then
    echo "ok $link -> $target"
  else
    rm -rf "$ROOT/$link"
    ln -s "$target" "$ROOT/$link"
    echo "linked $link -> $target"
  fi
done
