# Writing rules

Every page under `docs/` is judged against these rules. `bun
scripts/validate-content.ts --check-writing` enforces the testable ones in CI.

1. One page answers one reader question. If it answers three, it is three
   pages — or two you do not need.
2. One table per page, maximum. Tables compare. Sentences explain.
3. Example first, rule second. People understand from a case, then read the
   principle.
4. Delete any paragraph that could be pasted into a competitor's docs
   unchanged. If it is not specific to mugiwara, it does not belong.
5. No em-dash as a connector. Full stop, or a comma. One em-dash per page at
   most.
6. Never open with a definition. Open with the problem the reader has.
7. Numbers come from `.metrics/latest.json`. Never hand-written.
8. Cut every "simply", "just", "seamlessly", "robust", "comprehensive",
   "leverage", "powerful".
9. Every command block is followed by its real output block. No invented
   output. Trim long output and mark the trim.
10. A page that duplicates another page's answer links instead of repeating.
11. Hook, prove, close. Every entry page opens with the reader's problem and
    its stakes, pairs each capability claim with a number, a command, or an
    output, and closes with exactly one call to action.
12. Take a stance. Name who the page is for and not for, state one trade-off.
    A page with no opinion reads as machine-written.
13. README span: about 120 to 150 lines, never over 1,800 words. Order: one
    sentence hook, banner, report sample, three-line install, one small first
    task ending in "open the report", lanes in four lines, short crew list,
    what is measured and what is not, when not to use it, links. Slash
    commands and JSON go in labeled `text` or `json` blocks, never `bash`.
    Reference tables (config, CLI, docs index) live in `docs/`, not in the
    README. The banner image is never cut.
14. No forced inline. One idea per line, newlines allowed, prose breathes.
    Density never trades away completeness.
15. Budget follows function. Entry pages persuade, reference pages complete,
    runbooks guide. Length serves the reader question named in the audit.
16. Long matrices fold, never cut. A matrix over 8 rows lives in a
    `<details>` block behind one summary line; the quickstart stays above
    the fold. Folding is presentation, cutting is loss.
17. Every shipped skill is named with its job on the crew page
    (`docs/concepts/crew.md`). A roster line that neither explains nor points
    is an undocumented feature; fix it in the same change that ships the skill.
18. Plain language. Internal jargon (slop, governor, posture, savepoint, heal,
    INV-ids, tier) is explained in a clause on first use or left out. Do not
    invent anecdotes. An illustration is labeled as one.
19. Platform claims match `src/targets/`. Say what installs today, and mark
    anything the code does not yet back as "in progress".
20. A page that moved leaves no stub behind. Update every link to it and run
    `bun scripts/check-doc-links.ts`.
