#!/usr/bin/env bash
# scripts/lib/patterns.sh — single source of truth for lane path patterns.
# Sourced by lane.sh and savepoint.sh. Extend here, never in the consumers.

# Sensitive-path escalation patterns. A changed file matching any of these
# always escalates to Lane 3 (Full), regardless of file count. Plural forms
# included (payments/, migrations/) and, since v0.6.4, the D3 categories:
# oauth, credential(s), session(s)/, token(s)/, rbac, permission(s), acl(s)/,
# iam/, cert keys (.pem/.key/.p12), migrate/, Dockerfile, docker-compose,
# .github/workflows/, webhooks?/, secret yaml, .tfvars, and .env variants
# (.env.local, .env.production — .env$ alone missed them, D3 follow-up).
# Dir-anchored (not bare): oauth2?/, permissions?/, tokens?/, sessions?/,
# acls?/ — bare forms over-matched docs (oauth-guide.md, permissionless.ts).
# Deliberately NOT matched: package.json (dependency churn is policy-as-code,
# not a sensitive lane trigger), authors/ (contains "auth" but never auth/).
SENSITIVE_PATS="auth/|oauth2?/|payment/|payments/|billing/|crypto/|secrets/|credential|sessions?/|tokens?/|rbac|permissions?/|acls?/|iam/|\.env$|\.env\.|config/.*key|\.p12$|\.key$|\.pem$|migration/|migrations/|migrate/|\.sql$|schema\.|\.prisma$|\.terraform|\.tf$|Dockerfile|docker-compose|\.github/workflows/|webhooks?/|secret/|secrets?\.ya?ml$|\.tfvars$"

# Product surface: paths that count toward file-based lane sizing. Changes
# outside this surface are docs/config/asset and never escalate to full on
# count alone (path-weighted sizing).
PRODUCT_PAT="^content/|^src/|^scripts/|^test/|^hooks/|^\.opencode/|^\.claude/|^evals/"

# Installed-harness rules dirs — what `mugiwara install` writes into a project
# (~50 files across the 9 targets). In a CONSUMER project these are installed
# config, no different from the crew's own .mugiwara/ bookkeeping: the first
# savepoint after an install counted them and sized every fresh mission Lane 3
# before a single line of the user's own work existed. In MUGIWARA'S OWN repo
# the same dirs are the product surface (they are in PRODUCT_PAT), so the
# exclusion is conditional on the repo identity, never unconditional.
# Unanchored on purpose — call sites anchor with ^ (name lists) or a tab
# (numstat rows).
HARNESS_PAT="\.claude/|\.opencode/|\.github/(instructions|agents)/|\.gemini/mugiwara/|\.codex/mugiwara/|\.devin/rules/|\.clinerules/|\.kilo/rules/|\.agents/rules/"

# harness_excluded — true (exit 0) when harness rules dirs must NOT count
# toward mission sizing, i.e. this repo is not mugiwara itself. Identity comes
# from the repo root package.json name ("mugiwara" or "@scope/mugiwara"), the
# same manifest savepoint already trusts for skill_version.
harness_excluded() {
  local root
  root=$(git rev-parse --show-toplevel 2>/dev/null || echo .)
  ! grep -qE '"name"[[:space:]]*:[[:space:]]*"(@[^"/]+/)?mugiwara"' "$root/package.json" 2>/dev/null
}

# drop_harness <anchor> — filter stdin, dropping harness paths in consumer
# repos and passing everything through in mugiwara's own.
drop_harness() {
  if harness_excluded; then grep -vE "$1($HARNESS_PAT)" || true; else cat; fi
}

# --- working-tree-aware change set (F) -------------------------------------
# `git diff BASE..HEAD` alone is blind to uncommitted work, and the old
# `|| git diff --cached` fallback was dead code (|| fires on non-zero exit,
# never on empty output). With auto_commit=off nothing is committed, so lane
# sizing and files_touched read 0 while the tree holds real changes.
# These two helpers are the single source of truth for BOTH lane.sh and
# savepoint.sh so the two can never drift (lane-integrity case 15).

# Path of the crew's bookkeeping dir, relative to the repo root. MUGIWARA_DIR
# may be absolute (the harness passes a full path); git reports repo-relative
# paths, so normalize before comparing.
mugiwara_rel() {
  local d="${MUGIWARA_DIR:-.mugiwara}" root
  case "$d" in
    /*) root=$(git rev-parse --show-toplevel 2>/dev/null || true)
        [ -n "$root" ] && d="${d#"$root"/}"
        # symlinked repo roots (/var vs /private/var on macOS) defeat the
        # prefix strip; fall back to the leaf name, which is what git reports.
        case "$d" in /*) d=$(basename "$d") ;; esac ;;
  esac
  printf '%s' "$d"
}

# changed_files <base-ref> — union of committed (BASE..HEAD), staged, unstaged
# and untracked files. .gitignore'd files are excluded (git status default),
# and so is the crew's own .mugiwara/ bookkeeping: savepoint writes state on
# every wave, and mission state must never size the mission it measures.
changed_files() {
  local base="${1:-}"
  {
    if [ -n "$base" ] && [ "$base" != "unknown" ]; then
      git diff --name-only "$base"..HEAD 2>/dev/null || true
    fi
    # porcelain covers staged + unstaged + untracked in one pass; strip the
    # 2-char status + space, and keep the destination side of a rename.
    git status --porcelain --untracked-files=all 2>/dev/null | sed 's/^...//; s/^.* -> //' || true
  } | grep -v '^[[:space:]]*$' | grep -v "^$(mugiwara_rel)/" | drop_harness '^' | sort -u
}

# changed_loc <base-ref> — echoes "<insertions> <deletions>" over the same
# union. Untracked files count every line as an insertion.
changed_loc() {
  local base="${1:-}" MUGI_REL
  MUGI_REL=$(mugiwara_rel)
  {
    if [ -n "$base" ] && [ "$base" != "unknown" ]; then
      git diff --numstat "$base"..HEAD 2>/dev/null || true
    fi
    git diff --numstat HEAD 2>/dev/null || true
    git ls-files --others --exclude-standard 2>/dev/null | while IFS= read -r f; do
      [ -f "$f" ] || continue
      case "$f" in "$MUGI_REL"/*) continue ;; esac
      printf '%s\t0\t%s\n' "$(wc -l < "$f" 2>/dev/null | tr -d ' ' || echo 0)" "$f"
    done
  } | grep -v "	$MUGI_REL/" | drop_harness '	' | awk '{ if ($1 ~ /^[0-9]+$/) i+=$1; if ($2 ~ /^[0-9]+$/) d+=$2 } END { print (i+0)" "(d+0) }'
}
