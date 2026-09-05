# Multi-Actor Workspace

Mugiwara in a team repo — several engineers running missions without collision.
Without a shared identity rule, two engineers resuming the same mission clobber
each other's state; the roster fixes who is who before any work starts.

## State isolation

Identity is **(mission, member)**, never branch — and the member half is never
typed freehand. It comes from the roster: the sub-mission table in `plan.md`
(id, area, assignee), written by Nami at Flow 2 and extended by
`mugiwara join`. Every engineer's work lives in
its own file inside the mission folder, so parallel work never collides:

```
.mugiwara/
├── missions/<mission>/state.json              # solo mission state
├── missions/<mission>/<member>.json           # team member state
├── missions/<mission>/continue.json           # solo resume point (D10)
├── missions/<mission>/continue-<member>.json  # team member resume point
├── missions/<mission>/plan.md                 # shared plan (source of truth)
├── missions/<mission>/flows/                  # flow evidence
├── missions/<mission>/report.md               # closure report
├── lessons.md                                 # shared ledger (append-only)
├── config
└── index.md
```

Branch is an implementation detail, not an identity: a member can hold several
missions on one branch, or two members can share a mission on separate branches.
State and continue follow the person and the plan, not the branch.

## Active-member cache

`.mugiwara/active-member` holds one line: your roster member id for this repo
checkout (e.g. `jane-doe`). `mugiwara continue` writes it after you pick your
row in the roster picker, and `mugiwara join` writes it when you join; the
savepoint then defaults to that member when no explicit member is passed. The
file is gitignored — it identifies the checkout, not the mission — and never
hand-edited: re-run `mugiwara continue` to switch identity, so the cache and
the roster cannot disagree.

## Safe reset

`mugiwara reset` must refuse to wipe another actor's live mission:

```
$ mugiwara reset
✗ Active mission for 'jane-doe'. Use --force to override.
```

`--force` still preserves `.mugiwara/lessons.md` and `config`.

## Shared state

The lessons ledger (`.mugiwara/lessons.md`) stays shared — that is the point of it.
All actors read and write to the same file. Append-only, never overwrite.

## Member namespacing

`mugiwara savepoint` writes per-(mission, member) state (on Claude Code a Stop hook also writes savepoints automatically; the explicit call is the wave-boundary marker). Solo missions (no
member argument) write `state.json`; team missions write `<member>.json`.
The member argument defaults to the `.mugiwara/active-member` cache — pass it
explicitly only to act as someone else:

```bash
mugiwara savepoint dark-mode                        # solo → missions/dark-mode/state.json
mugiwara savepoint payment-gateway john-smith       # team → missions/payment-gateway/john-smith.json
mugiwara savepoint payment-gateway jane-doe         #        missions/payment-gateway/jane-doe.json
```

The resume point follows the same scoping: `missions/<mission>/continue-<member>.json`
(team) or `missions/<mission>/continue.json` (solo), so parallel members never
clobber each other's resume position.

## Resuming your own work

```
/mugiwara continue                 # list every in-flight mission for you
/mugiwara continue <mission>       # solo → resume; team → list members
/mugiwara continue <mission> <member>  # resume exactly that member's work
```

The session-start hook (auto mode) surfaces only the missions owned by your git
actor — never another member's. If you hold several in-flight missions it lists
them and asks, it never guesses.

## Ownership & interface declarations (Phase D)

Each member declares its owned files/interfaces in the shared plan's ownership
map. A member or worker never receives another member's scope — in `auto` mode
this is a hard boundary, never silently crossed (the resumed scope is exactly
the selected `(mission, member)` file).

## Standardized handoff

Handoff between members or sequential sub-missions carries: done-criteria,
branch/base status, dependency status, continuation pointer
(`continue-<member>.json`), and unresolved blocker references. Never a bare
"here's where I left off".

## Base drift & collisions

Base drift, merge, and interface collisions are **routing/escalation events**,
never a silent retry or an automatic cross-scope edit. When main has moved past
the mission base, escalate (rebase check) before continuing; an interface
collision routes to Luffy, never silently overwrites another member's work.
