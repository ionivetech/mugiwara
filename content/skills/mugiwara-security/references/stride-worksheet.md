# STRIDE Worksheet

Map every application surface to STRIDE before running security checks.

## Surface inventory

List every surface where data, requests, or state cross trust levels:

- HTTP endpoints (REST, GraphQL, gRPC)
- CLI arguments and environment variables
- File uploads, database reads/writes
- External API calls, webhooks
- Rendered output (HTML, JSON, logs)
- Config files, secret stores

## STRIDE per surface

| STRIDE | Ask of each surface |
|--------|---------------------|
| Spoofing | Can an identity be forged or impersonated? |
| Tampering | Can data in transit or at rest be altered undetected? |
| Repudiation | Can an action occur without a traceable actor? |
| Info disclosure | Can data leak to an unintended party? |
| DoS | Can the surface be exhausted or taken down? |
| Elevation | Can a caller gain privileges beyond their grant? |

## Example

| Surface | S | T | R | I | D | E | Notes |
|---------|---|---|---|---|---|---|-------|
| POST /api/invite | ✅ | ✅ | — | ⚠️ | — | ✅ | Email exposed in error response |
| GET /api/users/:id | ✅ | — | — | ⚠️ | — | ✅ | IDOR: no ownership check |
| config upload | — | ✅ | — | — | — | — | YAML parsing, no schema validation |

✅ = threat present, ⚠️ = partial mitigation, — = not applicable

A surface with no STRIDE row is a modeling gap, not a safe surface.
