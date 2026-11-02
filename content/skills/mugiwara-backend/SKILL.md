---
name: mugiwara-backend
description: Use when writing or changing backend or server code: REST API endpoint design, database schema, data integrity, error handling. Matches the repo's own standards before judging it.
gate_artifact: flows/01-execution.md cited doc link — backend evidence with source citation
---

# Backend

## Skip when

- Diff touches no server code: frontend-only, docs-only, or pure tooling/config.
- No APIs, services, data access, or background jobs in the change.

Backend engineer in the repo's own stack. Match the codebase before you judge it.

## Source-backed code (no invented APIs)

Framework code from documentation, not memory. Protocol: `_shared/references/source-grounding.md`. Pin the stack from the dependency file, read the page for that version, cite non-obvious choices. Append a `## backend (<task id>)` section to `flows/01-execution.md` (never overwrite it) with each cited doc link; a change with no citation is unverified. Worked example: `references/source-backed-example.md`.

## Repo standard first

Before writing a line, learn how this repo already does backend: language, layout, error model, logging, config, data access, endpoint patterns, auth middleware. An existing repo convention beats every default in this skill, including the layering and file-size guidance below. Never add a parallel architecture, a second error model, or a second data layer. With no repo standard, pick boring idiomatic defaults and note the choice.

Stack-specific notes (Prisma, Express) are in `references/stacks.md`; use them only when that stack is detected.

## Layering (default when the repo has none)

Layered `controllers → services → repos → domain`, imports inward only; a reverse import is a defect. Keep files small (about 300 lines is a default, not a rule): split at a layer seam, never into a util dump. One responsibility per layer, dependencies injected.

## API design

Follow `mugiwara-contract-first` for contracts, the single error envelope, validation, and versioning. Backend additions:

- Idempotency on mutating operations (retries, payments, callbacks).
- List endpoints: pagination and filtering, never unbounded.
- Status map: 400 malformed, 401/403 authz, 404 missing, 409 conflict, 422 validation, 429 rate-limited, 500 unexpected.

## Data integrity

Raw SQL vs ORM, concurrency, migrations, indexes: `references/database.md`. Multi-row writes run in one transaction. Fix N+1 by eager loading.

## Correctness and performance

- Edge cases: empty input, nulls, timezones, large payloads, duplicates, malformed data.
- No shared mutable state; stable ordering and pagination.
- Cache hot reads with invalidation; stream large payloads, never buffer whole.
- Timeouts and cancellation on downstream calls.
- Measure before optimizing.

## Security (backend layer)

- Authz server-side on every protected path.
- Secrets via env or secret manager, never in code or committed files.
- Validate and sanitize input against injection.
- Rate-limit sensitive endpoints (auth, payment, callbacks).
- No PII in logs; safe file handling (path traversal, size and type limits).
- Dependency audit as part of the change.

## Testability

Contract tests for APIs, unit tests for logic, integration tests for the database, using the repo's existing setup only. Test error paths too.

## Rationalizations

- "The client validates" → validate at the server boundary; the client is untrusted.
- "I'll add authz later" → authz ships with the route.
- "I'm confident about this API" → read the docs for that version and cite them.

## Red flags

- Endpoint without input validation, or authz missing on a protected route.
- Swallowed catch with no log, rethrow, or mapping.
- N+1 in a hot path, or a unique-constraint race surfacing as a bare 500.
- Breaking API change without migration.
- Secret in code or committed files.
- Error path untested.
- A second architecture or error model next to the repo's own.

Any red flag = the backend basics are off. Stop, fix, then continue.
