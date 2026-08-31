# Policy as code

Org rules that override crew judgement. One optional file at the repo root:

```yaml
# mugiwara.policy.yml
lanes:
  force_full: ["src/auth/**", "src/payments/**", "**/migrations/**"]
gates:
  coverage:
    new: 95
    modified: 85
  require_human_approval: ["src/payments/**"]
evidence:
  required: [test, lint, security]
attestation:
  required: true
  trusted_keys:
    - { id: "farid", pubkey: "ed25519:AAAA…", added: "2026-08-31" }
    - { id: "ci",    pubkey: "ed25519:BBBB…", added: "2026-08-31" }
  revoked:
    - { id: "old-ci", revoked: "2026-08-15", reason: "key rotation" }
harness:
  require_enforcement: true  # refuse rules-based harnesses — opencode only
```

**Absent file = today's behavior.** Nothing else changes: no config key, no
flag, no daemon.

## The one rule

Policy pushes **up**, never down. A forced lane can raise `standard → full`;
it can never shrink a sensitive-path escalation. Coverage thresholds take the
max of `.mugiwara/config` and policy. An unknown root key fails loudly — a
typo'd policy must not silently disable the rule it carried.

## What reads it

| Consumer | Key | Effect |
|----------|-----|--------|
| `scripts/lane.sh`, `savepoint.sh` | `lanes.force_full` | changed files matching any glob → lane `full`, reason records the glob |
| `scripts/coverage-gate.ts` | `gates.coverage.*` | thresholds raised to the policy value; printed when they bind |
| gates flow stage (crew) | `gates.require_human_approval` | listed in gate output; human sign-off required before ship |
| planning + execution | `evidence.required` | minimum evidence kinds the plan must produce |
| `src/sign.ts` `verifyReport` | `attestation.trusted_keys` / `revoked` | `mugiwara sign --verify` checks signature **and** that signer `ed25519:BASE64` is in `trusted_keys` and not in `revoked` (by `id` or `pubkey`) |
| `src/mission.ts` `archiveMission` | `attestation.required` | when `true`, archive fails `closure integrity gate failed — attestation required but report not signed/trusted` if `report.md` is unsigned or signer is untrusted/revoked |
| `src/cli.ts` `enforceHarnessPolicy` / `src/policy.ts` `isEnforcedHarness` | `harness.require_enforcement` | when `true`, CLI refuses to run on rules-based harnesses (only `opencode` passes); error `harness enforcement required but current harness is rules-based only — use opencode or set harness.require_enforcement:false` |

Glob semantics: `**` crosses directories (`src/auth/**` matches
`src/auth/deep/x.ts`), `*` stays within one segment.

## Signing & key rotation (attestation)

`attestation.required: true` makes the archive gate enforce a detached
signature beside `report.md` (`report.md.mugisig` for pure ed25519, or
`report.md.minisig` for minisign). `mugiwara sign <mission>` creates the
signature; `mugiwara sign <mission> --verify` checks both the crypto and the
policy trust lists. Pubkeys are stored as `ed25519:BASE64` (32-byte raw key,
base64). Trusted list entries use inline or multiline form:

```yaml
trusted_keys:
  - { id: "farid", pubkey: "ed25519:AAAA", added: "2026-08-31" }
  # or multiline:
  - id: farid
    pubkey: ed25519:AAAA
    added: 2026-08-31
```

Revoked entries are matched by `id` (the trusted entry's `id`) or by
`pubkey` if supplied:

```yaml
revoked:
  - { id: "old-ci", revoked: "2026-08-15", reason: "key rotation" }
```

**Rotation (minimal):**

1. Add new key to `trusted_keys` (keep old).
2. Sign the next release with **both** keys for one release (run `mugiwara sign` with each key, or publish two `.mugisig` artifacts if dual-signing).
3. Move old entry from `trusted_keys` to `revoked` (keep its `id`, date, reason). From then on `sign --verify` fails `revoked` and `archive` refuses a report signed only by the old key.

## Harness enforcement (enterprise)

`harness.require_enforcement: true` requires the runtime-enforced path — only
**opencode** passes. All other harnesses (Claude Code, Copilot, Gemini, Codex,
Windsurf, Cline, Kilo, Antigravity, Cursor, Kimi, Pi) are rules-based and are
refused with `harness enforcement required but current harness is rules-based
only — use opencode or set harness.require_enforcement:false`. Detection mirrors
`scripts/savepoint.sh` (`OPENCODE` / `OPENCODE_TOKENS_FILE` env or
`.opencode/config.json` ⇒ opencode; `CLAUDECODE` / `CLAUDE_CODE_ENTRYPOINT` /
`ANTHROPIC_MODEL` containing `claude` ⇒ claude; otherwise `unknown` / `cursor`).
When the file is absent or `require_enforcement: false`, behavior is unchanged.

## Parser honesty

The bundled reader accepts a deliberate subset — nested maps, string arrays,
scalars, comments, plus dedicated extractors for `integrity.extra_secret_patterns`
and `attestation` lists-of-maps (inline `{ k: v }` and multiline ` - k: v`).
It has no dependency and no YAML edge-case support beyond that. If you need
anchors or multi-line strings, keep the policy boring.
