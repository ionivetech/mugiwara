# Severity Rubric

The one severity scale for review findings: blocker, major, minor. Every finding gets a level backed by these criteria.

| Severity | Definition | Examples | Action |
|----------|-----------|----------|--------|
| **blocker** | public-break with no migration path, wrong behavior shipped, security hole | renamed public API with callers unfixed, authz bypass, data loss | Fix before merge |
| **major** | internal-break with callers unfixed, missed contract, behavior change outside declared scope | changed function signature, missing error handling, N+1 in hot path | Fix this mission |
| **minor** | polish, style drift, batched items | inconsistent naming, missing edge-case test, duplicated 3-line helper | May batch for a later pass |

## Security findings

`mugiwara-security` rates by exploitability and impact as Critical, High, Medium, Low. In `review.md` and the fix list they map onto the scale above:

| Security severity | Review severity |
|---|---|
| Critical | blocker |
| High | blocker |
| Medium | major |
| Low | minor |

Security findings are never "minor by default": each one goes through the security matrix first.
