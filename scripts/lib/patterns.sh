#!/usr/bin/env bash
# scripts/lib/patterns.sh — single source of truth for lane path patterns.
# Sourced by lane.sh and savepoint.sh. Extend here, never in the consumers.

# Sensitive-path escalation patterns. A changed file matching any of these
# always escalates to Lane 3 (Full), regardless of file count. Plural forms
# included (payments/, migrations/) and, since v0.6.4, the D3 categories:
# oauth, credential(s), session/, token/, rbac, permission(s), acl/, iam/,
# cert keys (.pem/.key/.p12), migrate/, Dockerfile, docker-compose,
# .github/workflows/, webhooks?/.
# Deliberately NOT matched: package.json (dependency churn is policy-as-code,
# not a sensitive lane trigger), authors/ (contains "auth" but never auth/).
# Bare words (oauth/credential/rbac/permission) are policy: files touching
# those domains are sensitive even when the directory name varies.
SENSITIVE_PATS="auth/|oauth|payment/|payments/|billing/|crypto/|secrets/|credential|session/|token/|rbac|permission|acl/|iam/|\.env$|config/.*key|\.pem$|\.key$|\.p12$|migration/|migrations/|migrate/|\.sql$|schema\.|\.prisma$|\.terraform|\.tf$|Dockerfile|docker-compose|\.github/workflows/|webhooks?/"

# Product surface: paths that count toward file-based lane sizing. Changes
# outside this surface are docs/config/asset and never escalate to full on
# count alone (path-weighted sizing).
PRODUCT_PAT="^content/|^src/|^scripts/|^test/|^hooks/|^\.opencode/|^\.claude/|^evals/"
