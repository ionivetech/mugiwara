# Audit Trail

Every artifact the Mugiwara crew produces — what writes it, when, and how to
read it as a reviewer.

## The artifacts

| Artifact | Path | Written by | When | For |
|----------|------|-----------|------|-----|
| **Plan doc** | `.mugiwara/plans/YYYY-MM-DD-<mission>.md` | Nami (planning) | Wave 2 | Zero-context executor — waves, tasks, criteria, risk |
| **Spec** | `.mugiwara/spec/YYYY-MM-DD-<mission>.md` | Usopp (brainstorm) / Luffy (spec bridge) | Wave 0–1 | Bridge from idea to plan — goal, acceptance, constraints |
| **State** | `.mugiwara/state/<mission>/[member].json` | `scripts/savepoint.sh` | Every wave boundary | Computed mission state: lane + lane_peak (clamp), wave, files, loc_ins/del/churn, sensitive paths, blockers, token budget, evidence paths. Identity = (mission, member); solo = state.json |
| **Continue** | `.mugiwara/continue/<mission>/[member].json` | `scripts/savepoint.sh` | Every wave boundary | Machine-written resume point: mission, member, wave, tasks done/total, mode, next action |
| **Decision log** | `.mugiwara/logs/YYYY-MM-DD-<mission>.md` | Luffy (orchestrator) | Every wave | Route reason, check-in verdicts, mode flips, decisions |
| **Blocker ledger** | `.mugiwara/issues/YYYY-MM-DD-<mission>-blockers.md` | Any agent | On blocker hit | Row per blocker: wave, task, symptom, attempted, help-needed |
| **Todo list** | `.mugiwara/results/<mission>/todos.md` | Zoro (execution) | Wave 3 | Checkbox per task, checked with evidence pointer |
| **Audit report** | `.mugiwara/results/<mission>/02-audit.md` | Chopper (checkpoint) | Wave 4 | Per-task evidence, commit hygiene, parallel-conflict, honest classification |
| **Quality report** | `.mugiwara/results/<mission>/03-quality.md` | Sanji (quality) | Wave 5 | Formatter/linter/unit/user-test results |
| **Gate verdict** | `.mugiwara/results/<mission>/04-gates.md` | Franky (gates) | Wave 6 | Coverage thresholds from config, build exit, DoD verdict |
| **Review findings** | `.mugiwara/review/YYYY-MM-DD-<mission>-review.md` | Robin (review) | Wave 7 | Severity-tagged: path:line → problem → fix |
| **Security report** | `.mugiwara/review/YYYY-MM-DD-<mission>-security.md` | Jinbe (security) | Wave 7 | STRIDE, OWASP mapping, checklist, CVSS severity |
| **Heal report** | `.mugiwara/results/<mission>/05-healing.md` | Brook (healing) | Wave 8 | Fixed list, escalated list, updated ledger |
| **Closure report** | `.mugiwara/results/<mission>/06-closure.md` | Luffy (orchestrator) | Wave 9 | Mission summary, per-wave outcomes, deferred items, lessons |
| **Mission report** | `.mugiwara/reports/YYYY-MM-DD-<mission>.md` | `scripts/mission-report.sh` | Wave 9 | Human-readable summary: what changed, gates, state, token cost |
| **PR verdict** | `.mugiwara/results/<mission>/07-pr-verdict.md` | Luffy (orchestrator) | Wave 9 | Ready PR summary block for the user to open the PR |
| **Trace** | `(legacy, no longer written)` | Resume coordinator | Every dispatch | Dispatch → outcome — drives resume (legacy; mission state preferred) |
| **Lessons ledger** | `.mugiwara/logs/lessons.md` | Memory Keeper | Cross-mission | One row per real lesson, append-only, all actors share |
| **Evidence logs** | `.mugiwara/results/<mission>/<label>-<hash>.log` | `scripts/evidence.sh` | On demand | Command stdout/stderr capture with timestamp and exit code |

## How to read as a reviewer

1. **Start with the mission report** (`reports/`) — one file, what changed, gates, token cost.
2. **Check the gate verdict** (`results/<mission>/04-gates.md`) — coverage from config, build, DoD. Any FAIL needs explanation.
3. **Spot-check the audit report** (`results/<mission>/02-audit.md`) — did Chopper re-run checks or accept claims? Every criterion gets a command run + evidence row.
4. **Review findings count** (`review/`) — how many blocker/major/minor? Were they healed? Check the heal report for closure.
5. **State.json** for raw numbers — lane, wave, files, blockers open, heal cycle, token budget status (ok/warn/stop).

## What stays after cleanup

After Wave 9 closure (run via `mugiwara-ship` cleanup procedure):

**Kept** (audit trail + PR material):
- `config` — runtime config
- `plans/<mission>.md` — clean plan doc
- `results/<mission>/06-closure.md` — closure report
- `results/<mission>/07-pr-verdict.md` — PR material
- `reports/YYYY-MM-DD-<mission>.md` — mission report
- `state/<mission>/` — final mission state (unless another actor's mission is active)
- `logs/lessons.md` — cross-mission lessons
- `backup/`, `manifest.json` — harness config

**Deleted** (consumed/superseded):
- `spec/<mission>.md` — consumed by planning
- `results/<mission>/todos.md` — consumed
- `results/<mission>/02-audit.md` — superseded by closure
- `results/<mission>/03-quality.md` — consumed
- `results/<mission>/04-gates.md` — consumed
- `results/<mission>/05-healing.md` — consumed
- `results/<mission>/trace.md (legacy)` — consumed (mission state is canonical)
- `review/<mission>-review.md` — consumed
- `review/<mission>-security.md` — consumed
- `issues/<mission>-blockers.md` — consumed
- `logs/<mission>.md` — decision log, per-mission

Cleanup lists candidates first (dry-run), then deletes. A mission is only
closed after cleanup runs.

## Git: what to commit

The audit trail is the product — commit it. The installer writes a `.gitignore`
block that splits `.mugiwara/`:

| Path | Git fate | Why |
|------|----------|-----|
| `reports/`, `results/`, `logs/` | **commit** | the trail itself — mission reports, gate evidence, decision logs |
| `spec/`, `plans/` | **commit** | decisions, not scratch |
| `state/`, `continue/` | ignore | session state + resume point, recomputed each wave |
| `config` | ignore | runtime mode; per-developer, not per-repo |
| `refs/` | ignore | regenerated by install |

An audit trail that does not survive the merge is not an audit trail. If your
repo ignores `.mugiwara/` wholesale, the mission report, evidence, and decision
log vanish when the branch merges.

## What the artifacts look like

The trail is real files, not promises. Three representative examples.

### Mission report (`reports/YYYY-MM-DD-<mission>.md`)

    # Mission: invitation-accepted-flow . 2026-08-11

    **Lane** full . **Mode** guided . **Actor** john . **Branch** feature/MKR-412

    ## Waves

    | Wave | Artifact | Verdict |
    |------|----------|---------|
    | Quality (Wave 5) | `03-quality.md` | PASS |
    | Gates (Wave 6) | `04-gates.md` | PASS |

    ## State

    | Field | Value |
    |-------|-------|
    | Tasks | 6/6 done |
    | Heal cycles | 1 |
    | Tokens used | 14,200 / 20,000 |

### Blocker ledger row (`issues/<mission>-blockers.md`)

    | wave | task | symptom | attempted | help-needed |
    |------|------|---------|-----------|-------------|
    | 3 | T4 | no e2e setup in repo | searched for playwright/cypress config | user: run e2e manually? |

### Review finding (`review/<mission>-review.md`)

    src/auth/invitation.ts:47 — 🔴 blocker: redirect uses the unvalidated `flow`
    param → open redirect. Validate against an allowlist before `res.redirect`.

These three — report, blocker row, review finding — are what a reviewer opens to
trust the mission. If the report is missing or the findings are gone, the trail
did not survive, and the claim is empty.
