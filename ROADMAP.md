# Roadmap

Mugiwara is the governance layer for AI-assisted engineering work: every change
the crew makes carries a human-reviewable trail — which wave, what evidence,
approved by whom — and the cost of the process scales to the size of the work.

This roadmap projects forward from that sentence. Eleven items, each named for
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
not move: no runtime, 21 skills, twelve harnesses of uneven capability.

### Current state

Verified by execution at v0.7.0 (mission-first layout, 2026-08):

```
21 skills · 14 agents (+3 internal) · 12 harness targets
cold-load index      4,741 chars ≈ 1.2k tokens, budget-gated (doc-gated against drift)
workspace            .mugiwara/missions/<mission>/ — one dir per mission, bare names
retrieval accuracy   rank-1 94.3% · top-3 100% · negatives 100%
determinism          lane · savepoint (hook-driven on claude, crew-driven elsewhere)
install coverage     verified across 9 targets + 3 marketplace manifests
```

Shipped in this release: the closure subsystem — provenance ledger (git note
+ `provenance.md` + `mugiwara blame`), review routing and context footprint
in every report, the closure integrity gate (dangling links, secrets, and
missing evidence fail the archive), executable rollback maps, staleness
warnings on resume with `mugiwara handoff`, optional minisign attestation,
policy as code (`mugiwara.policy.yml` read by lane.sh/savepoint.sh and the
coverage gate), per-persona tool scopes with a documented tier matrix, and
the Flow 0 tool-surface inventory. Details: docs/concepts/{provenance,
policy-as-code,closure-tools,permissions}.md and docs/adoption.md.

Shipped at v0.6.6–0.7.0: the prune (onboarding wizard, session-start announce,
5 overlapping skills, stage slash commands, team-initiative CLI,
evidence.sh/mission-report.sh) and the mission-first workspace —
`missions/<mission>/` with `plan.md`, `flows/`, `report.md`; archive folds the
trail into one file per mission; `mugiwara clean` batch-archives closed
missions; audit-lite Lane 0/1 writes three artifacts instead of nine;
cross-flow check reuse dedupes Flow 4/5/6 runs; `verify_merged=on` collapses
Flow 5+6 into one verify pass.

Outstanding defects are tracked separately in the fix list, not here. A roadmap
that contains bug fixes hides how much of it is actually new.

---

## Near — make the trail worth trusting

### 1. Provenance ledger — ✅ shipped

**Line-level attribution for AI-written code.**

For every mission, record which lines were agent-authored, under which lane, by
which model, verified by which evidence — distributed in two layers: a summary
posted as a PR comment via the host API (visible in GitHub, GitLab, and
Bitbucket web UIs alike), plus an optional local git note for line-level
queries. `git blame` answers _who_; this answers _what verified it_.

```
$ mugiwara blame src/auth/invitation.ts
  commit 4f2a1bc (last touching this path)
  agent   zoro-execution · claude-sonnet-4.6 · lane full
  gate    coverage 94% · security STRIDE clean · DoD 5/5
  report  .mugiwara/missions/invitation-accepted/report.md
  human   reviewed by john, PR #412
```

Attribution is file-level today — the last commit that touched the path.
Line-level attribution needs per-line tracking the pipeline does not record
yet; the honest scope is stated here rather than implied by syntax.

**Why now.** Internal AI-usage policies are landing at most engineering orgs, and
the near-universal first question is _which of this was AI-written?_ Today the
honest answer is nobody knows. Mugiwara already holds every input — mission,
lane, model, gates, evidence paths — and throws the linkage away at closure.

**Feasible.** The summary layer reuses whatever host API the repo lives on;
hosting UIs never render git notes, so they are the archive, not the channel.
Notes go on `refs/notes/mugiwara`, written by `savepoint.sh` — no runtime, no
history rewrite, survives rebase via `notes.rewriteRef`, removable without side
effects.

_Pillar 1 · the highest-value item on this list._

### 2. Review routing — ✅ shipped

Ranked reading order from lane, sensitive paths, and evidence coverage;
heal-history weighting is deferred until per-file heal events are recorded.

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

_Pillar 1 · the highest-value thing you can hand a human._

### 3. Policy as code — ✅ shipped

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

### 4. Token efficiency — measured, not estimated — ◐ context budget shipped; provider telemetry documented, estimator remains default

**The cost users feel daily, made verifiable.**

Partly shipped: silent session start (zero idle cost), audit-lite Lane 0/1,
cross-flow check reuse, `verify_merged`, archive compaction. What remains:

- **Real telemetry.** The estimator (`LANE_BASE + words×1.35 + LOC×12`) is a
  monotonic proxy. Read provider usage where the harness exposes it; the state's
  `tokens_source: reported` path exists — make it the default where possible.
- **Context budget as a gate.** Per-flow-stage context ceilings with a visible
  number in the mission report, so a bloated investigation is caught like a
  failed test.

**Why now.** A governance layer that doubles the bill gets disabled; one that
publishes its own cost per mission earns the right to add process elsewhere.
Efficiency claims must obey the same measured-not-claimed rule as everything
else.

_Pillar 3 · keeps the tool installed._

### 5. Closure integrity gate — ✅ shipped

**The audit trail validates itself at archive time.**

Before `mugiwara archive` folds a mission's trail into `report.md`, a
deterministic script checks three things: every path cited in the report and
flow files exists; no file in the trail matches secret patterns (keys, tokens,
credentials); and every gate verdict the report cites has a matching entry in
the ledger. A violation fails the archive with an actionable message instead of
shipping a broken or leaking artifact.

**Why now.** The redaction rule today is prose in the closure skill — exactly
the class of check that `docs/enforcement.md` says cannot be trusted to a
model's obedience. And a report with dangling evidence links is decoration, not
evidence: the reader cannot tell a broken link from a hidden one.

**Feasible.** One script, wired as a pre-archive step of `mugiwara archive`,
with a mutation in `gate-selftest.ts` proving it goes red — a gate that cannot
fail is not a gate.

_Pillar 1 · the cheapest trust upgrade on this list._

### 6. Executable rollback map — ✅ shipped

**Recovery you can run, not prose you must interpret.**

`mugiwara-ship` already requires a rollback plan; today it is a paragraph the
model writes. At closure, generate the exact commands from `state.json` instead
— branch, commit range, touched files — into
`.mugiwara/missions/<mission>/rollback.sh`, mirrored in the report. The human
runs it; mugiwara never does.

**Why now.** During an incident nobody should translate prose into git
commands. The data already sits in `state.json` — today it is thrown away for a
paragraph.

**Feasible.** Deterministic generation from existing fields. Honors the
no-auto-deploy constraint: mugiwara produces the plan, only a human executes
it.

_Pillar 1, 5._

---

## Mid — governance that holds when nobody is watching

### 7. Permission boundaries — ◐ scopes declared per persona + tier matrix documented; harness-native deny wiring is each team’s config

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

### 8. Tool-surface governance — ◐ Flow 0 inventory shipped (decision-log recorded); quarantine + invocation hashing deferred

**Audit what the agent can reach, not only what it wrote.**

Pre-mission MCP audit: provenance per server, tool inventory, capability drift
since last session. Minimum tool set computed from mission scope, with a warning
on over-scoped context. Output from a server that returned untrusted content is
quarantined and cannot drive routing until sanitised. Every invocation logged —
server, tool, input and output hash — into the evidence trail.

**Why now.** Tool surfaces are the fastest-growing attack path in agentic systems,
and the security skill already maps the Agentic OWASP Top 10 for diffs. This makes it
systematic rather than advisory.

_Pillar 1, 4 · governance that stops at the code is incomplete._

### 9. Long-running missions — ✅ shipped (staleness on continue + mugiwara handoff)

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

### 10. Signed attestation — ✅ shipped (optional minisign)

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

### 11. Adoption kit — ✅ shipped as docs/adoption.md recipe + exchange spec; template repos are downstream work

**Make the second mission as easy as the first.**

Template repositories per stack (next-auth+prisma, fastapi+sqlmodel, …) with mugiwara preinstalled and one worked example mission each; marketplace listings with screenshots of the trail; an anonymized, opt-in lessons-ledger exchange so one team's captured lesson ships to everyone.

**Why now.** The roadmap is all governance; nothing in it shortens the path from `npm install` to the first closed mission. Adoption is a workstream like verification — without it the trail has no audience.

_Pillar 5 · the trail needs readers._

---

## Standing constraints

- **No runtime, no daemon.** Orchestration stays in the harness. Anything needing
  a persistent process ships as a separate optional package, and core keeps
  working without it.
- **21 skills is the ceiling.** A new skill replaces an old one.
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
