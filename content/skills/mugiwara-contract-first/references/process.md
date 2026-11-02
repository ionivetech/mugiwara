# Contract-First Process

## 1. Contract first, code second

- Write the shapes before the implementation: request/response types, parameter sets, statuses, events, field meaning.
- Record the contract where callers will see it: schema, spec, or exported type with docs, not just in the implementation.
- Name fields for what they are. `userId` is a contract; `data` is not.
- Encode invariants in the shape: required vs optional, units, precision, nullability, allowed values.

## 2. Error semantics are part of the contract

- Every failure mode the caller must react to is a public member: error kinds, status codes, fields.
- Document what is retryable, what is a caller bug, what is a server failure. Retry-ability is a contract decision, not a runtime guess.
- Stable machine-readable error codes; human messages are display strings and may change.
- One envelope across the whole surface (defined in SKILL.md, "Error envelope").

## 3. Validate at the boundary

- Check untrusted input where it enters: the API layer, the event consumer, the CLI parser, not five layers deep.
- Boundary validation produces contract-shaped errors.
- Authn/authz decide identity and access before any business logic runs.
- Internal callers may pass trusted types; do not re-validate every hop and do not skip the boundary.

## 4. Backward compatibility

- Additive by default: new fields, endpoints, statuses, wider accepted input. Never remove, rename, narrow, or reinterpret inside a version.
- Old callers keep working unchanged within the same version. "We control all callers" is not a compatibility story.
- Deprecate with notice and remove only after every caller has migrated.

## 5. Versioning

**One live version at a time.** Compatibility buys a migration window, not a permanent second contract. Two versions are live only during the overlap window of a breaking release, never three. If the repo already runs several versions, follow the repo and do not add another.

Break a contract only when the cost of carrying a wart outweighs the cost of migrating every caller.

Breaking release checklist:

1. Document the diff: what changed, why, the migration path.
2. Deprecation notices: the old surface warns for at least one release; responses carry `Sunset: <date>`.
3. Overlap window: both versions work for one release cycle, then the old one is removed.
4. Migration guide: "replace X with Y, handle Z".
5. Version bump visible to callers: major version, `/v2` path, or new event namespace. Never silent.

Compatible (no bump): new optional response field, new endpoint or status, wider accepted input, new event type in an existing namespace.
Breaking (bump): renamed or removed field, endpoint, status, or event type; narrower input; changed type, semantics, error format, or error codes.

Prefer extending over breaking even when the extension is ugly; a broken caller costs more.
