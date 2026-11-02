# Order checklist

Order: 1 formatter through 12 waste pass. Judge steps 3 to 7 on the change (delta) unless the project's config sets an absolute threshold.

1. Formatter: the project's formatter, exit status captured.
2. Linter: resolve all errors properly. Never disable rules, downgrade severity, or add ignore comments to pass. Use the repo's own rules; do not add new ones.
3. Complexity, per changed function, both metrics:
   - Cyclomatic (McCabe): 1 plus decision points; flag above 10, major above 20. When ESLint drives the repo, run its `complexity` rule at max 10 (https://eslint.org/docs/latest/rules/complexity).
   - Cognitive: nesting-weighted; flag above 15, major above 25. Where a cognitive-complexity plugin or SonarJS metrics exist, read them directly and record the measured value.
   Method and thresholds: `_shared/references/complexity.md`. A scanner result outranks manual counting. This is the only stage that measures complexity.
4. Duplication: scan changed files for near-identical blocks of 10 lines or more. `duplicated_lines_density` = duplicated lines / total lines, as a percentage. Flag any changed file at 3% or more. When the repo ships a scanner (SonarScanner, jscpd, Simian), read its density directly.
5. File health: changed files at most 300 lines, functions at most 30 lines. Flag what the change pushed over; a file already over the limit is judged by what the change added.
6. Maintainability rating: sum remediation effort (estimated minutes per issue severity) into technical debt and divide by code size for the debt ratio. Map to the Sonar A to E scale: A up to 5%, B under 10%, C under 20%, D under 50%, E 50% and above. C or worse fails the stage.
7. Code attributes (quantitative): consistency (formatting drift count, naming violations), intentionality (dead code share, unreachable branches), adaptability (files with more than one responsibility). Metrics only; Robin does the qualitative review.
8. Unit tests: the full suite, output captured. A failing suite fails the stage; never assert green.
9. User-declared test suites (per `references/testcases.md`): run under the consent matrix in the skill.
10. Integration tests: never created by the crew. When user tests are declared and state-mutating, follow the consent matrix.
11. Optional e2e gate: only when repo e2e setup and matching changed files both hold; consent by mode.
12. Waste pass: run `mugiwara waste [--mission <id>]` over the mission diff and record its rows. Advisory only: it does not block or fail the stage. With no CLI available, say so in the report. Rows go under `## Waste (advisory)` in the quality report; each is acted on in this stage or carried into the closing report's deferred list with a reason.
