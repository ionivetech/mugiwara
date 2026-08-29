# Adaptive Budget & Circuit Breaker (Phase 7)

Reserve expected max before expensive stages (Review/Security/Healing); continuously project `current + remaining required + expected conditional + possible healing` (§26); expand budget only with evidence (§27 valid: scope legitimately expanded, security-sensitive path, test surface larger, architecture dependency, legitimate healing; invalid: verbosity/reread/repeat/unnecessary code); respect progressive thresholds (§28: 60%→optimize, 75%→aggressive, 90%→protect, 100%→pause, 150%→warning, 300%→stop); trip breaker when `actual ≥ 2× expected` without progress/scope/evidence (§29, note: double-threshold); flag 5k-zero-progress anomaly (§24, re-consumes slop signal); record every non-ok verdict via `recordBudgetDecision` (§41).

Honest boundary: verdicts-not-enforcement; crew acts. No new config; savepoint/lane-base untouched. Report/CLI budget ledger → Phase 8.
