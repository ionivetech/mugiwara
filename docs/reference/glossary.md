# Glossary

One page for the words mugiwara uses. Where two words share a concept, this
page names the preferred one.

| Term | Meaning |
|------|---------|
| **Mission** | One unit of governed work. Lives in `.mugiwara/missions/<name>/`. Starts at triage, ends at closure + archive. |
| **Flow stage** (aka "wave") | One step of the pipeline: Flow 0 triage → 1 brainstorm → 2 plan → 3 execute → 4 checkpoint → 4.5 claim-audit → 5 quality → 6 gates → 7 review+security → 8 heal → 9 closure. Older texts say "wave"; prefer **flow stage**. |
| **flows/** | The mission's flow-artifact directory (`missions/<mission>/flows/NN-name.md`). Legacy missions may still keep `waves/` — readers accept both, and a legacy mission stays on its existing directory so an in-flight trail never splits. |
| **Wave** (planning) | An execution batch in a *plan document* ("Wave table", parallel-proof waves) — unrelated to the pipeline's flow stages and not a directory name. |
| **Lane** | How much process the change gets: `direct` (no pipeline) / `lean` / `standard` / `full` / `spike` (resize). Computed from the git diff; sensitive paths force full. |
| **Mode** | Autonomy level: `guided` (asks first) / `semi` / `auto`. Set in `.mugiwara/config`. Mode is one of three independent decisions (see Control mode). |
| **Control mode** | The "how much do you participate" decision. One of three independent dimensions (control mode / execution posture / Cost Governor) — it never implies a topology or cost tier. |
| **Execution posture** | The "how is work performed" decision: `inline-sequential` (default) / `inline-batched` / `parallel-workers` / `context-relief` / `phase-isolated` / `team-scoped`. Chosen deterministically at flow boundaries, recorded in the decision trail. Never implies a control mode. |
| **Cost Governor** | The "what is safe to spend" decision. Supplies reserve / project / avoid / stop verdicts, measures context, and records an optimization trail. Recommends and records — never silently skips a safety stage or replaces consent. |
| **Slop** | Wasted cost the governor flags: repeated reads, useless abstraction/boilerplate, healing spin, out-of-scope work. Detected live and attributed per crew member. |
| **Savepoint** | State written to `<mission>/state.json` (+ `continue*.json`) at each flow-stage boundary. Powers resume and every computed command. |
| **Continue** | Deterministic resume: prints the exact point to pick work back up (`mugiwara continue`). |
| **Evidence** | A recorded artifact — command output, file, commit — that a claim points at. Claims without evidence do not pass flow stages. |
| **Gate** | Binary pass/fail with evidence (coverage, build, DoD, sonar-style conditions). No negotiation. |
| **Blocker ledger** | `blockers.md` rows for anything that failed and needs help. Ship-readiness requires it empty or owned. |
| **Heal cycle** | One Brook pass over accumulated failures. Bounded at 3; a 4th halts and escalates. |
| **Banner** | The `## <emoji> Flow N — Crew (Role)` heading marking a flow stage's start; its absence means the stage was skipped (recorded). |
| **Check-in** | Luffy's report at a flow-stage boundary: what happened, evidence links, next route. |
| **Trail** | Everything a mission leaves under `.mugiwara/`: plans, waves, review/security findings, decisions, blockers. Folds into `report.md` at archive. |
| **Archive** | `mugiwara archive <mission>` — folds the trail into report.md after the integrity gate passes; leaves durable files behind. |
| **Provenance** | Per-commit attribution block (agent/model/lane/evidence) attached as a git note + `provenance.md`. See [provenance](../concepts/provenance.md). |
| **Policy** | `mugiwara.policy.yml` — org rules that push lanes/thresholds up only. See [policy as code](../concepts/policy-as-code.md). |
| **Index budget** | The 5,500-char ceiling on skill+agent descriptions loaded cold every session. Enforced by the validator. |

Counts, single source of truth: **21 skills**, **11 user-facing agents
(+3 internal)** — whatever another page claims, these numbers govern.
