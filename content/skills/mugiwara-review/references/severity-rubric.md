# Severity Rubric

For review findings. Every finding gets a severity backed by criteria.

| Severity | Definition | Examples | Action |
|----------|-----------|----------|--------|
| **blocker** | public-break with no migration path, wrong behavior shipped, security hole | renamed public API with callers unfixed, authz bypass, data loss | Fix before merge |
| **major** | internal-break with callers unfixed, missed contract, behavior change outside declared scope | changed function signature, missing error handling, N+1 in hot path | Fix this mission |
| **minor** | polish, style drift, batched items | inconsistent naming, missing test for edge case, duplicated 3-line helper | May batch with Brook |

## CVSS-style for security

| Severity | Exploitability × Impact |
|----------|------------------------|
| Critical | Reachable + tooling exists + pre-auth → data loss/auth bypass/RCE |
| High | Reachable + limited tooling → PII leak, privilege escalation |
| Medium | Requires auth/conditions → partial exposure |
| Low | Defense-in-depth gaps, no known exploit path |

Security findings are never "minor by default." Every finding gets the matrix.
