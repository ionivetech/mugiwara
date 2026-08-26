# Adoption kit

Make the second mission as easy as the first — on a new repo, a new stack,
or a new teammate.

## Template repository recipe

A mugiwara template repo per stack ships four things:

1. **Preinstalled pack** — `.mugiwara/config` committed with the lane, mode,
   and coverage thresholds the stack's maintainers recommend.
2. **One worked example mission** — an archived `missions/<name>/` with
   `plan.md` + `report.md` in the tree, so newcomers read a real trail before
   running their first mission. The example is small on purpose: one endpoint,
   one test file, one gate run.
3. **Stack-specific policy seed** — a commented-out `mugiwara.policy.yml`
   covering the framework's sensitive paths (auth/, migrations/ for web;
   schema/ + handlers/ for services).
4. **README section** — three commands: install, start a mission, archive it.

Template checklist before publishing:

- [ ] `mugiwara install --yes --target all` completes clean in a fresh clone
- [ ] `bun run gate` (or the stack's equivalent) passes with zero missions
- [ ] The example trail passes `mugiwara clean --dry-run` untouched
- [ ] No real secrets anywhere in the example artifacts

## Worked example standard

An example mission is valid when every artifact in it was produced by an
actual run — never hand-written to look right. A fabricated example teaches
the wrong trail shape; regenerate it whenever the pipeline changes what
closure writes (report sections, provenance.md, rollback.sh).

## Lessons-ledger exchange

`.mugiwara/lessons.md` is append-only and local by default. Opt-in exchange
ships one entry at a time, anonymized:

```json
{
  "lesson": "ORM lazy-loading caused N+1 on the invoice list endpoint",
  "category": "performance",
  "stack_tags": ["prisma", "nextjs"],
  "gate_that_would_have_caught_it": "review:sonar-n-plus-one"
}
```

Rules: no code snippets over 3 lines, no file paths from the source repo, no
names of people or companies. A lesson that cannot be told under those rules
is not shipped. Consumers import into their own ledger with
`mugiwara lessons import <file>` semantics described in
[concepts/lessons](concepts/lessons.md).

## Marketplace listing checklist

- Screenshot of a closed mission report (the trail IS the product)
- One sentence on lanes: process scales with change size
- Supported-harness table copied from docs/reference/harness-matrix.md
- Link to ROADMAP.md — the honest state of what works where
