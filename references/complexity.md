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

## Cognitive complexity (secondary)

Cyclomatic is the gate; cognitive complexity (nesting depth) supplements it.
Flag functions nested >4 levels deep even when cyclomatic is low — deep
nesting is a readability problem a branch count misses.

## Tooling

Manual counting is the baseline and works for any language. When the repo has
ESLint (`complexity` rule), SonarScanner, or similar, prefer the tool's output
as evidence — the tool is the source of truth, manual counting is the
fallback. Never weaken a tool's threshold to make a function pass.