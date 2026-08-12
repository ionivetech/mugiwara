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

### 1. Contract first, code second

- Write the shapes before the implementation: request/response types, parameter sets, statuses, events, field meaning.
- Record the contract where callers will see it: schema, spec, or exported type with docs — not just in the implementation.
- Name fields for what they are, not where they came from. A field called `userId` from `req.user.id` is fine; a field called `data` is not a contract.
- Encode invariants in the shape: required vs optional, units, precision, nullability, allowed values. A contract that says "it's a string, roughly" is no contract.

### 2. Error semantics are part of the contract

- Every failure mode the caller must react to is a public interface member: error kinds, status codes, fields, messages.
- Document error types up front: what is retryable, what is a caller bug, what is a server failure. Retry-ability is a contract decision, not a runtime guess.
- Stable machine-readable error identifiers; human messages are display strings and change freely.
- Consistent envelope across the whole surface. One style, one place to parse it.
- Success and error paths describe the same world: an error's field names mean the same thing as the success's.

### 3. Validate at the boundary

- Untrusted input gets checked where it enters the system: the API layer, the event consumer, the CLI parser — not five layers deep where context is gone.
- Boundary validation produces contract-shaped errors. Deep-stack validation produces surprises.
- The boundary is also the place to name who you are: authn/authz decide identity and access before any business logic runs.
- Internal callers may pass trusted types; the boundary is where untrusted bytes become typed values. Don't re-validate every hop, don't skip the boundary.

### 4. Backward compatibility

- Additive-only by default: new fields, new endpoints, new statuses, wider accepted input. Never remove, never rename, never narrow, never reinterpret.
- Old callers must keep working unchanged, in the same version, forever. "We control all callers" is not a compatibility story.
- One-Version rule: run one live version of a contract at a time. Compatibility buys you a migration window — it does not buy you a second parallel contract to maintain forever.
- Deprecate loudly, remove only after every caller is migrated, and only in a planned breaking release (see below).

### 5. Versioning discipline

- You break a contract when the cost of carrying a wart outweighs the cost of migrating every caller. That is a deliberate act, not a habit.
- Break in a version bump that callers can see: major version, `v2` path, new event namespace. Never a silent break inside the same version.
- A breaking release ships the migration: documented diff, migration guide, deprecation notices, overlap window where both work.
- Prefer extending over breaking even when the extension is ugly. Ugliness is a tax you can pay later; a broken caller is a pager you cannot ignore.

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
