# Database — raw SQL and ORM

Applies whenever the diff touches a query, migration, model, or repository.
The repo's existing data layer wins: if it uses an ORM, write ORM; if it uses
raw SQL with a thin helper, write that. Never introduce a second data layer.

## Choosing per change

| Situation | Reach for |
|-----------|-----------|
| CRUD against one or two tables, relations mapped | the repo's ORM |
| Reporting/aggregation, bulk update, window functions | raw SQL (parameterized) through the repo's query helper |
| Hot path measured slow under the ORM | raw SQL for that query only — note why inline |
| Schema change | a migration file, never ad-hoc DDL |

## Non-negotiables (either style)

- **Parameterized queries only.** String-concatenated SQL is a blocker-level
  security finding. ORM query builders parameterize by default — do not
  defeat them with `raw()` string interpolation of user input.
- **Constraints live in the schema**: unique, not-null, FK, check. App-level
  validation is UX; the database is the guarantee.
- **Transactions around every multi-row write.** Partial writes are data
  loss. One request = one transaction boundary, not several.
- **Migrations are forward-only files** with a documented rollback statement.
  No editing an applied migration; add a new one.

## Concurrency

- Know the isolation level you run at (read committed is typical). Do not
  reach for serializable to paper over a logic race.
- Lost-update protection: optimistic locking (version column) unless the row
  is a single-writer counter.
- Deadlocks: consistent lock ordering across the codebase; keep transactions
  short — no network calls inside one.

## ORM pitfalls

- **N+1 from lazy loading**: a loop touching `order.customer.name` issues one
  query per iteration. Eager-load (`include`/`joinedload`/`select_related`)
  what the loop renders.
- **Implicit transactions**: some ORMs wrap each save in its own commit — a
  "transaction" spread across three saves was never atomic.
- **Mass assignment**: bind request bodies through explicit field allowlists,
  not `Model(**payload)`.
- **Silent full-table scans**: check the generated SQL for anything the ORM
  could not translate (client-side filtering after fetch).

## Raw-SQL pitfalls

- Unparameterized interpolation (see above) and dynamic ORDER BY/LIMIT built
  from user input — whitelist column names instead.
- Missing LIMIT on list queries; pagination is not optional.
- Long-running transactions holding locks while the app does other work.

## Indexes

Index the columns every hot WHERE/JOIN/ORDER BY actually uses — verify with
EXPLAIN on the real query shape, not by intuition. A new query pattern on a
large table without a matching index is a performance finding, same severity
as an N+1.
