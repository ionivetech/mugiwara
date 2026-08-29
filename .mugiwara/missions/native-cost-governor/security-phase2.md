# Security Audit — Phase 2 Context Governor

Auditor: Jinbe (mugiwara-security)
Diff: `1451758..HEAD` (T1–T6) on `feat/native-cost-governor`
Scope: `src/evidence.ts`, `src/context.ts`, `src/investigation.ts`, `src/config.ts` (investigation_*), `src/cost.ts` (S2 fix), `src/mission.ts` (Cost section + closure event)
Mode: read-only. No source changed.

## Verdict: PASS (no Critical/High)

Readiness: **Ready**. No blocker. Highest finding Low. Two prior findings (S1 .jsonl secret-scan, S2 recordOptDecision sanitize) confirmed fixed and regression-tested. Hotspots rating A (100% reviewed), SCA rating A (no dependency change).

---

## 1. Threat model FIRST (STRIDE)

### Surfaces (trust boundaries) — all new or touched by the diff

| # | Surface | Data crossing | Trust level |
|---|---------|--------------|-------------|
| S1 | `persistRegistry(missionDir, registry)` → context-registry.jsonl write | registry entries (fingerprint, kind, file, range, id, reads) | low (fs) → local fs |
| S2 | `loadRegistry(missionDir)` → context-registry.jsonl read | raw JSONL lines → RegistryEntry[] | local fs read |
| S3 | `fingerprint` / `registerRead` / `findRepeats` (evidence.ts) | content string → sha256 | pure, in-memory |
| S4 | `recordInvestigationStop` → `recordOptDecision` (investigation.ts) | status, evidence → decisions.md | low → local fs |
| S5 | `evaluateInvestigation` / `contextStatus` / `estContextTokens` / `computeContextMetrics` | config ints + counters → verdict/metrics | pure |
| S6 | `readInvestigationConfig` (config.ts) | config file investigation_* keys → ints | config (local) |
| S7 | archive Cost section + closure event (mission.ts) | registry reads → report.md metrics row | local fs → rendered output |

Every surface has a row. No modeling gap.

### STRIDE per surface

| Surface | Spoofing | Tampering | Repudiation | Info disclosure | DoS | Elevation |
|---------|----------|-----------|-------------|-----------------|-----|-----------|
| S1 | n/a | JSON.stringify escapes framing (safe) | n/a | fingerprint = sha256, not content (Low, F2) | one-line-per-entry, bounded | unvalidated missionDir (Low, F3) |
| S2 | n/a | **entries not schema-validated on load (Low, F1)** | n/a | refs/metadata only, no content | JSON.parse per line; file local | n/a |
| S3 | n/a | pure, no I/O | n/a | sha256 of content (Low, F2) | n/a | n/a |
| S4 | n/a | flat() strips CR/LF (S2 ✓) | ts traceable | evidence field, sanitized | n/a | unvalidated missionDir (Low, F3) |
| S5 | n/a | pure, no I/O | n/a | n/a | limits always >0 (safe) | n/a |
| S6 | n/a | config is local trusted | n/a | n/a | positiveInt blocks 0/neg/non-int (safe) | n/a |
| S7 | n/a | only numeric metrics folded; registry never folded | n/a | numbers only, no content | n/a | n/a |

### Cross-cutting blast radius
All new writes/reads stay under `.mugiwara/missions/<mission>/`, same trust level as the Phase-1 cost-events.jsonl. `context-registry.jsonl` stores sha256 **fingerprints** of file content — never the content itself — and is **not** folded into report.md (only numeric metrics reach the report). No previously-internal data made newly reachable. No new dependency, no network surface.

---

## 2. Prior findings regression check (Phase 1 controls)

| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| S1 | `.jsonl` not in TRAIL_EXTS → cost ledger evades closure secret/path scan | **Fixed ✓ (not regressed)** | `src/integrity.ts:41` `TRAIL_EXTS = {'.md','.json','.sh','.jsonl'}`. Both `cost-events.jsonl` and the new `context-registry.jsonl` are now secret-scanned + link-checked at closure. |
| S2 | `recordOptDecision` raw markdown interpolation | **Fixed ✓ (not regressed)** | `src/cost.ts:171` `flat()` strips `[\r\n]+`→space on `actor/decision/reason/evidence`. Regression test `test/cost.test.ts:284-300` asserts no injected `## fake section` header, no newline/CR in the bullet. Effective. |
| S3 | `appendCostEvent`/`recordOptDecision` unvalidated `missionDir` | **Repeated in Phase 2 (Low, F3)** | New helpers inherit the same unguarded contract — see F3. |

S1 and S2 are confirmed closed. S3 is the recurring Low, still not reachable by any production caller.

---

## 3. Checklist

### 1. Secrets — PASS (one Low design note)
No hardcoded keys, no `.env`, no new logging. `context-registry.jsonl` stores **sha256 hashes** of content, not the content. `.jsonl` is in TRAIL_EXTS so both ledgers are closure-scanned. See F2 for the fingerprint-of-secret-bearing-files note.

### 2. Injection — PASS
- **Path traversal** (S1/S2): `persistRegistry`/`loadRegistry` join `missionDir` + fixed filename under whatever `missionDir` the caller passes — same as F1/S3. `missionDir` originates from the allowlisted archive path; no production caller passes a hostile dir. Low (F3).
- **JSONL framing** (S1): entries written via `JSON.stringify(entry)+'\n'` — newlines/control chars in `kind/file/range/id` are escaped, one record per line. A hostile field cannot break framing. Safe.
- **Registry field → report injection** (S2): only `files_loaded/repeated_reads/duplicate_chars/reuse_rate/read_avoidance_chars` (numbers) fold into report.md; `ref`/`file`/`range` never reach the report. Safe.
- **recordOptDecision** (S4): S2 fix active — all four fields flattened. New caller `recordInvestigationStop` passes hardcoded `actor='cost-governor'`, `decision='stop investigation'`, and `reason` from the typed union — trusted. `evidence` caller-supplied but newline-flattened. Safe.

### 3. Authn/Authz — n/a
Local CLI tool, no auth surface. No authz removed or weakened.

### 4. Data exposure — PASS
Report gains numeric efficiency metrics only. Registry content (`file` paths, fingerprints) never ships to report.md. `.jsonl` now closure-scanned (S1). No PII, no keys, no content.

### 5. Dependencies — PASS (SCA A)
`git diff 1451758..HEAD -- package.json` + lockfiles: **empty**. No new dependency, no lockfile change. `node:crypto` (sha256) is stdlib. Nothing new to audit.

### 6. Deserialization / file handling — PASS (one Low)
`loadRegistry` wraps the whole read in try/catch (absent file → `[]`), but does **not** schema-validate parsed entries (F1). sha256 (`createHash('sha256')`) is collision-resistant — no weak-hash concern; fingerprint is not used for security auth, only dedup identity. No path traversal in the fixed filename.

### Untrusted-data doctrine
External input to the new modules is the config file (S6, validated) and the local registry JSONL (S2, read-only local). No network/browser/external data reaches execution. Nothing treated as instructions.

---

## 4. Findings

### F1 — Low: `loadRegistry` does not validate entry shape
- **Location**: `src/evidence.ts:107-113`
- **Attack scenario**: A tampered/corrupt `context-registry.jsonl` line (`reads` as string/huge, missing `id`, crafted `file`) JSON.parses silently into `RegistryEntry`. String `reads` reaches archive metrics via string-concat (`0 + "100"` = `"0100"`) and injects odd text into report.md; a crafted `file`/`ref` would be logged by future consumers. Not reachable this phase — no production writer (persistRegistry uncalled); file local-trusted.
- **Severity**: Low (CVSS ~2.1). Exploitability: needs a tampered local file (same trust level) + a Phase-3 writer. Impact: report-metric corruption / misleading audit trail.
- **Fix**: On load, drop lines failing a shape check (`typeof reads === 'number' && Number.isFinite`, valid `E\d+` id, bounded `reads`), like the state readers' try/catch. Cheap, do it when wiring Phase 3.

### F2 — Low: sha256 fingerprint of potentially secret-bearing files
- **Location**: `src/evidence.ts:15-17` (fingerprint), registry entries
- **Attack scenario**: If Phase 3 registers `.env`/config/keys content, the **hash** of low-entropy secrets (short passwords) lands in `context-registry.jsonl`. High-entropy keys are safe (hash not invertible); low-entropy values are brute-forceable *if* the jsonl leaks off-machine. Local-only today; hashes won't trip SECRET_PATTERNS at closure, so the scan won't flag them.
- **Severity**: Low (CVSS ~2.3). Exploitability: requires off-machine exfiltration of a local file + low-entropy secret + knowledge of hash source. Impact: theoretical secret-hash disclosure.
- **Fix**: Design rule — do not `registerRead` files known to hold secrets (skip `.env`, keys, config values); or key the registry off path+size instead of full content hash for such files. Note it in the registry contract for Phase 3.

### F3 — Low: `persistRegistry` / `loadRegistry` / `recordInvestigationStop` accept unvalidated `missionDir` (S3 repeat)
- **Location**: `src/evidence.ts:98/107`, `src/investigation.ts:60`
- **Attack scenario**: Same as Phase-1 F1: a future caller passes attacker-influenced `missionDir` without the archiveMission allowlist; `join(missionDir, 'context-registry.jsonl')`/`decisions.md` escapes the mission dir and writes/overwrites an arbitrary file. Not reachable — only trusted `archiveMission(dir)` (allowlisted) calls these in production.
- **Severity**: Low (CVSS ~2.0). Exploitability: needs a future unvalidated caller + attacker-controlled path (not present). Impact: arbitrary file write within repo.
- **Fix**: Reuse the mission-name allowlist + dot-path reject inside these helpers, or enforce the "trusted caller — validate upstream" contract at each new call site as they are wired.

### F4 — Nit: `context-registry.jsonl` not folded/removed at archive (Phase-3 orphan)
- **Location**: `src/mission.ts:238-264` (fold list), `:303-316` (cleanup)
- **Attack scenario**: Archive folds `cost-events.jsonl` (comment: "so nothing survives loose after archive") but **not** `context-registry.jsonl`; post-fold cleanup rm's only `.json` state files (line 313), not `.jsonl`. Once Phase 3 wires `persistRegistry` (the writer), a mission archive will leave `context-registry.jsonl` loose in the mission dir — an unsealed, stale artifact that future `checkTrail` keeps secret-scanning. Not an issue this phase (no production writer), but the lifecycle gap is introduced now.
- **Severity**: Nit → Low-once-wired. Exploitability: zero today; 1.0 when Phase 3 writer exists. Impact: broken trail-seal contract, stale file in archived dir.
- **Fix**: Add `context-registry.jsonl` to the archive fold list (folds into report.md like cost-events.jsonl) or to the post-fold cleanup, when Phase 3 wires the writer.

### F5 — Nit: config investigation_* unbounded upper range
- **Location**: `src/config.ts:91-95` `positiveInt`
- **Attack scenario**: `investigation_max_passes`/`max_unrelated_files`/`repeated_read_threshold` accept any positive integer with no cap. A huge value only *loosens* a limit (more passes, higher threshold) — cannot shrink, cannot DoS, no zero/negative (blocked by `Number.isInteger && >0`). Operator's explicit choice. No exploit.
- **Severity**: Nit. Exploitability: n/a. Impact: n/a.
- **Fix**: None required. Optionally cap for consistency with other config keys.

---

## 5. Hotspots & review rating

| Hotspot | Status | Notes |
|---------|--------|-------|
| S1 persistRegistry JSONL write | **Reviewed → Safe** | JSON.stringify framing; unvalidated missionDir Low (F3) |
| S2 loadRegistry read | **Reviewed → Safe** (F1 Low) | try/catch; no shape validation, not reachable |
| S3 fingerprint/registerRead | **Reviewed → Safe** | sha256, no I/O; F2 Low design note |
| S4 recordInvestigationStop → recordOptDecision | **Reviewed → Safe** | S2 sanitize verified + tested |
| S5 investigation/context pure functions | **Reviewed → Safe** | limits always >0, no div-by-zero |
| S6 readInvestigationConfig | **Reviewed → Safe** | positiveInt sanitizes 0/neg/non-int (tested) |
| S7 archive Cost + closure event | **Reviewed → Safe** | numeric metrics only; registry never folded |
| Secrets | **Reviewed → Safe** | none written; jsonl closure-scanned (S1 ✓) |
| Dependency/SCA | **Reviewed → Safe** | no new deps, license N/A |

Hotspots reviewed: 9/9 = 100% → **Rating A** (≥80%).

## 6. SCA license compliance — Rating A
No dependency added or modified. Stdlib (`node:fs`, `node:path`, `node:crypto`) only. Zero violations.

## 7. Responsibility code attribute
- **Lawful**: no dependency change → no license risk.
- **Trustworthy**: no hardcoded secrets; prior secret findings (S1) confirmed closed.
- **Respectful**: no offensive terms in new code/comments.

---

## Security regression check
No existing control weakened. Mission allowlist (mission.ts:115), closure integrity gates (`checkTrail` incl. `.jsonl`, `checkMissionArtifacts`), atomic report rename all preserved. S1/S2 both fixed and regression-tested. New surface stays at the same local trust level.

## OWASP mapping (no payments/health/PII — lightweight)
| OWASP | Area | Status |
|-------|------|--------|
| A01 Broken Access Control | mission allowlist / path confinement | Safe (F3 Low defense-in-depth) |
| A02 Cryptographic Failures | sha256 fingerprint (not security crypto) | Safe |
| A03 Injection | JSONL framing (safe); recordOptDecision sanitized (S2 ✓) | Safe |
| A06 Vulnerable Components | no new deps | Safe |
| A09 Logging/Monitoring Failures | closure event + registry improve traceability | Positive |

---

## Return to Luffy
PASS — no Critical/High. S1 (`.jsonl` secret-scan) and S2 (recordOptDecision sanitize) confirmed fixed and regression-tested; not regressed. Four Low / two Nit findings; none reachable in the current phase (all depend on the Phase-3 writer being wired). Hotspots rating A, SCA A.

**Routed to Brook (1, recommended-major for Phase 3):** F4 — archive does not fold/remove `context-registry.jsonl`; when Phase 3 wires `persistRegistry` the mission archive will leave an unsealed loose jsonl in the mission dir, violating the "nothing survives loose" contract. Not a blocker this phase (no production writer) but must be closed in the Phase-3 wiring so it does not rot into a stale/leaky artifact. F1 (registry shape validation on load) pairs with it — do both in Phase 3.
