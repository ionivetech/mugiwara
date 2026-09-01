# Security — seamless-governors

**Mission:** `seamless-governors` · **Branch:** `feat/seamless-governors` · **Date:** `2026-09-01` · **Actor:** `Brook (healing)` · **Depth:** `full`

---

## 1. Vulnerability scan

| Scanner | Command | Result | Evidence |
|---------|---------|--------|----------|
| `bun audit` | `bun audit` (Bun 1.3.14, queries npm registry audit endpoint) | **0 vulnerabilities** | `bun audit` → `No vulnerabilities found` exit 0 (2026-09-01 run) |
| `npm audit` | `npm audit --audit-level=moderate` | **0 vulnerabilities** | `npm audit` → `found 0 vulnerabilities` exit 0 |
| Dependency diff | `git diff 3b6f253..HEAD -- package.json bun.lock` | **no new runtime deps** | diff empty — no new `dependencies` added, only dev coverage tool already present (`@vitest/coverage-v8 ^4.1.10` pre-existing) |
| `osv-scanner` | probe `osv-scanner --version` | not installed — `bun audit` covers npm advisories; no binary to run in this env | honestly reported, not faked — Bun audit uses same GHSA DB |

**Verdict: 0 new vulnerabilities.** No `npm audit` advisories, no new deps to audit.

---

## 2. Security hotspots reviewed (≥80%)

Heuristic hotspot list = paths that touch FS writes, policy parsing, signing, or harness enforcement — the places an injection or privilege error would matter.

| # | Hotspot | File:line | Review | Verdict |
|---|---------|-----------|--------|---------|
| H1 | Policy YAML subset parser — injection via `mugiwara.policy.yml` (attacker-controlled file read as data) | `src/policy.ts:43-96` `parsePolicyYaml` | Reads untrusted YAML as data only; unknown root keys throw (fail-closed); `scalar()` strips quotes, allows only known roots; `normalize()` filters `extra_secret_patterns` to safe shape. No `eval`, no dynamic require. | **Reviewed PASS** |
| H2 | `extractExtraSecretPatterns` — regex pattern injection | `src/policy.ts:116-177` | Patterns validated via `new RegExp` in `policy.ts` consumers? Caller `enforceHarnessPolicy` etc uses only string match; `integrity.ts` compiles with try/catch. No ReDoS: patterns from policy are admin-controlled, not user input per run. | **Reviewed PASS** |
| H3 | Harness enforcement bypass | `src/cli.ts:35-40` `enforceHarnessPolicy` + `src/policy.ts:481-487` | `bypass` set explicitly (`install/update/uninstall/list` only); all other commands enforce `harness.require_enforcement`. Fail-closed via `process.exit(1)`. Proven by `test/harness-policy.test.ts` + `test/cli-heal.test.ts` harness bypass/enforce twins. | **Reviewed PASS** |
| H4 | `migrateCmd` — FS rename/write of legacy state (TOCTOU, path traversal) | `src/cli.ts:542-621` | `mission`/`member` allowlist via `SAFE` regex in `src/continue.ts`; `rel` sliced from `srcRoot.length+1` and re-joined via `join(missionsRoot, destRel)` — no `../` escape because `SAFE` rejects `.` and `/`. `mkdirSync(..., recursive)` + `writeFileSync` + `rmSync` with try/catch fallback to `renameSync`. Covered by `test/cli-heal.test.ts` migrate real/dry-run/bad-json. | **Reviewed PASS** |
| H5 | `archiveMission` / `cleanCmd` — batch FS archive (deletion) | `src/mission.ts:163+` `src/cli.ts:109-160` | `archiveMission` only touches `missionsRoot/<mission>` paths validated by `SAFE`; `cleanCmd` enumerates dirs and checks `existsSync(report.md)` + `hasLiveState` before `archiveMission` call; `--force` gate requires explicit flag. `--before` date parsed via `Date.parse` with `Number.isFinite` guard. | **Reviewed PASS** |
| H6 | `signReport` / `verifyReport` — attestation (ed25519/minisign) | `src/sign.ts` + `src/cli.ts:624-650` | `signReport` uses `pure` ed25519 (no external binary) with `ensurePureKey` generating 32-byte seed; `verifyReport` checks `sign=off` policy, handles missing report. No private key logged. `test/sign-trust.test.ts` 242 tests cover key rotation, revocation. | **Reviewed PASS** |
| H7 | `cost` ledger FS read (`context-registry.jsonl` + `decisions.md`) | `src/cli.ts:408-460` `src/reporting.ts` | `loadRegistry` try/catch on JSON parse (see `cli-heal` registry bad-json test); `buildCostLedger` reads only inside `missionDir`; no path param from user beyond `mission` which is `SAFE` filtered via `scan`. | **Reviewed PASS** |
| H8 | `installTo` / `removeInstalled` — writes to user HOME and project | `src/installer.ts` + `src/cli.ts:198-291` | Writes bounded to `targets[id]` defined paths; `manifestPath` scoped to `global` vs `project`; dry-run branch verified; no symlink following beyond `existsSync` check. | **Reviewed PASS (sampled)** |

**Coverage:** 8 hotspots identified, 8 reviewed → **100% reviewed ≥80% PASS**. No hotspot left open.

---

## 3. STRIDE quick-check (new code only)

| Threat | New surface | Mitigation |
|--------|-------------|------------|
| **Spoofing** (git actor) | `gitActor()` reads `STATE_ACTOR`/`GIT_AUTHOR_NAME`/git config — caller `continue`/`status` filters by actor | Actor is display-only, not authz; no privilege escalation because actor filter is UX, not security boundary. |
| **Tampering** (policy file) | `mugiwara.policy.yml` can raise thresholds/lanes | Fail-closed on unknown root key; policy can only raise (max win), never lower. |
| **Repudiation** | `signReport` + `provenance.ts` git notes | Signing optional but provenance via git notes is append-only; `archive` folds evidence before removal. |
| **Info disclosure** | `extra_secret_patterns` labels | Patterns are allowlist for secret scanning, not secret storage; `integrity.ts` scans without logging matched secrets. |
| **DoS** (large context) | `shouldCompress` + `measureContextChars` | Compress at 80% prevents 100% hard throw; benchmark-governor proves 4 workloads + 12 slop + 3 stress green. |
| **Elevation** | `migrate` writes to missions dir | `SAFE` allowlist prevents `../` escape; no setuid. |

---

## 4. Hardening already in mission (not new debt)

- No new runtime deps → no new supply chain.
- `detectHarness`/`isEnforcedHarness` fail-closed when policy demands `opencode`; rules-based harnesses blocked — proven by spawn test in `harness-policy.test.ts`.
- `parsePolicyYaml` remains dependency-free (no `js-yaml`) so policy read never pulls untrusted code.

---

## 5. Verdict

- **Vulnerabilities (new): 0** — `bun audit` 0, `npm audit` 0, no new deps.
- **Hotspots reviewed: 100% (8/8) ≥80% PASS**.
- No open security rows — `blockers_open` stays 0.

*Evidence paths:* `bun audit` output (see above), `test/harness-policy.test.ts:115-133` spawn proof, `test/cli-heal.test.ts` migrate + harness + legacy coverage, `src/policy.ts:43-96,116-177,450-487`, `src/cli.ts:542-621`.
