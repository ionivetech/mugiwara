# Roadmap

Mugiwara is the governance layer for AI-assisted engineering work: every change
the crew makes carries a human-reviewable trail — which wave, what evidence,
approved by whom — and the cost of the process scales to the size of the work.

This roadmap projects forward from that sentence. Ten features, each named for
what it does rather than when it lands.

---

## The bet

The constraint in AI-assisted engineering is shifting.

| Then                      | Now                                     | Next                                 |
| ------------------------- | --------------------------------------- | ------------------------------------ |
| _Can the agent write it?_ | _Can the agent finish it unsupervised?_ | _**Can anyone verify what it did?**_ |

Model capability keeps rising, and every increase makes the third question
harder, not easier. More code is produced per hour than any team can read. Work
spans sessions, models, and people. Tool surfaces grow faster than anyone audits
them. Internal AI policies and external regulation are arriving, and both ask the
same thing: _show me what the machine changed and why you trusted it._

**Mugiwara's value scales with model capability rather than against it.** A pack
that helps an agent write code competes with the next model release. A layer that
proves what the agent did becomes more necessary with each one.

Every feature below is chosen against that bet, and against three limits that do
not move: no runtime, 26 skills, twelve harnesses of uneven capability.

### Current state

Verified by execution at v0.6.2 (2026-08-14):

```
26 skills · 14 agents (+3 internal) · 33 skill-local references · 12 harness targets
cold-load index      1.3k tokens, budget-gated
retrieval accuracy   rank-1 93.5% · top-3 100% · negatives 100%
determinism          lane · savepoint (hook-driven on claude, crew-driven elsewhere)
                     evidence + mission-report exist and run, but are called
                     from prose once each — an optional tip and a closure step
install coverage     91.6% across 9 targets
```

**Newly shipped (v0.6.0):**
- **Sonar-style metrics** — duplication %, complexity scoring, maintainability rating (A–E), code attribute checks per wave
- **Security hotspots + SCA** — STRIDE-pointed hotspot review, license compliance, dependency audit
- **Team initiatives** — sub-mission planning and the shared plan format, with
  status tracked in the plan doc itself. No `mugiwara initiative` CLI shipped:
  `src/cli.ts` has no such command, and `scripts/initiative.ts` is
  repo-development-only (not installed)
- **Onboarding wizard** — `mugiwara onboard`: zero-LLM terminal wizard
  (6 questions) for branch pattern, mode, review depth, quality checks,
  coverage, and commit style/template

**Satisfied at v0.6.5:** the hardening suite — assertion integrity
(conditional-assertion gate + G5 mutation), published threat model
(`docs/concepts/security.md`), output discipline (`verbosity` config),
collaboration flows (case-insensitive parsing, loud failures, conflict
checks), and cross-platform conformance (12/12 platforms,
`scripts/conformance.ts`). Implemented items are removed from the list below —
everything remaining is future work.

Outstanding defects are tracked separately in the fix list, not here. A roadmap
that contains bug fixes hides how much of it is actually new.

---

## Near — make the trail worth trusting

### 1. Outcome validation

**Prove the thesis outside this repo.**

Ten external repositories, at least one harness per tier. Record lane accuracy
against human judgement, gate pass rate, tokens, wall-clock, heal cycles. Fill
`docs/reference/compliance-matrix.md` with measurements instead of design intent.

**Then publish the failures.** _"On Gemini tier 2, evidence checks hold 65% — use
guided mode there."_ Every pack claims success; none publishes where it breaks.
The first that states plainly where it fails becomes the most trusted, precisely
because it admitted it. For a governance layer that is not a marketing choice —
it is the product.

**Why first.** This is the only item that measures whether mugiwara produces
better work, and features 6 and 10 both depend on it being credible. It cannot
be accelerated, so it starts before them.

_Pillar 1._

### 2. Provenance ledger

**Line-level attribution for AI-written code.**

For every mission, record which lines were agent-authored, under which lane, by
which model, verified by which evidence — then attach it to the commit as a git
note. `git blame` answers _who_; this answers _what verified it_.

```
$ mugiwara blame src/auth/invitation.ts:42
  agent   zoro-execution · claude-sonnet-4.6 · lane full
  gate    coverage 94% · security STRIDE clean · DoD 5/5
  report  .mugiwara/reports/2026-08-11-invitation-accepted.md
  human   reviewed by john, PR #412
```

**Why now.** Internal AI-usage policies are landing at most engineering orgs, and
the near-universal first question is _which of this was AI-written?_ Today the
honest answer is nobody knows. Mugiwara already holds every input — mission,
lane, model, gates, evidence paths — and throws the linkage away at closure.

**Feasible.** Git notes on `refs/notes/mugiwara`, written by `savepoint.sh`. No
runtime, no history rewrite, survives rebase via `notes.rewriteRef`.

_Pillar 1 · the highest-value item on this list._

### 3. Review routing

**Tell the reviewer where to look.**

The bottleneck is no longer writing code; it is reading it. A 2,000-line
agent-authored diff gets rubber-stamped, and a rubber-stamped review is worse
than none, because it launders the change through a human name.

Instead of a flat diff, emit a ranked reading order: hunks weighted by lane,
sensitive-path hits, gate margin, heal history on those files, and absence of
evidence. _"Read these 40 lines first. Skip these 900 — test scaffolding,
covered, never healed."_

**Why now.** Agent output volume is growing faster than review capacity, and that
gap is where governance quietly fails.

**Feasible.** Every input already sits in `state.json` and the ledger. Output is a
section of the mission report, and a PR comment once CI lands.

_Pillar 1 · the highest-leverage thing you can hand a human._

### 4. Policy as code

**Org rules that override crew judgement.**

A `mugiwara.policy.yml` at repo root, read by `lane.sh` and the gates:

```yaml
lanes:
  force_full: ["src/auth/**", "src/payments/**", "**/migrations/**"]
gates:
  coverage: { new: 90, modified: 85 }
  require_human_approval: ["src/payments/**"]
evidence:
  required: [test, lint, security]
model:
  min_tier_for_lane_3: tier-1
```

Policy wins over inferred lane — always upward, never downward.

**Why now.** Every team adopting this has rules that are currently tribal
knowledge. Encoding them is what turns a personal tool into something a team
standardises on, and what makes governance auditable at the org level rather than
the session level.

**Feasible.** One YAML file read by two existing scripts. Optional; absent means
today's behavior.

_Pillar 3, 5 · the adoption unlock._

### 5. Cross-model verification

**A second model checks the first one's claim.**

For high-stakes assertions — "tests pass", "no breaking change", "STRIDE clean" —
a second, cheaper model re-reads the evidence artifact and returns agree/disagree
with a reason. Disagreement escalates rather than blocks.

**Why now.** Teams already run several models. Self-assessment is the weakest link
in every agent pipeline, and `docs/reference/compliance-matrix.md` exists
precisely because models differ in how reliably they follow a rule. Verification
is the natural use of that variance.

**Feasible, with a stated limit.** Needs a second model CLI, so it works on tier 1
and part of tier 2. Opt-in, degrades to today's behavior elsewhere, and the
mission report records which verification path ran. Uneven capability gets
documented, never implied.

_Pillar 1._

---

## Mid — governance that holds when nobody is watching

### 6. Enforced merge gate

**Mugiwara as a required CI check.**

`mugiwara ci --pr <url>` runs the wave audit, quality, gates, review, and security
against the PR diff and posts severity-tagged findings. Replies of "fixed" or
"won't fix" are re-evaluated, and the conversation joins the audit trail instead
of disappearing into PR history.

**Constraint.** A CI run must produce the same `mission-report.md` as a local run.
If CI needs its own reporting path, the artifact is not canonical and Pillar 1 is
weaker than claimed.

**Depends on feature 1.** Do not make this a required check before there are
numbers from repos nobody here controls. Blocking someone's PR on routing measured
only in its own repo is the wrong first impression for a governance tool.

_Pillar 1 · governance that is optional is not governance._

### 7. Permission boundaries

**Personas with teeth.**

Scoped tool sets per crew member: Chopper read plus shell, no write. Robin read
plus grep, no shell. Brook read and write, no network. Enforced by the harness
where the harness supports it.

**The tension, resolved in writing.** `README.md` says _"Nothing hides behind a
subagent click."_ Dispatching crew members as subagents looks like a
contradiction. The distinction is real and must be stated: **isolation for
permission, never for autonomy.** A subagent enforcing read-only scope still
reports its findings inline. A subagent hiding hours of unattended work does not,
and mugiwara does not do that.

**The asymmetry, also in writing.** Enforcement is tier-1 only; tier 2 and 3
receive agents as markdown. A tier-3 user must not believe they have boundaries
they do not have.

_Pillar 1, 4 · an auditor that can edit code is not an auditor._

### 8. Tool-surface governance

**Audit what the agent can reach, not only what it wrote.**

Pre-mission MCP audit: provenance per server, tool inventory, capability drift
since last session. Minimum tool set computed from mission scope, with a warning
on over-scoped context. Output from a server that returned untrusted content is
quarantined and cannot drive routing until sanitised. Every invocation logged —
server, tool, input and output hash — into the evidence trail.

**Why now.** Tool surfaces are the fastest-growing attack path in agentic systems,
and `mugiwara-agent-security` already maps the Agentic OWASP Top 10. This makes it
systematic rather than advisory.

_Pillar 1, 4 · governance that stops at the code is incomplete._

### 9. Long-running missions

**Work that outlives a session, a model, or a person.**

Missions spanning days and handing off between engineers: resumable across model
switches with the switch recorded, `mugiwara handoff` producing a report the next
person can act on, and staleness detection when the base branch has moved under a
paused mission.

**Why now.** Agent work is lengthening, and the failure mode is not a crash — it
is a mission resumed against a base that changed three days ago, silently. The
savepoint architecture already solves the state half; this closes the time half.

**Feasible.** Extends `state.json` and the existing multi-actor branch
namespacing. No new machinery.

_Pillar 2, 5._

---

## Far — make the evidence worth something

### 10. Signed attestation

**Evidence that cannot be fabricated after the fact.**

Sign the mission report and its evidence hashes at closure. `mugiwara verify`
confirms a report matches the commits and artifacts it claims, and detects
post-hoc editing.

**Why this matters.** Every claim in this roadmap assumes the audit trail is
honest. An unsigned trail is one anyone can rewrite — for a governance layer, the
difference between evidence and decoration. This is what makes mugiwara's output
something an auditor outside the team can rely on.

**Feasible, optional.** Detached signatures via minisign or sigstore, with
user-supplied keys. No keys means today's behavior. Never a hard dependency.

_Pillar 1 · the logical endpoint of the thesis._

---

## Standing constraints

- **No runtime, no daemon.** Orchestration stays in the harness. Anything needing
  a persistent process ships as a separate optional package, and core keeps
  working without it.
- **26 skills is the ceiling.** A new skill replaces an old one.
- **No auto-merge, no auto-deploy.** Human review at the PR is the terminal gate.
- **Not an unattended-marathon runner.** Hidden subagent work buys autonomy;
  watching the work pays for it. Opposite ends of one axis, and mugiwara chose
  visibility.
- **Not an MCP server.** Mugiwara governs tool surfaces; it does not become one.
- **No per-engineer metrics visible to anyone but that engineer.** Aggregate by
  team and repo. The moment a developer tool emits per-person statistics a manager
  can read, developers stop using it or start gaming it — and either outcome
  destroys the audit trail this entire roadmap exists to produce. A product
  boundary, not a preference.
- **No head-to-head scorecards.** The compliance matrix reports behavior, which is
  a stronger document than a feature count.

## The standing rule

> **Every defect found in production adds a gate before the fix merges.**

The fix closes one instance; the gate closes the class. Two defects in this
project survived several releases — a fabricated eval score and a reference file
that never installed — and both survived for the same reason: every gate
validated the repo, while users run the install output.

`docs/enforcement.md` tells users that prose cannot compel a model. The project
holds itself to that standard too. Mugiwara's own invariants belong in gates, not
in prose.
