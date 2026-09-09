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
