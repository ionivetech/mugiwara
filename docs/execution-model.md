# Execution Model

Why the crew runs in your main conversation — and when subagents are actually
used.

## Auto-activation

The workflow **auto-activates.** At session start the crew is announced; when
you give a non-trivial request, the pipeline runs by itself — you do not need
to call `/using-mugiwara`. It remains an optional explicit router if you want
to hand-route a mission.

## Inline by default

The crew runs **inline**. The main thread embodies each crew role using that
member's skill, so every wave plays out in your main conversation and you watch
it happen:

- Luffy's triage, Nami's planning, Zoro's execution, Chopper's audit, Sanji's
  quality, Franky's gates, Robin/Jinbe's review, Brook's healing, Luffy's
  closure — all performed in the main thread.
- Evidence is written to `.mugiwara/` files; the conversation carries terse
  verdicts and evidence pointers.

## When subagents ARE used

Subagents exist to parallelize, never to hide work:

1. **`[PARALLEL]` task batches** — independent tasks that touch no shared files
   or interfaces run concurrently, one per worker subagent. This is the only
   place Zoro delegates.
2. **Parallel fixes** — Brook spawns workers for independent heal fixes.
3. **Background / long-running checks** — work that would stall the
   conversation.
4. **Check subagents** — Chopper, Robin, and Jinbe may spawn subagents for
   independent re-runs or diff passes.

Worker results return as reports; the main thread summarizes them inline with
evidence pointers.

## Why not dispatch every wave to a subagent?

Every harness — Claude Code, opencode, Codex, Cursor, Gemini — hides subagent
internals behind a click or a side panel. If each wave ran as a subagent, you'd
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

You see progress as **checkpoint reports**, not a firehose: a wave banner
(`## Wave N — <crew> (<skill>)`), one compact report per crew member at each
stage boundary (what ran / result / evidence pointer), a progress summary per
wave, and a pause when something fails or gets risky. Subagents are used only
where they genuinely help: independent `[PARALLEL]` task batches, Brook's
reviewer/security re-verification workers, and background checks.

## Manual stages

Prefer to drive the stages yourself? Every stage has a slash command that loads
the skill, runs the crew role inline, and bridges state from `.mugiwara/`:

| Command | Runs | Reads state from |
|---------|------|------------------|
| `/mugiwara-plan` | Nami | `.mugiwara/spec/` |
| `/mugiwara-execute` | Zoro | `.mugiwara/plans/` |
| `/mugiwara-review` | Robin | `.mugiwara/results/` + diff |
| `/mugiwara-security` | Jinbe | `.mugiwara/results/` + diff |
| `/mugiwara-heal` | Brook | `.mugiwara/issues/` |
| `/mugiwara-ship` | Luffy | plan + results |

You can jump into any stage — e.g. run `/mugiwara-plan` first, then
`/mugiwara-execute` later when you're ready.

## Trade-off

Inline execution grows the main-thread context over a long mission. The crew
mitigates this: evidence goes to `.mugiwara/` files, reports are terse, and
subagents isolate the genuinely heavy parallel work. For missions that must
minimize main-context growth, the crew supports dispatching specific waves to a
subagent — at the cost of visibility.
