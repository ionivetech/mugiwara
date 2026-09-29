# Order Checklist

Order: 1. Formatter ... 12. Waste pass

1. Formatter — the project's formatter, exit status captured.
2. Linter — resolve all errors properly. Never disable rules, downgrade severity, or add ignore comments to pass. Use the repo's own rules; do not add new ones.
3. Complexity — per changed function, both metrics:
   - Cyclomatic (McCabe): 1 + decision points; flag >10, major >20. When ESLint drives the repo, run its `complexity` rule at max 10 — docs: https://eslint.org/docs/latest/rules/complexity.
   - Cognitive: nesting-weighted; flag >15, major >25. Where an ESLint `cognitive-complexity` plugin or SonarJS/SonarScanner metrics exist, read them directly; record the measured value.
   Method + thresholds: `_shared/references/complexity.md`. # note: manual counting is the baseline; a scanner result outranks it.
4. Duplication — scan changed files for near-identical blocks ≥10 lines. Compute `duplicated_lines_density` % = duplicated lines / total lines. Flag any file ≥3%. When the repo ships a scanner (SonarScanner, jscpd, Simian), read its density directly.
5. File health — changed files ≤300 LOC, functions ≤30 LOC. Flag exceeded. Thresholds fixed; do not inflate.
6. Maintainability rating — sum remediation effort (estimated minutes per issue severity) into technical debt; divide by code size for debt ratio. Map A-E per Sonar scale: A ≤5%, B <10%, C <20%, D <50%, E ≥50%. C or worse fails the gate.
7. Code attributes (quantitative) — consistency (formatting drift count, naming convention violations), intentionality (dead code %, unreachable branches count), adaptability (files with >1 responsibility). Metrics only — Robin does qualitative deep review in Flow 7.
8. Unit tests — full suite, capture output. A failing suite fails the stage; never assert green.
9. User-declared test suites (per `mugiwara-testcases`) — run under the consent matrix below.
10. Integration tests — never created by us; when user tests are declared and state-mutating, see the consent matrix.
11. Optional e2e gate — only when BOTH repo e2e setup AND changed-file e2e patterns hold, consent by mode, see below.
12. Waste pass — run `mugiwara waste [--mission <id>]` over the mission diff and record its rows. **Advisory: it never blocks and never fails the stage.** It is the cost governor's only automated read on the diff, and a detector nobody runs is a detector that does not exist. No CLI on this rung of the ladder → say so in the report rather than skipping silently. Rows go under `## Waste (advisory)` in the quality report; each row is either acted on in this stage or carried into the closure report's deferred list with a reason. Trail row `slop-governor`.
