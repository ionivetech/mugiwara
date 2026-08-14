#!/usr/bin/env bash
# scripts/lib/patterns.sh — single source of truth for lane path patterns.
# Sourced by lane.sh and savepoint.sh. Extend here, never in the consumers.

# Sensitive-path escalation patterns. A changed file matching any of these
# always escalates to Lane 3 (Full), regardless of file count. Plural forms
# included (payments/, migrations/) — the singular-only list missed them (D3).
# Deliberately NOT matched: package.json (dependency churn is policy-as-code,
# not a sensitive lane trigger), authors/ (contains "auth" but never auth/).
SENSITIVE_PATS="auth/|payment/|payments/|billing/|crypto/|secrets/|\.env$|config/.*key|migration/|migrations/|\.sql$|schema\.|\.prisma$|\.terraform|\.tf$"

# Product surface: paths that count toward file-based lane sizing. Changes
# outside this surface are docs/config/asset and never escalate to full on
# count alone (path-weighted sizing).
PRODUCT_PAT="^content/|^src/|^scripts/|^test/|^hooks/|^\.opencode/|^\.claude/|^evals/"
