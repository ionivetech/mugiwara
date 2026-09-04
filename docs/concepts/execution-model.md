# Execution Model

Work inside subagents is invisible — claims come back without evidence and
failures hide where no one looks. The crew runs inline by default so every
flow stage plays out where you can see it, with subagents only for genuinely
parallel work. Why the crew runs in your main conversation — and when
subagents are actually used.

## Three independent decisions

Every mission makes three independent choices. They must not be conflated:

| Dimension | Question | Values | Never implies |
|---|---|---|---|
| **Control mode** | How much does the human participate? | `guided` / `semi` / `auto` | a topology, cost tier, or risk tier. |
| **Execution model (posture)** | How is work performed? | `inline-sequential`, `inline-batched`, `parallel-workers`, `context-relief`, `phase-isolated`, `team-scoped` | a control mode or cost level. |
| **Cost Governor** | What is economically justified and safe to spend? | reserve / project / avoid / stop verdicts | a mode change or a crew-role change. |

A Full-lane mission may be Guided and fully inline; a Lean mission may be Auto
and sequential. The governor supplies measurable verdicts the workflow acts on —
it recommends and records, it does not force.

## Postures

- **inline-sequential** — default: main-thread execution in plan order.
- **inline-batched** — several read-only checks batched into one compact report.
- **parallel-workers** — Nami-declared independent tasks run via worker
  subagents; main thread remains owner.
- **context-relief** — context pressure crosses threshold; one worker at a time,
  preserving plan order.
- **phase-isolated** — large campaign; `sub-plan/` + `flows/phase-NN/`.
- **team-scoped** — `(mission, member)` isolation with shared-plan boundaries.

Posture is chosen and recorded by Luffy at flow boundaries from mission
evidence, lane, risk, dependency topology, context pressure, and governor
verdicts. It adapts as evidence changes; control mode does not (except an
explicit user flip).

## Auto-activation

The workflow **auto-activates.** At session start the crew is announced; when
you give any request, `mugiwara-orchestration` loads as gatekeeper — you do not
need to call any command. Lane 0 (single-file/<20 LOC) skips the pipeline and
executes directly.

## Inline by default

The crew runs **inline**. The main thread embodies each crew role using that
member's skill, so every flow stage plays out in your main conversation and you watch
it happen:

- Luffy's triage, Nami's planning, Zoro's execution, Chopper's audit, Sanji's
  quality, Franky's gates, Robin/Jinbe's review, Brook's healing, Luffy's
  closure — all performed in the main thread.
- Evidence is written to `.mugiwara/` files; the conversation carries terse
  verdicts and evidence pointers.

## When subagents ARE used

Subagents exist to parallelize, never to hide work:

1. **`[PARALLEL]` task batches** — independent tasks that touch no shared files
   or interfaces run concurrently, one per worker subagent. This is the primary
   place Zoro delegates.
2. **Parallel fixes** — Brook spawns workers for independent heal fixes.
3. **Background / long-running checks** — work that would stall the
   conversation.
4. **Check subagents** — Chopper, Robin, and Jinbe may spawn subagents for
   independent re-runs or diff passes.
5. **Context pressure** — when the `tokens_est` estimate exceeds 60% of `budget`
   mid-execution, remaining sequential tasks dispatch to workers one at a time,
   in plan order. Order is preserved; only the context resets.

Worker results return as reports; the main thread summarizes them inline with
evidence pointers.

> **Delegated work is not hidden work.** A worker may run out of view; its
> result may not. Every worker returns a flow stage banner, a one-line verdict, and an
> evidence path into the main thread. The user never clicks into a subagent to
> know what happened. Isolation is for context and permission, never for
> autonomy.

## Why not dispatch every flow stage to a subagent?

Every harness — Claude Code, opencode, Codex, Cursor, Gemini — hides subagent
internals behind a click or a side panel. If each flow stage ran as a subagent, you'd
be clicking through the whole mission to see what happened. Running the crew in
the main conversation is the only way the process is genuinely visible.

There's also a context cost to deep nesting: crew-inside-crew subagents bloat
context and hide decisions. Inline keeps the user in the loop and the story
linear.

## Rules that keep it sane

- Crew members never dispatch another crew member. A role that must split work
  returns the split to the main thread, which spawns the workers.
- Escalation = "blocked" + ledger row returned to the main thread.
- Sequential work never takes a subagent round-trip — no skipping, no hidden
  reordering, plan order is plan order.

## Checkpoint reports

You see progress as **checkpoint reports**, not a firehose: a flow stage banner
(`## ⚔️ Flow 3 — Zoro (Execution)`, never ANSI escapes), one compact report per crew member at each
stage boundary (what ran / result / evidence pointer), a progress summary per
flow stage, and a pause when something fails or gets risky. Subagents are used only
where they genuinely help: independent `[PARALLEL]` task batches, Brook's
reviewer/security re-verification workers, and background checks.

## Manual stages

Prefer to drive part of the pipeline yourself? A few stages have slash
commands that load the skill, run the crew role inline, and bridge state from
`.mugiwara/`:

| Command | Runs | Reads state from |
|---------|------|------------------|
| `/mugiwara-review` | Robin | `.mugiwara/missions/<mission>/flows/` + diff |
| `/mugiwara-security` | Jinbe | `.mugiwara/missions/<mission>/flows/` + diff |
| `/mugiwara-continue` | Resume coordinator | `.mugiwara/missions/<mission>/continue*.json` |

The other flow stages (plan, execute, heal, ship) are driven by the pipeline
itself — Luffy routes to them at the stage boundary. Ask in plain language and
the owning crew member loads its skill.

## Trade-off

Inline execution grows the main-thread context over a long mission. The crew
mitigates this: evidence goes to `.mugiwara/` files, reports are terse, and
subagents isolate the genuinely heavy parallel work. For missions that must
minimize main-context growth, the crew supports dispatching specific flow stages to a
subagent — at the cost of visibility.
