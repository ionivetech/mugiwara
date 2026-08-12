# Audit Trail

Every artifact the Mugiwara crew produces — what writes it, when, and how to
read it as a reviewer.

## The artifacts

| Artifact | Path | Written by | When | For |
|----------|------|-----------|------|-----|
| **Plan doc** | `.mugiwara/plans/YYYY-MM-DD-<mission>.md` | Nami (planning) | Wave 2 | Zero-context executor — waves, tasks, criteria, risk |
| **Spec** | `.mugiwara/spec/YYYY-MM-DD-<mission>.md` | Usopp (brainstorm) / Luffy (spec bridge) | Wave 0–1 | Bridge from idea to plan — goal, acceptance, constraints |
| **State** | `.mugiwara/state.json` | `scripts/savepoint.sh` | Every wave boundary | Computed mission state: lane, wave, files, blockers, token budget, evidence paths |
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
| **Trace** | `(legacy, no longer written)` | Resume coordinator | Every dispatch | Dispatch → outcome — drives resume (legacy; state.json preferred) |
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
- `state.json` — final mission state (unless another actor's mission is active)
- `logs/lessons.md` — cross-mission lessons
- `backup/`, `manifest.json` — harness config

**Deleted** (consumed/superseded):
- `spec/<mission>.md` — consumed by planning
- `results/<mission>/todos.md` — consumed
- `results/<mission>/02-audit.md` — superseded by closure
- `results/<mission>/03-quality.md` — consumed
- `results/<mission>/04-gates.md` — consumed
- `results/<mission>/05-healing.md` — consumed
- `results/<mission>/trace.md (legacy)` — consumed (state.json is canonical)
- `review/<mission>-review.md` — consumed
- `review/<mission>-security.md` — consumed
- `issues/<mission>-blockers.md` — consumed
- `logs/<mission>.md` — decision log, per-mission

Cleanup lists candidates first (dry-run), then deletes. A mission is only
closed after cleanup runs.
