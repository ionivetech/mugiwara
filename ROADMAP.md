# Roadmap

The governance foundation (Phases 1-3) is complete. What follows
strengthens the thesis: governance that is enforced, not optional.

## Phase 4 — CI/CD: governance enforced

Today mugiwara runs in your chat window. Tomorrow it gates your PRs.

| Feature | Description |
|---------|------------|
| **CI check mode** | `mugiwara ci --pr <url>` — Luffy triages PR diff, Chopper audits, Sanji runs quality, Franky gates coverage, Robin reviews, Jinbe runs security, Brook heals. Posts findings as PR comments. |
| **Required check** | Mugiwara as a required CI step. Coverage + DoD + security must PASS before merge. Governance becomes a merge gate, not a suggestion. |
| **Robin PR review** | Severity-tagged review comments posted on PR. Developer can reply "fixed" or "won't fix" → Robin re-evaluates. Conversation trail becomes part of the audit. |
| **Gate status badge** | `![gates](https://img.shields.io/.../gates-passing)` in README. Shows last mission gate status. Team sees governance health at a glance. |
| **Per-repo compliance score** | From `state.json` history. Gate pass rate, heal cycles/mission, evidence completeness. A single number: "Compliance: 94/100." |

Why this matters: the thesis says mugiwara is a governance layer. Governance
that is optional is not governance. CI integration makes it enforced.

## Phase 5 — agent isolation: personas with teeth

Today agents are embodied inline by the main thread. This works but the model
can forget its role. Isolation makes boundaries real.

| Feature | Description |
|---------|------------|
| **Real subagent dispatch** | On Tier 1 harnesses, crew members dispatch as actual subagents with isolated context. Chopper spawns with read-only file scope — system-enforced, not prose. Zoro spawns per task with no-network. |
| **Scoped tool sets** | Each agent gets only the tools it needs. Chopper: file-read + shell-run. No file-write. Robin: file-read + grep. No shell. Brook: file-read + file-write. No network. |
| **Agent-to-agent handoff** | Zoro completes Wave 3 → hands state.json to Chopper subagent → Chopper audits → hands to Sanji. No main-thread bottleneck. Clean context per wave. |
| **Subagent token tracking** | Tokens per subagent tracked separately. Mission report shows breakdown: "Zoro 8.2k, Chopper 3.1k, Brook 1.5k." |

Why this matters: an auditor that can edit code is not an auditor. System-level
permission boundaries are stronger than prose rules.

## Phase 6 — memory: governance that learns

Today lessons are appended to a flat markdown file. Tomorrow they become
searchable knowledge that makes every mission smarter than the last.

| Feature | Description |
|---------|------------|
| **RAG lessons** | Semantic search over `logs/lessons.md`. At Wave 0: "have we done auth middleware before?" → retrieves relevant past missions, their outcomes, and what went wrong. |
| **Pattern extraction** | Heal cycles that repeat become patterns. "3 of the last 5 heals were race conditions in token checks" → Nami auto-adds concurrency tests to the plan. |
| **Source-grounding cache** | Framework docs cached per version. Express 4.21 API reference fetched once, reused across missions. Reduces repeat fetches 70%. Version-aware — caches invalidate on dep bump. |
| **Repo convention primer** | At session start, inject 200 tokens: last mission outcome, active branch, most-used patterns in this repo. Not a full scan — a primer. |

Why this matters: a governance layer that makes the same mistakes twice is not
governing. Memory turns every mission into training data for the next.

## Phase 7 — multi-model: governance that adapts

Different models behave differently. Mugiwara should know this and adjust —
then publish the differences so users can choose.

| Feature | Description |
|---------|------------|
| **Model-aware skill tuning** | Gemini tier 2 skips evidence checks 35% of the time. Skill body auto-injects: "YOU MUST RUN THE COMMAND NOW. DO NOT SKIP." Claude tier 1 doesn't need this. |
| **Evidence enforcement level** | Configurable per model: `evidence_strict=claude` (trust model) / `evidence_strict=gemini` (double-check). Skill body adapts. |
| **Compliance matrix auto-update** | Every mission writes model behavior to state.json. Matrix becomes data-driven — "Gemini heal loop holds 62% this month, down from 65%." |
| **Model recommendation** | Based on compliance data: "Lane 3 missions: Claude passes gates 94%, Gemini 71%. Consider switching for this mission." |

Why this matters: the compliance matrix already publishes failures. Making it
data-driven and actionable turns transparency into a decision tool.

## Phase 8 — MCP: trust surface governance

MCP servers are the fastest-growing attack surface. Mugiwara's agent-security
skill already covers this — this phase makes it systematic.

| Feature | Description |
|---------|------------|
| **Pre-mission MCP audit** | Before Wave 0, scan all connected MCP servers. Report: provenance, tool list, capability drift since last session, risk score per server. |
| **Tool-scope compute** | Based on mission scope, compute minimum required tool set. Warn on over-scoped context: "This mission needs file-read + shell. You have 12 MCP tools connected." |
| **MCP-context quarantine** | A tool that returned untrusted content → its output is quarantined. Agent cannot route based on that output until sanitized. |
| **MCP audit trail** | Every MCP tool invocation logged: timestamp, server, tool, input hash, output hash. Part of the mission evidence trail. |

Why this matters: MCP is growing faster than its security model. Governance that
doesn't cover the tool surface is incomplete governance.

## Phase 9 — dashboard: governance visible

The mission report exists but lives in `.mugiwara/reports/`. A team lead should
see governance health without opening hidden files.

| Feature | Description |
|---------|------------|
| **Web dashboard** | `.mugiwara/reports/` → HTML timeline. Filter by engineer, lane, date, repo. Gate pass rate over time. Evidence completeness score. |
| **Engineer insights** | Per-engineer: lane distribution, heal cycle frequency, token/week trend. "Farid uses Lane 3 60% of the time. Average heal cycles: 1.2." |
| **Team governance score** | Single number: "Team governance: 87/100." Gate pass rate + evidence score + heal efficiency + compliance matrix stats. |
| **Alerting** | "Brook healed the same failure 3 times this week." "Coverage dropped below threshold for 2 consecutive missions." |

Why this matters: governance nobody can see is not governance. The dashboard
makes the thesis visible to the people who approve the budget.

---

## Explicitly not planned

- **Runtime / daemon.** Orchestration stays in the harness.
- **Auto-merge / auto-deploy.** Human review at the PR is the terminal gate.
- **Skill count growth.** 26 is the ceiling. A new skill replaces an old one.
- **Unattended-marathon mode.** Visibility over autonomy.
- **MCP server exposure.** Mugiwara does not become an MCP server — stays pure markdown.
- **Head-to-head scorecards.** Compliance matrix replaces them.
