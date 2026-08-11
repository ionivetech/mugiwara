# Token Budget

Warn and stop thresholds for mission token consumption.

## Budget by lane

| Lane | Budget | Warn at (1.5×) | Stop at (3×) |
|------|:------:|:------:|:-----:|
| 0 Direct | 0 | — | — |
| 1 Lean | 4,000 | 6,000 | 12,000 |
| 2 Standard | 10,000 | 15,000 | 30,000 |
| 3 Full | 20,000 | 30,000 | 60,000 |
| 4 Spike | 3,000 | 5,000 | 9,000 |

## Mechanism

`scripts/savepoint.sh` writes `tokens_est` to `.mugiwara/state.json` when a
`MUGIWARA_TOKENS` env var is set (the harness should export estimated tokens
consumed so far).

Warn: log to decision log. Stop: write state, report to user, pause mission.

## Per-mission cost tracking

At closure, `scripts/mission-report.sh` surfaces tokens vs. budget in the
mission report. Trend across missions: `logs/lessons.md` carries token data
per mission for the memory keeper to surface cost trends.

```markdown
| Mission | Lane | Tokens | Budget | % |
|---------|------|--------|--------|---|
| 2026-08-10-dark-mode | standard | 8,200 | 10,000 | 82% |
| 2026-08-11-invitation | full | 18,500 | 20,000 | 93% |
```
