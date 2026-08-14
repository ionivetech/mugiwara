# Team Collaboration

Mugiwara turns a shared repo into a safe multi-actor workspace. Identity is
**(mission, member)** — never branch — so parallel work never collides and one
engineer can hold several missions at once.

## Why (mission, member), not branch

| Scenario | Branch-scoped fails | (mission, member) works |
|----------|---------------------|-------------------------|
| 1 member, 2+ missions, switching | resume depends on the branch you're on | `continue <mission> <member>` picks exactly |
| 2 members, 1 mission (team split) | two snapshots of the same unit | each member has their own file in the mission folder |
| New member joins mid-mission | fresh branch has no state | `continue <mission>` lists members, they pick their row |
| Member juggling branches | resume follows git, not the person | state follows the person + plan |

Branch is an implementation detail, not an identity.

## Workspace layout

```
.mugiwara/
├── state/<mission>/state.json        # solo computed state
├── state/<mission>/<member>.json     # team member computed state
├── continue/<mission>/state.json     # solo resume point (machine-written)
├── continue/<mission>/<member>.json  # team member resume point
├── plans/<mission>.md                # ONE shared plan (source of truth)
├── reports/YYYY-MM-DD-<mission>.md   # aggregate mission report
├── results/<mission>/*               # wave evidence (committed)
└── logs/lessons.md                   # shared lessons ledger (append-only)
```

`state/` and `continue/` are gitignored (recomputed each wave). `plans/`,
`results/`, `reports/`, `logs/lessons.md` are committed — the audit trail
survives the merge.

## Commands

| Command | Behavior |
|---------|----------|
| `/mugiwara continue` | **List** every in-flight mission for your git actor. Never auto-starts. |
| `/mugiwara continue <mission>` | Solo plan → resume `continue/<mission>/state.json`. Team plan → **list members** and stop (member required). |
| `/mugiwara continue <mission> <member>` | Resume exactly that member's work. |
| `bun run scripts/initiative.ts status <plan>` | Dashboard: assignee, branch, status per sub-mission. |
| `bun run scripts/initiative.ts conflict-check <plan>` | Shared touched-files across in-progress sub-missions. |
| `bun run scripts/initiative.ts set-status <plan> --id <id> --status <x>` | Update a sub-mission's status in the plan. |

## Auto mode

`auto` runs every wave autonomously to closure — lane rise, sensitive-path
touches, and heal cycles do **not** downgrade the mode. Only a genuine blocker
or the heal halt pauses.

**Auto applies per member, not per mission.** In a team plan, auto covers only
the member's own scope. If Patty runs in auto and resumes her sub-mission with
`/mugiwara continue payment-gateway-v2 patty`, the crew runs her sub-mission
autonomously to ship — triage, plan, execute, quality, gates, review, heal,
closure — but it never touches John's or Austin's sub-missions. Their work is
not auto-run, not re-planned, not committed by her session. Auto scope = your
member file's work, nothing else.

At session start the `session-start` hook scans `continue/<mission>/*.json`
for your git actor:

- **exactly one** in-flight mission → a resume instruction is injected into
  the session (load `mugiwara-resume`, continue from the exact point)
- **several** → lists them and asks you to pick via `/mugiwara continue`
- **other actors'** missions → never surfaced to you

Resume is explicit, never guessed: a single in-flight mission gets a
continue-the-work instruction; multiple missions always stop and ask. The
model never picks which member or mission to resume on its own.

**Nami's Solo-or-team question in auto:** Nami still asks "Solo or team?" —
the default in auto is solo unless the user explicitly names a team. When a
team is named, member names are required (never invented).

## Worked example — Payment Gateway v2

Three engineers (John, Patty, Austin) build a payment gateway in one repo.

### 1. Plan (John, lead — guided mode)

```
/mugiwara guided
/mugiwara-plan
```

Nami's interview asks **"Solo or team?"** → "Team, 3 people." Nami collects
assignee + branch per sub-mission and writes one plan:

```markdown
## Sub-missions
| ID | Name            | Assignee | Branch            | Status | Depends | Touched Files |
|----|-----------------|----------|-------------------|--------|---------|---------------|
| A  | Ledger API      | john    | feat/pg-ledger    | [ ]    | —       | contracts/, src/ledger/ |
| B  | Payment capture | patty     | feat/pg-capture   | [ ]    | A       | src/payments/, src/webhook/ |
| C  | UI checkout     | austin     | feat/pg-ui        | [ ]    | B       | src/ui/checkout/ |
```

Savepoint runs: `state/payment-gateway-v2/john.json` etc.

### 2. Each member works their own branch

```bash
git checkout feat/pg-capture
/mugiwara continue payment-gateway-v2 patty   # resume patty's work, never john's/austin's
```

`continue/payment-gateway-v2/patty.json` is patty's resume point. John and Austin
have their own files — no clobbering.

### 3. Coordination

```bash
bun run scripts/initiative.ts status plans/2026-08-20-payment-gateway-v2.md
# A john   [~] · B patty [ ] (dep A) · C austin [ ] (dep B)

bun run scripts/initiative.ts conflict-check plans/2026-08-20-payment-gateway-v2.md
# A touches contracts/ + src/ledger/; B touches src/payments/ — no overlap
```

Patty waits for A to merge, then rebases; Austin waits for B.

### 4. Session loss

Patty's session dies mid-B. Monday, in auto mode the session-start hook
surfaces her in-flight work:

```
AUTO-RESUME: 1 mission in-flight for patty:
  - payment-gateway-v2 (patty) — wave 3, 2/8 tasks
```

`/mugiwara continue payment-gateway-v2 patty` resumes exactly her checkpoint.

### 5. Solo member

One engineer running a solo mission:

```bash
/mugiwara continue dark-mode           # no member → state.json, resumes directly
```

## Backward compatibility

Legacy flat files (`state.json`, `continue.md`, `state-<branch>.json`) are
ignored by the new layout and removed by `mugiwara reset` / `mugiwara archive`.
No shim is kept — identity is (mission, member), always.
