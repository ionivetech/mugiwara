# Security Audit — Phase 1 Cost Governor

Auditor: Jinbe (mugiwara-security)
Diff: `a1136a7..HEAD` on `feat/native-cost-governor`
Scope: `src/cost.ts`, `src/mission.ts`, `test/cost.test.ts`, `test/closure-integration.test.ts`
Mode: read-only. No code changed.

## Verdict: PASS (no Critical/High)

Readiness: **Ready**. All findings Low or Nit. None blocks merge. Hotspots review rating A (100% reviewed), SCA rating A (no new dependencies added).

---

## 1. Threat model FIRST (STRIDE)

### Surfaces (trust boundaries)

| # | Surface | Data crossing | Trust level |
|---|---------|--------------|-------------|
| S1 | CLI `archiveMission(projectDir, mission)` | `mission` name from user/CLI | low (user) → local fs |
| S2 | `appendCostEvent(missionDir, event)` JSONL write | mission, tokens_est, budget, status, context_chars | local fs write |
| S3 | `recordOptDecision(missionDir, d)` decisions.md write | actor, decision, reason, evidence | local fs write |
| S4 | report.md fold (cost-events.jsonl + costSection) | JSONL body embedded into markdown | local fs → rendered output |
| S5 | state.json read (`primaryState`) | tokens_est, lane, tokens_source | local fs read |

Every surface has a row. No modeling gap.

### STRIDE per surface

| Surface | Spoofing | Tampering | Repudiation | Info disclosure | DoS | Elevation |
|---------|----------|-----------|-------------|-----------------|-----|-----------|
| S1 | n/a — no identity | n/a | n/a | n/a | n/a | **mission allowlist blocks traversal** (safe) |
| S2 | n/a | JSONL append-only; content trusted (local) | ts field adds traceability (improves) | tokens_est only, no secrets | one write/closure, bounded | mkdirSync+append under validated dir (safe) |
| S3 | actor field free-form (future) | markdown bullet raw-interpolated (Low, not reachable) | actor+ts traceable | evidence field could hold text | readFileSync reads whole file (future) | arbitrary missionDir param (Low, not reachable) |
| S4 | n/a | raw JSONL folded into report (Nit, cosmetic) | n/a | only token/budget numbers | n/a | n/a |
| S5 | n/a | JSON.parse catches corrupt state (existing) | n/a | existing behavior | n/a | n/a |

### Cross-cutting blast radius
All writes land under `.mugiwara/missions/<mission>/` — the mission's own directory, which the same local actor already fully controls. No new trust boundary is crossed. The closure event folds into `report.md`, which already carried `tokens_est` via the pre-existing Cost section. No previously-internal data made newly reachable.

---

## 2. Checklist

### 1. Secrets — PASS
No hardcoded keys/tokens/passwords, no `.env`, no new logging. `appendCostEvent` writes only numeric cost primitives (`tokens_est`, `budget`, `status`, `context_chars`) + mission name. `tokens_source` (provider label) is deliberately NOT written into the event — good. The existing costSection already reported `tokens_est` to report.md before this diff; no new exposure.

### 2. Injection — PASS (with Low design note)
- **Path traversal** (S1/S2): `mission` validated by allowlist at archiveMission line 113:
  `/[^a-zA-Z0-9._-]/` rejects `/`, `\`, space, control chars. `/^\.+$/` rejects `"."`, `".."`, `"..."` which would resolve upward through `join(root,'missions',mission)`. Only safe single-segment names reach `dir`. Cannot escape `.mugiwara/missions/`. **Safe.**
- **JSONL integrity** (S2): event built via `JSON.stringify(line)+'\n'` — newlines/control chars in `mission` escaped, one record per line guaranteed. A crafted mission can't break the JSONL framing. **Safe.**
- **Markdown** (S4): cost-events.jsonl folded raw into report.md under `## Archived:` header. It is JSON text; markdown does not execute in this context. Cosmetic only. **Safe.**
- **recordOptDecision** (S3): `actor`, `decision`, `reason`, `evidence` interpolated raw into a markdown bullet with no escaping. A newline in any field would break the bullet and could inject a fake `## Cost governor decisions` header or arbitrary markdown into decisions.md. **Not exploitable today** — zero production callers (only `test/cost.test.ts`). Design risk for the phase that wires it up.

### 3. Authn/Authz — n/a
Local CLI tool, no auth surface. No authz removed or weakened. No regression.

### 4. Data exposure — PASS
Only token/budget numbers flow to report.md. No PII, no keys, no usage-log content (only counts). No widened response shape.

### 5. Dependencies — PASS (SCA A)
No new dependencies added. No lockfile change. `node:fs` / `node:path` stdlib only. Dependency audit not applicable; nothing new to scan.

### 6. Deserialization / file handling — PASS
- `primaryState` and stage-model reads wrap `JSON.parse` in try/catch (existing pattern). No untrusted deserialization.
- `recordOptDecision` reads decisions.md fully each call — future DoS concern only if the file grows large and is called hot; not reachable now.

### Untrusted-data doctrine
All external input reaching these functions is validated at S1 (mission allowlist) before any write. The `appendCostEvent`/`recordOptDecision` functions themselves do NOT validate their `missionDir` argument (Low, below) — but the sole production caller always passes an allowlisted dir. No external data is treated as instructions.

---

## 3. Findings

### F1 — Low: `appendCostEvent` / `recordOptDecision` accept unvalidated `missionDir`
- **Location**: `src/cost.ts` L124 (appendCostEvent), L148 (recordOptDecision)
- **Attack scenario**: A future caller passes attacker-influenced `missionDir` (e.g. a git-derived or state-derived path) without the archiveMission allowlist; `join(missionDir, 'cost-events.jsonl'|'decisions.md')` escapes `.mugiwara/missions/<mission>/` and writes/overwrites an arbitrary file in the repo. Not reachable today — sole caller `archiveMission` always passes the allowlisted `dir`.
- **Severity**: Low (CVSS ~2.0). Exploitability: needs a future unvalidated caller + attacker-controlled name (not present). Impact: arbitrary file write within repo.
- **Fix**: Validate `missionDir` inside both helpers (reuse the same allowlist + reject dot-paths), or document a hard "trusted caller only — validate upstream" contract and enforce it at the new call site.

### F2 — Low: `recordOptDecision` markdown injection (no escaping)
- **Location**: `src/cost.ts` L157
- **Attack scenario**: A newline in `actor`, `decision`, `reason`, or `evidence` breaks the bullet framing and injects arbitrary markdown (incl. a second `## Cost governor decisions` header) into decisions.md. Not exploitable today — no production caller.
- **Severity**: Low (CVSS ~2.0). Exploitability: needs the future caller to pass attacker-controlled text. Impact: log/report tampering (aesthestic → misleading audit trail).
- **Fix**: When wiring the caller, escape/sanitize control chars (strip `\n`, `\r`) or JSON-encode each field; treat these as data, not markdown.

### F3 — Nit: symlink / TOCTOU on cost-events.jsonl
- **Location**: `src/cost.ts` L127 (appendFileSync), `src/mission.ts` L237/L277 (fold + rmSync)
- **Attack scenario**: An attacker with write access to the mission dir places a symlink at `cost-events.jsonl`; append/fold/rmSync follow it to an arbitrary target.
- **Severity**: Nit. An attacker who can write into `.mugiwara/missions/<mission>/` already controls the local repo and `.mugiwara` state at the same trust level — no privilege boundary is crossed. Local tool, single-user trust model.
- **Fix**: None required. Document that `.mugiwara/` is local trusted state; if multi-tenant in future, refuse symlink targets (`lstatSync` before write) and use O_NOFOLLOW.

### F4 — Nit: cost-events.jsonl folded into report.md as raw JSON
- **Location**: `src/mission.ts` L237 (fold), report.md rendering
- **Attack scenario**: Raw JSON text embedded under `## Archived: cost-events.jsonl`. Cosmetic; no markdown RCE in this context.
- **Severity**: Nit. Display formatting only.
- **Fix**: Optional — render as a code block for readability.

---

## 4. Hotspots & review rating

| Hotspot | Status | Notes |
|---------|--------|-------|
| S1 mission allowlist (path traversal) | **Reviewed → Safe** | allowlist + dot-path reject covers `..`, `/`, control chars |
| S2 appendCostEvent JSONL write | **Reviewed → Safe** | JSON.stringify escapes framing; validated dir |
| S3 recordOptDecision markdown | **Reviewed → Safe** (not reachable) | no callers; Low design note deferred |
| S4 report fold | **Reviewed → Safe** | data only, no execution |
| S5 state read | **Reviewed → Safe** | try/catch JSON, existing pattern |
| Secrets | **Reviewed → Safe** | none written |
| Dependency/SCA | **Reviewed → Safe** | no new deps, license N/A |

Hotspots reviewed: 7/7 = 100% → **Rating A** (≥80%).

## 5. SCA license compliance — Rating A
No dependencies added or modified (stdlib `node:fs`, `node:path` only). Zero violations.

## 6. Responsibility code attribute
- **Lawful**: no dependency change → no license risk.
- **Trustworthy**: no hardcoded secrets.
- **Respectful**: no offensive terms in new code/comments.

---

## Security regression check
No existing control weakened: mission allowlist, integrity gates (`checkTrail`, `checkMissionArtifacts`), atomic report rename all preserved. Note: `cost-events.jsonl` is not yet in `checkTrail`'s integrity coverage — not a regression (new artifact), add when phase 2 wires savepoints if the ledger becomes attacker-influenced.

## OWASP mapping (project handles no payments/health/PII — lightweight)
| OWASP | Area | Status |
|-------|------|--------|
| A01 Broken Access Control | mission allowlist / path confinement | Safe (F1 Low defense-in-depth) |
| A02 Cryptographic Failures | no crypto touched | n/a |
| A03 Injection | JSONL framing (safe); markdown in recordOptDecision | Safe (F2 Low, not reachable) |
| A06 Vulnerable Components | no new deps | Safe |
| A09 Logging/Monitoring Failures | closure event improves traceability | Positive |

---

## Return
PASS — no Critical/High. Findings F1/F2 are Low and not reachable in the current diff; F3/F4 are Nit. Cost Governor Phase 1 security posture is sound. No reroute to Brook required.

---

# Phase 3 — Work Governor Security Audit

Auditor: Jinbe (mugiwara-security)
Diff: `3ca5d23..HEAD` — `0d1bf3e` (work.ts), `7736227` (evidence F1), `bc4346e` (cost.ts type dedup), `1bf7568` (docs), `3331762` (evidence)
Scope: `src/work.ts` (new), `src/evidence.ts` (F1 validation), `src/cost.ts` (type-only), `content/skills/mugiwara-workflow/SKILL.md`, `docs/concepts/cost.md`, tests. Mode: read-only.
Run in parallel with Robin (review.md). Reviewer MAJORs cross-checked below.

## Verdict: PASS (no Critical/High) — one Major must-fix gated to Phase 8

Readiness: **Mergeable**. No reachable hostile surface this phase — `work.ts` has **zero runtime consumers** (only `test/work.test.ts` imports it; no CLI/pipeline wiring). One **Major** security-control defect (F1 whole-registry loss) is not exploitable today but **must land before Phase 8** consumes the registry signals. Hotspots rating A, SCA A.

---

## 1. Threat model FIRST (STRIDE) — Phase 3 surfaces

| # | Surface | Data crossing | Trust level |
|---|---------|--------------|-------------|
| S6 | `work.ts` verdict functions (`classifyStage`, `shouldSkipStage`, `evaluateInvocation`, `shouldLoadSkill`, `evaluateDelegation`, `completionCheck`) | booleans/numbers/strings — pure, no I/O | in-process, no external input |
| S7 | `recordWorkDecision` → `recordOptDecision` decisions.md write | actor `work-governor`, decision, reason, evidence | local fs write |
| S8 | `loadRegistry` context-registry.jsonl read (F1 validation) | fingerprint/kind/file/id/reads/ref | local fs read |

Every surface has a row. No modeling gap.

### STRIDE per surface

| Surface | Spoofing | Tampering | Repudiation | Info disclosure | DoS | Elevation |
|---------|----------|-----------|-------------|-----------------|-----|-----------|
| S6 | n/a — no identity | n/a — pure funcs | n/a | n/a | n/a | n/a |
| S7 | actor fixed `work-governor` | **S2 sanitizer strips CR/LF** → no markdown/line injection (Phase-1 F2 now closed) | decision/reason/evidence traceable (ts+actor) | no secrets; reason text only | one append/call, bounded | `missionDir` passed unvalidated (Low F3 design rule, not reachable) |
| S8 | n/a | **W1: one malformed/null line empties whole registry** | n/a | `file` paths + sha256 fingerprints (F2 design rule: never registerRead secrets) | **W1: whole-registry loss = dedup availability** | read-only under allowlisted dir |

### Cross-cutting blast radius
All writes land under `.mugiwara/missions/<mission>/` via `recordOptDecision`, which already exists and is sanitized. `work.ts` introduces **no new I/O surface** — only `recordWorkDecision` writes, through the audited S2 path. `loadRegistry` read-only. No new trust boundary.

---

## 2. Checklist

### 1. Secrets — PASS (negative confirmed)
Scanned full diff: no keys, tokens, passwords, `.env`, or hardcoded credentials. `work.ts` holds no constants; `recordWorkDecision` forwards reason/evidence text only. `fingerprint()` emits sha256 hex of content — a **content hash, not a secret** (F2 design rule below). **Negative expected → negative confirmed.**

### 2. Injection — PASS
- **Path traversal (S7)**: `missionDir` flows to `recordOptDecision` unvalidated (F3), but the **only** reachable path in the codebase is `mission.ts` → `archiveMission` allowlist (`/[^a-zA-Z0-9._-]/` + dot-path reject, mission.ts:115). `work.ts` has no caller in production. No new traversal surface.
- **Markdown/line injection (S7)**: **closed.** Phase-1 F2 finding is mitigated at the writer: `recordOptDecision` `flat()` strips CR/LF (`cost.ts:166`). Test-locked — `work.test.ts:258` injects `\n## fake` and asserts it is flattened. No header/bullet injection reaches decisions.md.
- **JSONL (S8)**: read-only path. W1 edge below.
- **No RBAC/authz surface** — local CLI tool, single-user trust model. No authz removed or weakened.

### 3. Untrusted-data doctrine
`work.ts` takes typed booleans/numbers from the (future) caller — no string parsing, no external input reaches it today. No external data treated as instructions. **Crew-consumed, not CLI-wired: confirmed no reachable hostile input.**

### 4. Dependencies — PASS (SCA A)
No dependencies added/modified (`node:crypto`, `node:fs`, `node:path` stdlib only). License compliance A.

### 5. Deserialization — W1 (see below)
`loadRegistry` `JSON.parse` is the only deserialization. Object-line shape is filtered, but the parse/null edge is defective.

---

## 3. Findings (Phase 3)

| # | Sev | STRIDE | Location | Attack scenario | Mitigation |
|---|-----|--------|----------|-----------------|------------|
| **W1** | **Major** | Tampering + DoS (integrity/availability) | `src/evidence.ts` `loadRegistry` | ~~A `null` JSON line or any unparseable/non-JSON line throws inside the `.map` chain → whole registry silently discarded~~. **HEALED by `4dc2490`** (heal cycle 1): per-line `JSON.parse` in own try/catch, `null`/non-object skip, malformed line drops itself, valid entries preserved. Test-locked (16 pass). | ~~Wrap each line's `JSON.parse` in its own `try` + null-guard so only the offending line drops; add null-line + non-JSON-line tests.~~ **Closed.** Was not exploitable today (trusted `persistRegistry`, allowlisted dir); now hardened before Phase 8 consumption. |
| **W2** | Low | Repudiation (audit-trail integrity) | `src/work.ts:74,83` `shouldSkipStage` | `evidence` field returned as `input.stage` (the stage name), not a real `E###` ref. A reader of the `work-governor` trail sees "evidence: security" and misreads it as a dedup ref — undermines the audit trail's meaning. Matches reviewer MINOR. Not reachable (no runtime consumer). | Return `undefined`/drop the field, or thread a real `E###` ref from `loadRegistry`. Cosmetic until wired. |
| **W3** | Low | Tampering/Elevation (future) | `src/work.ts:263` `recordWorkDecision` → `recordOptDecision` | `missionDir` unvalidated at the helper boundary. A future adapter assembling signals from git/state-derived paths could pass a `missionDir` that escapes `.mugiwara/missions/<mission>/` and write `decisions.md` elsewhere. **Not reachable today** — sole reachable path is allowlisted; `work.ts` unwired. | Reuse the mission allowlist inside the record helper, or document + enforce "trusted caller, validate upstream" at the future adapter. Acceptable as a documented design rule (F3) this phase. |

### Confirmed deferrals
- **F1 (registry shape validation) — closed by T2, except W1.** For object lines the filter correctly drops string `reads` (string-concat risk), missing `ref`, fractional (floored), negative and non-finite `reads`. The null/unparseable-line edge (**W1**) means F1 is *partially* closed — the documented shape cases hold; the whole-registry-loss case does not.
- **F2 (sha256 fingerprint of potentially secret-bearing files) — acceptable design rule, not a regression.** `fingerprint(content)` hashes content; if a caller ever `registerRead`s a `.env`/key file, the sha256 hash + char length persist in the trail. Documented rule (cost.md:222): never `registerRead` secrets. No `registerRead` call exists in this diff — rule only. Accept.
- **F3 (unvalidated missionDir) — acceptable design rule, not a regression.** Same Low as Phase-1 F1. Sole reachable path allowlisted. Documented (cost.md:223). Accept.

---

## 4. Secrets scan
Negative across the full diff — no keys/tokens/.env/hardcoded credentials. No new logging of sensitive values.

## 5. Hotspots & review rating

| Hotspot | Status | Notes |
|---------|--------|-------|
| S6 work.ts verdict funcs | **Reviewed → Safe** | pure, no I/O, no reachable input |
| S7 recordWorkDecision → recordOptDecision | **Reviewed → Safe** | S2 sanitizer strips CR/LF (F2 closed); actor fixed |
| S8 loadRegistry (F1) | **Reviewed → Fix → HEALED** (W1) | W1 closed by `4dc2490`: per-line JSON.parse in own try/catch, null/non-object skip, malformed line drops itself; 16 evidence tests pass; see 05-healing.md |
| Secrets | **Reviewed → Safe** | negative confirmed |
| Dependency/SCA | **Reviewed → Safe** | no new deps, license A |

Hotspots reviewed 5/5 = 100% → **Rating A**. One hotspot (`S8`) marked **Reviewed → Fix** (W1) — W1 now **HEALED** by `4dc2490` (see heal cycle 1), non-blocking this phase.

## 6. SCA license compliance — Rating A
No dependencies added or modified. Zero violations.

## 7. Responsibility code attribute
Lawful (no dep change), Trustworthy (no secrets), Respectful (no offensive terms in new code/comments).

---

## OWASP mapping (lightweight — no payments/health/PII)
| OWASP | Area | Status |
|-------|------|--------|
| A01 Broken Access Control | no new access surface; missionDir confinement holds (F3 Low design rule) | Safe |
| A02 Cryptographic Failures | sha256 fingerprint — not crypto for secrecy; no keys | n/a |
| A03 Injection | JSONL read (W1 whole-registry, no injection); markdown injection closed (S2) | Safe |
| A07 Identification/Auth Failures | n/a — no auth surface | n/a |
| A09 Logging/Monitoring | decision trail improves auditability | Positive |

---

## Return
PASS — no Critical/High; no reachable hostile input this phase (`work.ts` unwired, registry read-only under allowlist). One **Major** must-fix (**W1**: `loadRegistry` whole-registry loss on a null/unparseable line) gated to land **before Phase 8** — it is a defect in the F1 security control itself, not exploitable today (local trusted registry; `mission.ts` handles empty gracefully). No Brook reroute required now. W2/W3 Low design notes, consistent with F2/F3 documented rules.
