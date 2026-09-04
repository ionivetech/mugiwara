# Sub-missions (team only) — full reference

When Flow 0 recorded a roster, turn the area table into a sub-mission table
before writing task detail. Use the **exact names from the Flow 0 roster** —
they are the member ids the crew will use for state files.

| ID | Name | Assignee | Branch | Status | Depends On | Touched Files |
|----|------|----------|--------|--------|-----------|---------------|
| S1 | api checkout | jane-doe | feat/checkout-api | [ ] | - | src/api/checkout.ts |
| S2 | web ui | john-smith | feat/checkout-web | [ ] | S1 | src/web/checkout.tsx |
| S3 | shared types | eleanor-vance | feat/checkout-types | [ ] | - | src/shared/types.ts |

Rules:

- **One area row maps to exactly one sub-mission.** If an area needs two
  people, split the area first.
- **`Touched Files` comes from the area map**, not from guessing. If you cannot
  name the files an area covers, the area is not defined well enough to assign.
- **Every sub-mission must end mergeable on its own.**
- **`Depends On` is a real dependency edge from the plan**, not an ordering
  preference.
- **Assignee spelling is binding.** It becomes `<member>.json`. Write it once,
  lowercase, no spaces, and keep that spelling in every row.

Then run this **before** asking for the GO:

    mugiwara initiative conflict-check .mugiwara/missions/<mission>/plan.md

A file appearing in two sub-missions is a planning defect, not a merge problem.
Fix it by moving the file into one owner's area or by adding a dependency edge.
Never hand the plan over with a known conflict.

Solo missions skip this section entirely.
