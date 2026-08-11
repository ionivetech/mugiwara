---
name: mugiwara-sunset
description: Use when removing, deleting, deprecating old code, legacy APIs, v1 endpoints — keep-or-retire gate, safe DB migrations, phased cutovers. Every removal needs a plan.
---

# Deprecation & Migration (Brook)

## Skip when

- No code, API, or feature is being retired or replaced.
- Purely additive change — nothing removed, no migration path needed.

Keeping old code alive is a tax, not a virtue: it keeps costing tests, patches, security reviews, and the attention of everyone who walks past it. Retirement is a craft — the removal itself must be as disciplined as the build.

## Sunset or keep

Run this gate before touching anything:

1. What still depends on it, and how much? Count consumers; the count sets the migration size.
2. Is there a replacement that already works in production? If not, build that first — nobody gets stranded with nothing to move to.
3. What does one more year of upkeep cost? Add up security debt, fixing time, and the complexity tax.
4. What does the move cost? Compare against the upkeep number over two to three years.

Only when the replacement exists AND the math favors removal do you proceed. Otherwise keep it, with an owner.

## Two removal styles

| Style | Pick when | Minimum promise |
|-------|-----------|-----------------|
| Soft | system stable, nobody forced | tell users + document the way across |
| Hard | security hole, blocks the roadmap, upkeep unbearable | deadline + working migration tooling + docs |

Soft is the default. Hard is earned — a hard sunset without tooling is just breaking people. If you built the thing being retired, you do the moving for its users; shipping a drop-in compatible update instead is equally acceptable.

## The removal sequence

1. **Ship the replacement** and let it earn trust in production.
2. **Publish the plan**: what retires, what replaces it, when, why, and a literal step-by-step for switching.
3. **Move users one at a time**, never all at once. Each one: find its touchpoints, switch them, run the same checks, delete the old references, prove nothing regressed.
4. **Cut only after silence**: verify with metrics, logs, or dependency scan that nothing touches it anymore, then delete code, tests, docs, and notices together.

## Cutover playbooks

- **Side-by-side.** Run old and new concurrently; shift traffic in stages (a sliver, a quarter, half, all) and delete the old only when it idles at zero. Best for anything you can route.
- **Wrapper.** Keep the old front door, point it at the new engine. Callers never notice; you migrate them whenever you want.
- **Switch per caller.** Flip consumers individually behind a toggle, so a bad batch rolls back without affecting the rest.

## Database changes are the dangerous kind

Schema edits can't be undone with a git revert — old and new code run side by side during rollout, so a column that disappears mid-deploy breaks whichever half still references it. Never edit a column in place.

The safe shape is widen-then-narrow, in separate deploys:

1. **Add** the new column, nullable, alongside the old one. Ship. Nothing reads it yet, nothing breaks.
2. **Double-write**: every insert and update populates both columns. Ship.
3. **Backfill** the history in modest chunks so no table locks for the duration.
4. **Repoint reads** at the new column while still writing both. Ship, let it bake.
5. **Slim down**: stop writing the old one, and only in a later, standalone deploy, drop it.

Rules that keep this honest:

- Additive steps are safe anywhere. Deletes and renames ride alone, after nothing references the old shape.
- A migration that can't be reversed is a deploy you can't pull back — write and run the rollback first.
- Backfills and index builds run in the background, throttled, off the request path.
- Any risky cutover goes behind a toggle so it can be flipped back.

## Orphaned code

The worst kind of code: still used, but nobody owns it — no commits in six months, failing tests left to rot, vulnerable dependencies nobody patches, docs pointing at ghosts. It gets a verdict, not neglect: either someone takes it over and it lives on, or it gets the full sunset treatment. Indifference is the only unacceptable option.

## Red flags

- Retiring something before a working replacement exists.
- Announcing a hard sunset with no migration tooling.
- Soft sunsets that never progress for years.
- Building new features onto a system you've decided to retire.
- Deleting before verifying zero remaining users.
- A schema change and its dependent code shipped together.
- Editing or dropping a column in place instead of widen-then-narrow.
- A migration merged without a tested rollback, or a backfill that locks the table.

Any of these: stop, close the gap, or escalate with the plan attached.
