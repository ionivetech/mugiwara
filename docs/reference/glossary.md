# Glossary

One page for the words mugiwara uses. Where two words share a concept, this
page names the preferred one.

| Term | Meaning |
|------|---------|
| **Mission** | One unit of governed work. Lives in `.mugiwara/missions/<name>/`. Starts at triage, ends at closure + archive. |
| **Flow stage** (aka "wave") | One step of the pipeline: Flow 0 triage → 1 brainstorm → 2 plan → 3 execute → 4 checkpoint → 4.5 claim-audit → 5 quality → 6 gates → 7 review+security → 8 heal → 9 closure. Older texts say "wave"; prefer **flow stage**. |
| **Lane** | How much process the change gets: `direct` (no pipeline) / `lean` / `standard` / `full` / `spike` (resize). Computed from the git diff; sensitive paths force full. |
| **Mode** | Autonomy level: `guided` (asks first) / `semi` / `auto`. Set in `.mugiwara/config`. |
| **Savepoint** | State written to `<mission>/state.json` (+ `continue*.json`) at each flow-stage boundary. Powers resume and every computed command. |
| **Continue** | Deterministic resume: prints the exact point to pick work back up (`mugiwara continue`). |
| **Evidence** | A recorded artifact — command output, file, commit — that a claim points at. Claims without evidence do not pass flow stages. |
| **Gate** | Binary pass/fail with evidence (coverage, build, DoD, sonar-style conditions). No negotiation. |
| **Blocker ledger** | `blockers.md` rows for anything that failed and needs help. Ship-readiness requires it empty or owned. |
| **Heal cycle** | One Brook pass over accumulated failures. Bounded at 3; a 4th halts and escalates. |
| **Banner** | The `⚔️ FLOW N — CREW` line marking a flow stage's start; its absence means the stage was skipped (recorded). |
| **Check-in** | Luffy's report at a flow-stage boundary: what happened, evidence links, next route. |
| **Trail** | Everything a mission leaves under `.mugiwara/`: plans, waves, review/security findings, decisions, blockers. Folds into `report.md` at archive. |
| **Archive** | `mugiwara archive <mission>` — folds the trail into report.md after the integrity gate passes; leaves durable files behind. |
| **Provenance** | Per-commit attribution block (agent/model/lane/evidence) attached as a git note + `provenance.md`. See [provenance](../concepts/provenance.md). |
| **Policy** | `mugiwara.policy.yml` — org rules that push lanes/thresholds up only. See [policy as code](../concepts/policy-as-code.md). |
| **Index budget** | The 5,500-char ceiling on skill+agent descriptions loaded cold every session. Enforced by the validator. |

Counts, single source of truth: **21 skills**, **11 user-facing agents
(+3 internal)** — whatever another page claims, these numbers govern.
