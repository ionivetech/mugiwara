# Stop-Slop Governor

Slop taxonomy (§21 eight kinds); detection signals (§22: repeated reads/commands,
token-without-evidence, LOC-without-acceptance, abstraction-without-justification);
progress measurement (§23: evidence/criteria/tests/code vs cost delta, slop when
cost grows without progress); work-to-cost anomaly (§24 drop signal); intervention
rules (§20 tolerate/stop/compress/escalate by severity); six category detectors
(retry §21.6/§31 same-action-same-evidence-same-failure→STOP, healing §21.7/§32
no-progress→stop, scope §21.8 out-of-scope-without-acceptance→reject, context
§21.2 duplicate/irrelevant→discard/compress, investigation §21.1 unbounded-
exploration→stop, code §21.5 unnecessary abstraction/dependency/boilerplate→
remove/simplify). Every slop verdict lands as a `slop-governor` trail row in
`.mugiwara/missions/<mission>/decisions.md` → `## Cost governor decisions`.
savepoint/lane-base/config untouched.
