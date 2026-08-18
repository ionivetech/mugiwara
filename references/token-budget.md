# Token Budget

Warn and stop thresholds for mission token consumption.

## Budget by lane

The authoritative numbers are the `BUDGET_*` constants in
`scripts/lib/lane-base.sh`. This table used to carry its own figures (Lean
4,000 / Standard 10,000 / Full 20,000) that had drifted from the code by up to
2.5× — the code always won at runtime, so the doc was simply wrong. It now
restates the constants:

| Lane | Budget | Warn at (1.5×) | Stop at (3×) |
|------|:------:|:------:|:-----:|
| 0 Direct | 0 | — | — |
| 1 Lean | 12,000 | 18,000 | 36,000 |
| 2 Standard | 25,000 | 37,500 | 75,000 |
| 3 Full | 50,000 | 75,000 | 150,000 |
| 4 Spike | 3,000 | 4,500 | 9,000 |

If this table and `scripts/lib/lane-base.sh` disagree again, the shell file is
right. `bun run validate --check-doc-integrity` fails the build on drift.

## What it actually costs

Both the old table and the current constants sit below observed reality. One
measured brainstorm subagent in this repo burned **117,809 tokens** on its own
— more than twice the Full-lane budget, in a single dispatch. Treat the budget
as a warning line for the main thread's own accounting, not as a cap on what a
mission consumes: subagent dispatch is the dominant cost and it is not
subtracted from these figures.

## Mechanism

On Claude Code a Stop hook writes savepoints automatically at turn end; the crew's explicit call marks the wave boundary.

`mugiwara savepoint` writes `tokens_est` to `.mugiwara/state/<mission>/[member].json` when a
`MUGIWARA_TOKENS` env var is set (the harness should export estimated tokens
consumed so far).

Warn: log to decision log. Stop: write state, report to user, pause mission.

## Per-mission cost tracking

At closure, `mugiwara run mission-report.sh` surfaces tokens vs. budget in the
mission report. Trend across missions: `logs/lessons.md` carries token data
per mission for the memory keeper to surface cost trends.

```markdown
| Mission | Lane | Tokens | Budget | % |
|---------|------|--------|--------|---|
| 2026-08-10-dark-mode | standard | 8,200 | 10,000 | 82% |
| 2026-08-11-invitation | full | 18,500 | 20,000 | 93% |
```
