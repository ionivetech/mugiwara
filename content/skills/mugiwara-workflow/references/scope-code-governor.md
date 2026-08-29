# Scope & Code Governor

Prefer the smallest correct scope — reuse existing code + local modification
over new architecture (§14). An abstraction is justified only when used in ≥2
places or required by contract, never speculatively (§15); a dependency is
added only with explicit justification (§16); implementations are minimum
sufficient, never minimum LOC at the expense of verification/quality
(§15/§38).

Code waste (unnecessary helper/abstraction/wrapper/interface/config/
dependency/generated code/refactor) is named; the change surface is measured;
every scope verdict lands as a `scope-governor` trail row in
`.mugiwara/missions/<mission>/decisions.md` → `## Cost governor decisions`.
savepoint/lane-base/config untouched.
