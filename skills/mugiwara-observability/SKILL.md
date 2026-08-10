---
name: mugiwara-observability
description: Use when instrumenting, tracing, or debugging how the mugiwara crew ran a mission - structured logs, OTel-compatible trace spans per wave/agent/tool, session correlation, and reading the traces to find where time and errors went.
---

# Observability (Trace the Crew)

Make every mission replayable: one trace file, one line per dispatch, so you can see who ran what, how long, and where it failed.

## Trace log

Per mission, maintain `.mugiwara/results/YYYY-MM-DD-<mission>-trace.md` (fall back to the repo's log convention if `.mugiwara/` is absent). Append one entry per wave and per agent dispatch:

- `event`: wave | agent | tool called | start/end time | duration ms | outcome (pass/fail/blocked) | evidence pointer | error excerpt.

## Structured log lines

Each event is one parseable line, ISO timestamps, no PII:

```
2026-08-10T09:14:02Z [wave:3][agent:zoro][tool:subagent][ms:1240][ok] task-2.1 helper theme
2026-08-10T09:16:40Z [wave:3][agent:brook][tool:test][ms:9800][fail] e2e auth regressed — see .mugiwara/issues/2026-08-10-mission-blockers.md:7
```

Always include outcome; an event without an outcome is noise, not a trace.

## OTel-aware enrichment

If the host agent supports OTel GenAI spans, map each entry: `gen_ai.agent.*` for dispatches, `gen_ai.tool.*` for tool calls, span duration = entry duration; propagate trace context (`traceparent`) via MCP `_meta` when the tool is an MCP server. Recommend Langfuse or LangSmith as the viewer for spans/agent graphs. The FILE trace stays the source of truth — OTel is optional enrichment, never a replacement.

## Session correlation

Every entry carries the mission id `YYYY-MM-DD-<mission>` (same name as the plan doc). The id threads through trace, blockers ledger, and results so a full run can be replayed even after context compaction — grep the id across `.mugiwara/` to reconstruct the whole mission.

## Reading traces to debug

- Time: sort spans by duration — the longest spans are the wave/agent/tool to fix or parallelize.
- Errors: cluster `fail`/`blocked` entries by agent/task — repeated failure at one spot is a plan or skill bug, not a one-off.
- Utilization: which agents ran vs. never dispatched (over/under-use), heal-loop cost = sum of `[heal]` wave spans.
- Fix the plan/skill, not the symptom: the trace tells you where, the plan tells you why.

## End-of-mission summary

Close the trace file with a mini report: total duration, waves run, agents used, failures, heal cycles, longest span. This is the closure evidence for the ship gate.

## Red flags

- Events without timestamps, duration, or outcome.
- Entries missing the mission id.
- PII in log lines.
- Trace file absent at closure while waves ran.
- Heal cycles with no trace of which failure they retried.

All mean: the run is not reconstructable. Stop and record before moving on.
