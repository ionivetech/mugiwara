# Audit Trail

Every artifact the Mugiwara crew produces — what writes it, when, and how to
read it as a reviewer.

One directory per mission: `.mugiwara/missions/<mission>/`. Bare file names,
no date prefixes — the date lives in `state.json` (`updated_at`) and in git
history.

## The artifacts

| Artifact | Path | Written by | When | For |
|----------|------|-----------|------|-----|
| **Plan doc** | `missions/<mission>/plan.md` | Nami (planning) | Flow 2 | Zero-context executor — plan waves, tasks, criteria, risk |
| **Spec** | `missions/<mission>/spec.md` | Usopp (brainstorm) / Luffy (spec bridge) | Flow 0–1 | Bridge from idea to plan — goal, acceptance, constraints |
| **Decision log** | `missions/<mission>/decisions.md` | Luffy (orchestrator) | Every flow stage | Route reason, check-in verdicts, mode flips, decisions |
| **Blocker ledger** | `missions/<mission>/blockers.md` | Any agent | On blocker hit | Row per blocker: flow stage, task, symptom, attempted, help-needed |
| **State** | `missions/<mission>/state.json` or `<member>.json` | `mugiwara savepoint` | Every flow-stage boundary | Computed mission state: lane + lane_peak (clamp), flow stage, files, loc_ins/del/churn, sensitive paths, blockers, token budget, evidence paths. Identity = (mission, member); solo = state.json |
| **Continue** | `missions/<mission>/continue.json` or `continue-<member>.json` | `mugiwara savepoint` | Every flow-stage boundary | Machine-written resume point: mission, member, flow stage, tasks done/total, mode, next action |
| **Todo list** | `missions/<mission>/flows/todos.md` | Zoro (execution) | Flow 3 | Checkbox per task, checked with evidence pointer |
| **Audit report** | `missions/<mission>/flows/02-audit.md` | Chopper (checkpoint) | Flow 4 | Per-task evidence, commit hygiene, parallel-conflict, honest classification |
| **Quality report** | `missions/<mission>/flows/03-quality.md` | Sanji (quality) | Flow 5 | Formatter/linter/unit/user-test results |
| **Gate verdict** | `missions/<mission>/flows/04-gates.md` | Franky (gates) | Flow 6 | Coverage thresholds from config, build exit, DoD verdict |
| **Review findings** | `missions/<mission>/review.md` | Robin (review) | Flow 7 | Severity-tagged: path:line → problem → fix |
| **Security report** | `missions/<mission>/security.md` | Jinbe (security) | Flow 7 | STRIDE, OWASP mapping, checklist, CVSS severity |
| **Heal report** | `missions/<mission>/flows/05-healing.md` | Brook (healing) | Flow 8 | Fixed list, escalated list, updated ledger |
| **Closure report** | `missions/<mission>/flows/06-closure.md` → seeds `report.md` | Luffy (orchestrator) | Flow 9 | Mission summary, per-flow-stage outcomes, deferred items, lessons |
| **PR verdict** | `missions/<mission>/flows/07-pr-verdict.md` | Luffy (orchestrator) | Flow 9 | Ready PR summary block for the user to open the PR |
| **Mission report** | `missions/<mission>/report.md` | `mugiwara archive <mission>` at closure | Flow 9 | The durable one-file trail: closure summary with every flow file, review, security, blockers, decisions folded in |
| **Lessons ledger** | `.mugiwara/lessons.md` | Memory Keeper | Cross-mission | One row per real lesson, append-only, all actors share |
| **Mission index** | `.mugiwara/index.md` | `mugiwara archive` / `clean` | Per archive | One line per archived mission |

The `mugiwara …` entries above are bundled shell scripts (`savepoint.sh`,
`lane.sh`) that the CLI resolves from the package root, so they work on every
install target rather than only where a `scripts/` directory happens to sit
in the cwd.

**Lane 0/1 (audit-lite).** Small work writes the small trail: `state.json`,
`flows/01-execution.md`, and the closure `report.md`. Plan, spec, blockers,
and per-flow-stage files appear on Lane 0/1 only when a blocker actually
occurs.

## How to read as a reviewer

1. **Start with `report.md`** — one file: what changed, gates, token cost,
   the **Review routing** section (ranked reading order — read those files
   first), and (after archive) every flow artifact folded inside.
2. **Check the gate verdict** (`flows/04-gates.md`) — coverage from config
   (+ any policy raise), build, DoD. Any FAIL needs explanation.
3. **Spot-check the audit report** (`flows/02-audit.md`) — did Chopper re-run
   checks or accept claims? Every criterion gets a command run + evidence row.
4. **Review findings count** (`review.md`, `security.md`) — how many
   blocker/major/minor? Were they healed? Check the heal report for closure.
5. **Provenance** (`provenance.md`, or `mugiwara blame <path>` after fetching
   notes) — who produced this, under which lane, with what evidence. Paste it
   into the PR so the attribution survives outside `.mugiwara/`.
6. **State.json** for raw numbers — lane, flow stage, files, blockers open,
   heal cycle, token budget status (ok/warn/stop).

## What stays after closure

After Flow 9, run `mugiwara archive <mission>`:

- It folds `flows/*.md`, `spec.md`, `review.md`, `security.md`,
  `blockers.md`, `decisions.md` into `report.md` (each as an
  `## Archived: <file>` section), then removes them.
- Session state (`state.json`, `continue*.json`) is deleted with it.
- Closure adds, when derivable: **provenance.md** (who/what/lane/evidence,
  PR-paste-ready — see [provenance](provenance.md)) and **rollback.sh**
  (executable revert map — see [closure tools](closure-tools.md)).
  The report also gains a **Review routing** section and a **Context
  footprint** line.
- The mission dir ends as durable files: **plan.md + report.md** plus the
  closure artifacts above when they could be derived. The archive itself is
  gated: dangling links, secrets, or missing evidence fail it (see
  [closure tools](closure-tools.md)).

Batch form for several closed missions:
`mugiwara clean [--all] [--before <date>]` — archives everything with a
`report.md` and no live session state; `--all --force` includes in-flight
missions. Both commands append a line to `.mugiwara/index.md`.

Kept forever: `config`, `lessons.md`, `index.md`, and per mission
`plan.md` + `report.md`.

## Git: what to commit

The audit trail is the product — commit it. The installer writes a `.gitignore`
block that splits `.mugiwara/`:

| Path | Git fate | Why |
|------|----------|-----|
| `missions/*/{plan.md, spec.md, decisions.md, blockers.md, review.md, security.md}` | **commit** | decisions, not scratch |
| `missions/*/flows/` | **commit** | flow-stage evidence until archived into report.md |
| `missions/*/report.md` | **commit** | the durable consolidated trail |
| `missions/**/*.json` | ignore | session state + resume points, recomputed each flow stage |
| `index.md`, `config`, `refs/` | index commits; config + refs ignored | index is history aid; config is per-developer; refs regenerate |

An audit trail that does not survive the merge is not an audit trail. If your
repo ignores `.mugiwara/` wholesale, the mission report, evidence, and decision
log vanish when the branch merges.

## What the artifacts look like

The trail is real files, not promises. Three representative examples.

### Mission report (`missions/<mission>/report.md`)

    # Mission: invitation-accepted-flow

    **Lane** full . **Mode** guided . **Actor** john . **Branch** feature/MKR-412

    ## Flow stages

    | Flow stage | Artifact | Verdict |
    |------|----------|---------|
    | Quality (Flow 5) | `flows/03-quality.md` | PASS |
    | Gates (Flow 6) | `flows/04-gates.md` | PASS |

    ## State

    | Field | Value |
    |-------|-------|
    | Tasks | 6/6 done |
    | Heal cycles | 1 |
    | Tokens used | 14,200 / 20,000 |

### Blocker ledger row (`missions/<mission>/blockers.md`)

    | flow stage | task | symptom | attempted | help-needed |
    |------|------|---------|-----------|-------------|
    | 3 | T4 | no e2e setup in repo | searched for playwright/cypress config | user: run e2e manually? |

### Review finding (`missions/<mission>/review.md`)

    src/auth/invitation.ts:47 — 🔴 blocker: redirect uses the unvalidated `flow`
    param → open redirect. Validate against an allowlist before `res.redirect`.

These three — report, blocker row, review finding — are what a reviewer opens
to trust the mission. If the report is missing or the findings are gone, the
trail did not survive, and the claim is empty.
