# Contract-First Process

## 1. Contract first, code second

- Write the shapes before the implementation: request/response types, parameter sets, statuses, events, field meaning.
- Record the contract where callers will see it: schema, spec, or exported type with docs — not just in the implementation.
- Name fields for what they are, not where they came from. A field called `userId` from `req.user.id` is fine; a field called `data` is not a contract.
- Encode invariants in the shape: required vs optional, units, precision, nullability, allowed values. A contract that says "it's a string, roughly" is no contract.

## 2. Error semantics are part of the contract

- Every failure mode the caller must react to is a public interface member: error kinds, status codes, fields, messages.
- Document error types up front: what is retryable, what is a caller bug, what is a server failure. Retry-ability is a contract decision, not a runtime guess.
- Stable machine-readable error identifiers; human messages are display strings and change freely.
- Consistent envelope across the whole surface. One style, one place to parse it.
- Success and error paths describe the same world: an error's field names mean the same thing as the success's.

## 3. Validate at the boundary

- Untrusted input gets checked where it enters the system: the API layer, the event consumer, the CLI parser — not five layers deep where context is gone.
- Boundary validation produces contract-shaped errors. Deep-stack validation produces surprises.
- The boundary is also the place to name who you are: authn/authz decide identity and access before any business logic runs.
- Internal callers may pass trusted types; the boundary is where untrusted bytes become typed values. Don't re-validate every hop, don't skip the boundary.

## 4. Backward compatibility

- Additive-only by default: new fields, new endpoints, new statuses, wider accepted input. Never remove, never rename, never narrow, never reinterpret.
- Old callers must keep working unchanged, in the same version, forever. "We control all callers" is not a compatibility story.
- One-Version rule: run one live version of a contract at a time. Compatibility buys you a migration window — it does not buy you a second parallel contract to maintain forever.
- Deprecate loudly, remove only after every caller is migrated, and only in a planned breaking release (see below).

## 5. Versioning discipline

- You break a contract when the cost of carrying a wart outweighs the cost of migrating every caller. That is a deliberate act, not a habit.
- Break in a version bump that callers can see: major version, `v2` path, new event namespace. Never a silent break inside the same version.
- A breaking release ships the migration: documented diff, migration guide, deprecation notices, overlap window where both work.
- Prefer extending over breaking even when the extension is ugly. Ugliness is a tax you can pay later; a broken caller is a pager you cannot ignore.
