# Verdict file format

`.mugiwara/results/<mission>/07-pr-verdict.md` — ONE document that IS the
ready PR material (the user copies the title line and the body as-is). No
separate report section plus a PR-body copy: one flow, in this exact order:

1. **Title** — `# {type}: {Title Case summary}` — mandatory Title case, e.g.
   `# Feat: Add Evidence Links To Mugiwara Reports`.
2. **Summary** — goal, mode, waves, task count, branch/stacking note,
   closure report link (`[06-closure.md](.mugiwara/results/<mission>/06-closure.md)`);
   then the mission's key points as compact bullets (what each defect/feature
   does — never a file list).
3. **What changed** — ONE compact paragraph, file inventory only: `<N> files:
   <comma-separated paths>, <grouped counts>, docs (dir or file list), README.`
   Feature detail lives in Summary, not here.
4. **Per-wave evidence** — wave, task, status, evidence link
   (`[path](relative/path)`). Gates, review, security, and heal rows live here
   with their dispositions.
5. **Tests** — captured test counts (never asserted); the ATDD oracle result
   when user tests were declared (per `mugiwara-testcases`).
6. **Checks** — one `- [x]` checkbox bullet per gate: typecheck, tests
   (`N/N`), build, content/manifest/doc-integrity, lane-base, npm pack,
   evals + retrieval, verify-install (`N/N` pointers), gate-selftest
   (`N/N` mutations prove red).
7. **Verdict** — PASS / FAIL with the single blocking reason, if any.

The file IS the PR summary. No second block: the user pastes the file — title
line into the PR title, the rest into the body. Order mirrors the verdict file
(title → summary → what changed → per-wave evidence → tests → checks →
verdict). Validate every interpolated value against the safe charset and quote
it.
