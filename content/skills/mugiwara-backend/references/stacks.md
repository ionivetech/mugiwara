# Stack-specific notes (apply only if the repo uses it)

These are examples for two common stacks. Use a section only when the dependency file shows that stack, and check the docs for the installed version first (`_shared/references/source-grounding.md`). Version numbers below are unverified against your repo.

## Prisma (ORM)

- Multi-row writes go in one interactive transaction (`prisma.$transaction(async (tx) => { ... })`); a throw rolls everything back. Set explicit transaction timeouts rather than relying on defaults.
- One `PrismaClient` per process. In hot-reload dev, cache it on `globalThis`; a client per request leaks connections.
- Avoid N+1: load relations with `include` or `select` in one query, never loop-query a relation.
- Index columns used by hot WHERE, JOIN, and ORDER BY clauses (`@@index([field])`); confirm with EXPLAIN.
- A concurrent write on a unique column throws error code P2002 (`PrismaClientKnownRequestError`). Catch it, then retry or map to 409; a bare 500 hides the race.

Docs: https://www.prisma.io/docs/orm/prisma-client/queries/transactions, https://www.prisma.io/docs/orm/reference/prisma-client-reference

## Express (HTTP)

- Do not render errors in the route. Call `next(err)` and let one central error middleware respond.
- The error middleware takes exactly four arguments `(err, req, res, next)` and is registered after all routes. It returns the repo's one error envelope (see `mugiwara-contract-first`, "Error envelope").
- Log each error with context (path, method, stack, trace id when tracing exists).
- Never leak stack traces or internals to clients.

Docs: https://expressjs.com/en/guide/error-handling.html
