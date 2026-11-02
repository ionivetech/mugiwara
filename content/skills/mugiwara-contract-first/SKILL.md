---
name: mugiwara-contract-first
description: Use when designing or changing an API, interface, or contract: error semantics, boundary validation, backward compatibility, versioning.
gate_artifact: flows/01-execution.md contract evidence — OpenAPI shape + error envelope written before implementation
---

# API and Interface Design

## Skip when

- No public or exported surface changes: no new endpoint, function, type, config key, or contract.
- Internal-only implementation with private symbols that no other module imports.

Design the contract before the code. The interface is the promise; the implementation is how it keeps it.

## When to use

- New endpoint, public function, exported type, or library surface.
- New inter-service boundary: queues, events, RPC, SDKs, CLI.
- Reviewing a diff that changes a contract: renamed field, new status, changed error, loosened validation.
- Any change a caller outside the current code would observe.

Framework APIs from docs, not memory: `_shared/references/source-grounding.md`.

## Contract shape first

Write the contract document (OpenAPI for HTTP) before any implementation line. The spec is the contract; the code matches it, never the reverse. It covers every path, request and response schema, every status code, and the error envelope. No endpoint merges without an entry.

## Boundary validation

Parse untrusted input at the trust boundary and return typed errors; derive types from the schema so schema and type cannot drift. Use the repo's existing validation library (for example Zod in TS, pydantic in Python). With Zod: `.safeParse()` rather than `.parse()`, and map `.flatten()` field errors into the envelope.

## Error envelope

This is the one error envelope for the whole repo. Backend and every other skill link here instead of defining their own contract. Every failure returns exactly `{ code, message, details }`:

- `code`: stable machine-readable string (`validation_error`, `not_found`, `rate_limited`). Never change a code once shipped.
- `message`: human-readable sentence.
- `details`: per-field errors for validation failures; empty for single-cause errors.

If the repo already has an error envelope, keep it and document it. Declare the envelope in the contract's error schema so clients validate errors the same way as success.

## Versioning

One live version at a time. A breaking change gets a new version (for example `/v2`) with an overlap window: the old version stays live only until its `Sunset: <RFC-7231 date>` passes, then it is removed. Never a third live version. Additive changes (new field, new status) need no bump. If the repo already runs several versions, follow the repo. Full process and checklist: `references/process.md`.

## Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll define the contract while I implement" | The implementation invents the contract and hides the decisions. Define it, then build to it. |
| "Callers can read the code" | Code is not a contract. It is undocumented and unversioned. |
| "We own all the callers" | You own them today. The one you forgot breaks in production. |

## Red flags

- Contract written after the implementation, or not at all.
- Error kinds or statuses undocumented, or an inconsistent envelope.
- Retry-ability decided per call site instead of declared by the contract.
- Input validated deep in the stack, nowhere at the boundary.
- Renamed, removed, or narrowed field or status with no version bump.
- Two live versions with no sunset date or migration plan.
- A boundary that trusts an upstream service or client without validation.

Any red flag = the interface is drifting. Stop, write the contract down, then continue.

## Verification

- Contract written and agreed before code review: shapes, statuses, error types, retry semantics.
- Every public change is additive, or carries a version bump plus migration plan.
- Untrusted input validated at the boundary; boundary errors match the documented envelope.
- One live version (two only during an overlap window); the deprecation plan names the removal release.
- A contract test asserts the documented shape and errors.

## Gate artifact

Append a `## contract-first (<task id>)` section to `flows/01-execution.md` (never overwrite it): contract document path, the `{code,message,details}` envelope declaration, the validation schema list, and live versions with their `Sunset` dates. No gate artifact, no merge.
