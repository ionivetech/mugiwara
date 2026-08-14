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
