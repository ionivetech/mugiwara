# Roadmap

Mugiwara is the governance layer for AI-assisted engineering work: every change
the crew makes carries a human-reviewable trail — which wave, what evidence,
approved by whom — and the cost of the process scales to the size of the work.

> **v0.7.0 shipped.** Previous roadmap (11 items: provenance, review routing,
> policy as code, token efficiency, closure integrity, rollback, permission
> boundaries, tool-surface, staleness, signed attestation, adoption kit) is
> archived at `docs/archive/ROADMAP-0.7.0.md`. Core is stable.

This roadmap is **fresh** — only what is next.

---

## The bet (unchanged)

| Then | Now | Next |
|------|-----|------|
| _Can the agent write it?_ | _Can the agent finish it unsupervised?_ | _**Can anyone verify what it did?**_ |

Mugiwara scales with model capability. Every item below is chosen against three
limits: no runtime daemon, 21 skills ceiling, twelve harnesses.

### Current state (v0.7.0)

```
21 skills · 14 agents (+3 internal) · 12 harness targets
cold-load 4,741 chars · workspace .mugiwara/missions/<mission>/
 lane · savepoint · archive · provenance · rollback · policy · handoff
sign: minisign-only (external dep) · practical skills: 3★ avg
```

---

## Near — make signing and skills self-contained

### 1. Dual attestation — minisign selectable + pure fallback (ed25519)

**User chooses, fallback just works.**

Today `mugiwara sign` needs external `minisign`. New: **dual backend** with
`sign_backend` in `.mugiwara/config`:

```
sign_backend=auto   # auto | minisign | pure | off
```

- `auto` (default): try `minisign` if installed + key exists → `report.md.minisig`; else pure JS ed25519 → `report.md.mugisig`. Zero hard dep either way.
- `minisign`: force external minisign (fail loudly if missing — for teams that mandate it).
- `pure`: force internal `node:crypto` ed25519 (no binary, same `.mugisig`).
- `off`: no signing (today's behavior when nothing installed).

**Pure fallback, minisign-like:** ed25519 detached signature via `node:crypto`
(`generateKeyPairSync('ed25519')`), stored as:

```
~/.mugiwara/mugiwara.key  # 32B seed base64
~/.mugiwara/mugiwara.pub  # 32B pub base64
.mugiwara/missions/<mission>/report.md.mugisig  # JSON {algo:"ed25519-pure", sig, pub, mission, commit, ts}
```

`mugiwara sign <m>` writes one of `.minisig` or `.mugisig` based on backend.
`mugiwara sign <m> --verify` checks both (tries minisig via binary, then pure via
`crypto.verify`). `mugiwara sign --gen-key [--backend pure|minisign]` creates keys.

**Why:** `minisign` is excellent but external — Windows needs install, CI needs
apt, onboarding loses one step. Pure gives *secure and bagus* out-of-box;
minisign stays selectable for teams that already standardize on it. Same CLI,
no breaking change.

_Feasibility:_ `node:crypto` ed25519 available since Node 20.11 (mugiwara engine
floor). No new npm dep (or optional `tweetnacl` for older Node). Mirrors minisign
detached semantics, not its wire format — verifier knows both.

_Pillar 1._

### 2. Practical skills — 3★ → 5★ hardening (source-backed, measured, all capabilities)

**Every practical skill earns 5 stars via source grounding + gate. No brand
labels in skill files — industry-grade is described as behavior, not name.**

Today 12 practical skills average 3★: prose sound, enforcement advisory. Upgrade
covers **all** capabilities, not only 7:

- **backend** — Clean architecture `controllers→services→repos→domain` (dependency
  rule, 300 LOC/file max, SOLID composition), Prisma `$transaction` with guard +
  singleton `PrismaClient` + `select`/`include` anti N+1 + `@@index`/`P2002`,
  Express `next(err)` + centralized `res.status().json` + `logger.error({path,method,stack})`
  + OpenTelemetry trace. Cite `source-grounding.md` + Context7.
- **frontend + design system** — Tokens before markup (`tokens.css` spacing 4/8,
  type scale, role palette, radii, motion), primitives `Button/Input/Card/Stack`
  100% reuse, Storybook per primitive; React `useActionState` for Server Actions
  + `aria-live`/`data-testid`/keyboard paths, CLS/LCP/INP budgets, Tailwind
  `content` purge + `prettier-plugin-tailwindcss`.
- **architecture** — ADR-lite (`Context→Decision→Consequence`) in `plan.md`
  `## Architecture overview`; dependency graph acyclic (no cycles via `madge`),
  bounded contexts, ADR per Full plan.
- **contract-first** — Zod `safeParse`/`flatten`/`refine` at boundary, OpenAPI
  shape before impl, stable error envelope `{code,message,details}`,
  version `/v2` + `Sunset` header, 2 live versions max.
- **planning** — Full context scan + wave `## Waves`/`## Task index` + `Break:`
  split >8 files, `CODEOWNERS` per area, rollback per wave.
- **execution** — Boy Scout rule (one refactor per touch), `ts-prune`/`knip` dead
  code 0, `strict:true`, one logical task = one commit `feat(scope):`, TDD
  red→green, `data-testid` per interactive element.
- **quality** — ESLint `complexity`/`cognitive-complexity`, Sonar `duplicated_lines_density<3%`,
  maintainability A-E (debt ratio), file health ≤300 LOC / func ≤30 LOC.
- **review** — Damage map (grep callers per changed export), 5-axis
  (correctness/readability/arch/security/perf), severity `blocker|major|minor`
  `path:line`, small CLs ≤400 LOC, ownership approval.
- **security** — STRIDE per surface + OWASP Top 10 + hotspot % A-E + SCA license
  A-E + defense-in-depth (WAF→authz→service→DB constraints) + secret rotation +
  `npm audit`/`osv-scanner`.
- **gates** — Coverage `new≥90% modified≥80%` (policy can raise), Sonar gate
  `Vuln=0 Bugs=0 smells≤threshold Coverage≥threshold Duplication<3% Hotspots≥80%`,
  build 0, DoD 5 axes, diff ≤400 LOC (reviewability).
- **checkpoint/healing** — Chopper verifies every `Acceptance` with `git diff`
  scoped evidence; Brook fixes root cause + guard test red→green, `heal_halt`
  at 3. All via Context7, not memory.
- **maintainable code (cross-cutting)** — DRY/KISS/composition, typed boundaries
  (Zod/Prisma, no `any`), docs `why` not `what`, `tsdoc` per public API, generated
  SDK from OpenAPI single source.

**Gate per skill:** each skill writes verifiable artifact with number/link
(e.g., backend `flows/01-execution.md` cited doc link; quality `duplicated_lines_density`
+ `cognitive_complexity` table) — missing = Chopper FAIL. Extend
`validate-content.ts` to check artifact presence, not only prose.

_Pillar 1, 4._

### 3. Engineering excellence — how great teams write code (in roadmap, not in skill labels)

This is **not a label in any SKILL.md** — skills describe behavior (small,
typed, tested, reviewed) without naming companies. Roadmap tracks the bar:

- **Small & reviewable:** PR ≤400 LOC, one purpose, 60-90s/100 LOC review.
- **Typed & tested:** `strict:true`, `safeParse` at boundary, table-driven tests,
  `getByRole` a11y tests, coverage on new code.
- **Operable:** structured logs + traces, error domains `Validation→400` etc.,
  runbooks per service.
- **Evolvable:** ADR per decision, 2 versions live max, deprecation 6 months.

_Pillar 1._

### 4. Enforcement — advisory → measured

Turn `review_depth`/`quality_depth`/`verify_merged` from advisory to computed
`state.json` flags (like `heal_max_cycles` → `heal_halt`). Add
`scripts/check-artifacts.ts` as gate: every Lane 2+ mission must have
`plan.md` + `flows/*` evidences, else `archive` fails like secret gate.

### 5. Skill retrieval accuracy — keep 94%+

Lane-base drift guard exists. Add per-skill retrieval eval for hardened skills
(Context7 docs as ground truth).

---

## Standing constraints (unchanged)

- No runtime, no daemon. No auto-merge/deploy. Human PR gate terminal.
- 21 skills ceiling — new replaces old.
- No per-engineer metrics visible to manager.
- No head-to-head scorecards.

## The standing rule

> **Every defect found in production adds a gate before the fix merges.**

Mugiwara's invariants belong in gates, not prose.
