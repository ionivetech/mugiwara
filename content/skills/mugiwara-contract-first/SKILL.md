---
name: mugiwara-contract-first
description: Use for API, interface, or contract design — contract-first, error semantics, boundary validation, backward compatibility, versioning discipline.
gate_artifact: flows/01-execution.md contract evidence — OpenAPI shape + error envelope written before implementation
---

# API and Interface Design

## Skip when

- No public/exported surface changes: no new endpoint, function, type, config key, or contract.
- Internal-only implementation with private symbols that no other module imports.

Design the contract before the code. The interface is the promise; the implementation is just how it keeps it.

## When to use

- New endpoint, public function, exported type, or library surface.
- New inter-service boundary: queues, events, RPC, SDKs, CLI.
- Reviewing a diff that changes a contract: renamed field, new status, changed error, loosened validation.
- Any change a caller outside the current code would observe.

Not for: pure internals no one else touches — those still get reviewed by the other skills, just not on contract terms.

Framework APIs from docs, not memory: `_shared/references/source-grounding.md`.

## OpenAPI shape first

Write the OpenAPI 3.0 document before any implementation line. The spec is the
contract; the code must match it, never the reverse. The document covers: every
path, request/response schema, every status code, and the error envelope. No
endpoint merges without an OpenAPI entry.

## Boundary validation with Zod

- Parse untrusted input at the trust boundary with `.safeParse()`, never `.parse()` — returns a discriminated union, no throw. https://github.com/colinhacks/zod/blob/main/README.md
- Read failures from `result.error.issues` — per-field `code`, `expected`, `received`, `path`, `message`. https://github.com/colinhacks/zod/blob/main/packages/docs-v3/home.md
- Map failures to the envelope with `.flatten()` → `{ formErrors, fieldErrors }` keyed by field. https://github.com/colinhacks/zod/blob/main/packages/docs-v3/ERROR_HANDLING.md
- Cross-field rules go in `.refine()` with a dynamic message from the failing input. https://github.com/colinhacks/zod/blob/main/packages/docs/content/api.mdx
- Schemas are `z.object({...})` at the boundary; types derive via `z.infer`, so schema and type cannot drift.

## Error envelope

Every failure returns exactly `{ code, message, details }`:

- `code` — stable machine-readable string (`validation_error`, `not_found`,
  `rate_limited`). Never change a code once shipped.
- `message` — human-readable sentence.
- `details` — Zod `.flatten()` fieldErrors for validation failures; empty for
  single-cause errors.

The envelope is declared in the OpenAPI document's error schema, so clients
can validate errors with the same contract as success.

## Versioning

New breaking change → new URL prefix (`/v2`), old prefix (`/v1`) stays live.
Max **2 live versions**; never a third. Every response on the deprecated
version carries `Sunset: <RFC-7231 date>`. When the date passes, remove the
old version. Additive changes (new field, new status) never require a bump.
The OpenAPI document describes both live versions and marks the sunset one.

## Process

Full 5-step protocol: `references/process.md` — contract first, error
semantics, boundary validation, backward compatibility, versioning discipline.
27 lines; every step required.

Versioning + deprecation moves: `references/versioning-playbook.md`.

## Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll define the contract while I implement" | The implementation invents the contract and hides the decisions. Define it, then build to it. |
| "Callers can read the code" | Code is not a contract. Wrong, undocumented, and versioned poorly. |
| "Errors are just status codes" | Codes without stable machine-readable error types and retry semantics are not a contract — they are a guessing game. |
| "No one else uses this" | Today. Public surfaces grow callers you cannot see. |
| "Additive changes only, forever" | Compatibility is the default, not the permanent answer. Versioning is how you eventually move forward. |
| "Validation at the call site is fine" | Validation belongs at the trust boundary, where shape errors are handled once and consistently. |
| "We own all the callers" | You own them today. The one you forgot is the one that breaks in production. |

## Red flags

- Contract written after the implementation, or not written at all.
- Error kinds or statuses undocumented, inconsistent envelope.
- Retry-ability decided per-call-site instead of declared by the contract.
- Input accepted and validated deep in the stack, nowhere at the boundary.
- Renamed/removed/narrowed field or status with no version bump.
- Two versions of a contract maintained side by side with no migration plan.
- Boundary that trusts an upstream service or client without validation.

Any red flag = the interface is drifting. Stop, write the contract down, then continue.

## Verification

- Contract is written and agreed before code review: shapes, statuses, error types, retry semantics.
- Every public change is additive, or carries a version bump plus migration plan.
- Untrusted input validated at the boundary; boundary errors match the documented envelope.
- One live version; the deprecation plan names the removal release and its migration.
- A contract test asserts the documented shape and errors — the contract stays true because something checks it.

## Gate artifact

Write `flows/01-execution.md` with the evidence: OpenAPI doc path, the
`{code,message,details}` envelope declaration, Zod schema list, and live
versions with their `Sunset` dates. No gate_artifact entry, no merge.
