---
name: mugiwara-contract-first
description: Use for API, interface, or contract design — contract-first, error semantics, boundary validation, backward compatibility, versioning discipline.
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

## Process

Full 5-step protocol: `references/process.md` — contract first, error semantics, boundary validation, backward compatibility, versioning discipline. 27 lines; every step required.

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
