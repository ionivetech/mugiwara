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
13. README span: 1,200 to 1,800 words. Required sections: hook, banner,
    problem, report sample, lane table, install matrix, quickstart, feature
    tour, when-not-to-use, measured, CTA, links. Banner image and install
    matrix are never cut.
14. No forced inline. One idea per line, newlines allowed, prose breathes.
    Density never trades away completeness.
15. Budget follows function. Entry pages persuade, reference pages complete,
    runbooks guide. Length serves the reader question named in the audit.
16. Long matrices fold, never cut. A matrix over 8 rows lives in a
    `<details>` block behind one summary line; the quickstart stays above
    the fold. Folding is presentation, cutting is loss.
17. Every shipped skill owns a features section. A roster line naming a
    skill without a Problem/What/Proof section is an undocumented feature;
    add the section in the same change that ships the skill.
