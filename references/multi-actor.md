# Multi-Actor Workspace

Mugiwara in a team repo — several engineers running missions without collision.

## State isolation

Identity is **(mission, member)**, never branch. Every engineer's work lives in
its own file inside the mission folder, so parallel work never collides:

```
.mugiwara/
├── state/<mission>/state.json        # solo mission state
├── state/<mission>/<member>.json     # team member state
├── continue/<mission>/state.json     # solo resume point (D10)
├── continue/<mission>/<member>.json  # team member resume point
├── plans/<mission>.md                # shared plan (source of truth)
├── reports/YYYY-MM-DD-<mission>.md
├── results/<mission>-*.md
```

Branch is an implementation detail, not an identity: a member can hold several
missions on one branch, or two members can share a mission on separate branches.
State and continue follow the person and the plan, not the branch.

## Safe reset

`mugiwara reset` must refuse to wipe another actor's live mission:

```
$ mugiwara reset
✗ Active mission for 'john'. Use --force to override.
```

`--force` still preserves `logs/lessons.md` and `config`.

## Shared state

The lessons ledger (`logs/lessons.md`) stays shared — that is the point of it.
All actors read and write to the same file. Append-only, never overwrite.

## Member namespacing

`mugiwara savepoint` writes per-(mission, member) state (on Claude Code a Stop hook also writes savepoints automatically; the explicit call is the wave-boundary marker). Solo missions (no
member argument) write `state.json`; team missions write `<member>.json`:

```bash
mugiwara savepoint dark-mode                 # solo → state/dark-mode/state.json
mugiwara savepoint payment-gateway john    # team → state/payment-gateway/john.json
mugiwara savepoint payment-gateway patty     #        state/payment-gateway/patty.json
```

The resume point follows the same scoping: `continue/<mission>/<member>.json`
(team) or `continue/<mission>/state.json` (solo), so parallel members never
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
