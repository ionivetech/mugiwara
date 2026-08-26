# Cyclomatic complexity — measurement method

McCabe cyclomatic complexity: `CC = 1 + decision points` in a function. The
gate for "is this function too complex" — measured, not eyeballed.

## Decision points (count each occurrence)

| Construct | Counts? |
|-----------|---------|
| `if` | yes |
| `else if` | yes (each one) |
| `else` | no |
| `for`, `while`, `do-while` | yes (each loop) |
| `case` | yes (each label) |
| `catch` | yes (each handler) |
| `&&`, `\|\|`, `??` | yes (each occurrence) |
| ternary `?:` | yes |
| `?.` optional chaining | no (does not branch) |
| `switch` itself | no (its `case`s count) |

## Thresholds

| CC | Verdict |
|----|---------|
| 1–10 | clean |
| 11–20 | flag — review for extraction; minor/major by context |
| >20 | major finding — must split the function |

Thresholds are language-typical; a repo with an explicit complexity gate
(ESLint `complexity` rule, SonarScanner) overrides these — the repo's tool is
the source of truth.

## Evidence format

Every flagged function lists its counted branches — a number without the
branch table is an unproven claim:

```
path:line:functionName — CC 14 (threshold 10)
  branches: if x2, for x1, && x3, case x4, catch x1, ternary x3
```

## Cognitive complexity — understandability (Sonar)

Measures how hard a function is to READ, not how many paths it has. Nesting
is penalized: a construct nested inside another adds its increment plus a
nesting increment, so a three-level guard ladder outscores an eight-branch
flat chain that has higher cyclomatic. The two metrics catch different
functions — report both, flag on either.

Count per function: +1 for every flow break (`if`, `else if`, `else`,
`for`, `while`, `do`, `case`, `catch`, ternary, each `&&`/`||`/`??` beyond
the first in its chain), plus +1 per nesting level entered for structures
nested inside another flow-break structure. Sequences and flattenable
patterns (`else if` chains, top-level `&&`) stay cheap — that is the point.

| Cognitive | Verdict |
|-----------|---------|
| ≤15 | clean |
| 16–25 | flag — flatten nesting or extract; minor/major by context |
| >25 | major finding — restructure before merge |

Evidence format mirrors cyclomatic: `path:line:functionName — COG 18
(threshold 15)` plus the nesting sketch that produced it. A number without
the sketch is an unproven claim.

Tooling first: ESLint SonarJS `sonarjs/cognitive-complexity` (default max
15), SonarScanner's `cognitive_complexity` metric, or the language's
equivalent. The repo's tool is the source of truth; manual counting is the
fallback. Never weaken a tool's threshold to make a function pass.

## Tooling

Manual counting is the baseline and works for any language. When the repo has
ESLint (`complexity` rule), SonarScanner, or similar, prefer the tool's output
as evidence — the tool is the source of truth, manual counting is the
fallback. Never weaken a tool's threshold to make a function pass.