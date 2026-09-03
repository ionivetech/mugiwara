# Sub-missions (team only) — full reference

When Flow 0 recorded `team_members > 1`, extend the area table into a sub-mission table before writing task detail:

| ID | Name | Assignee | Branch | Status | Depends On | Touched Files |
|----|------|----------|--------|--------|-----------|---------------|
| S1 | cart api | farid | feat/cart | [ ] | - | src/cart.ts, src/api/shared.ts |
| S2 | payment ui | rina | feat/pay | [ ] | - | src/pay.tsx |

Rules: every area row maps to exactly one sub-mission; every sub-mission ends mergeable on its own; `Depends On` is the plan's dependency edge, not a guess.

Then run `mugiwara initiative conflict-check <plan>` **before the GO**. A file touched by two sub-missions is a planning defect, not a merge problem — resolve it by moving the file into one owner's scope or by adding a dependency edge.

Solo missions skip this section entirely.
