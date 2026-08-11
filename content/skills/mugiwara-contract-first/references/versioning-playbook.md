# Versioning Playbook

Contract versioning discipline for API and interface changes.

## One-Version Rule

Run one live version of a contract at a time. Compatibility buys a migration window — it does not buy a second parallel contract to maintain forever.

## When to break

Break a contract only when the cost of carrying a wart outweighs the cost of migrating every caller. Deliberate act, not a habit.

## Breaking release checklist

1. **Document the diff.** What changed, why, and the migration path.
2. **Deprecation notices.** Old surface warns callers for ≥1 release before removal.
3. **Overlap window.** Both versions work side by side for one release cycle.
4. **Migration guide.** Step-by-step for callers: "replace X with Y, handle Z".
5. **Version bump.** Major version, `v2` path, or new event namespace. Never silent.

## Compatible changes (safe, no bump needed)

- New optional field in response
- New endpoint, new status code
- Wider accepted input (relaxed validation)
- New event type in existing namespace

## Breaking changes (requires version bump)

- Renamed/removed field, endpoint, or status code
- Narrowed accepted input (stricter validation)
- Changed field type or semantics
- Changed error format or error codes
- Removed event type

Prefer extending over breaking even when ugly. Ugliness is a tax you pay later; a broken caller is a pager you cannot ignore.
