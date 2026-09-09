# Runbook: Signing and attestation

A report anyone can edit proves nothing. Sign it so a reviewer can check it stayed untouched and came from a trusted key.

**When to use this:** a closed mission needs proof its report is unmodified and trusted.
**Time:** ~5 min first setup, seconds after.
**You need:** a mission with `report.md` (archive first), backend `pure` (default, no binary).

## Steps
1. Create keys once. Key generation is idempotent and never overwrites.
   ```bash
   mugiwara sign --gen-key
   ```
   ```
   ✓ pure ed25519 key pair ready: /Users/mekari/.mugiwara/mugiwara.key / /Users/mekari/.mugiwara/mugiwara.pub
   ```
2. Sign the closed report.
   ```bash
   mugiwara sign sig1
   ```
   ```
   ✓ signed /private/tmp/t5scratch/.mugiwara/missions/sig1/report.md.mugisig (pure ed25519, key: /Users/mekari/.mugiwara/mugiwara.key)
   ```
3. Verify any time.
   ```bash
   mugiwara sign sig1 --verify
   ```
   ```
   ✓ signature verifies against report.md (mugisig, ed25519-pure)
   ```
4. Change one line of the report, then verify again. It fails loudly:
   ```bash
   mugiwara sign sig1 --verify
   ```
   ```
   ✗ SIGNATURE INVALID — report.md changed after signing (mugisig)
   ```
5. Require attestation plus a trust list in `mugiwara.policy.yml`; verification
   then also checks signer membership.
   ```yaml
   attestation:
     required: true
     trusted_keys:
       - id: jane-doe
         pubkey: ed25519:BASE64PUB
     revoked:
       - id: old-laptop
         reason: replaced
   ```
6. Rotate by generating a fresh key, appending the new pub to `trusted_keys`,
   and moving the old id to `revoked`. Revoked signers fail with
   `signature valid but signer revoked`.

## If something goes wrong
| Symptom | Cause | Fix |
|---|---|---|
| `no report.md to sign` | nothing closed yet | `mugiwara archive sig1` first |
| `not signed (no .minisig or .mugisig beside report.md)` | never signed | `mugiwara sign sig1` |
| `signature valid but signer untrusted` | pub missing from `trusted_keys` | add the signer's pub to policy |
| `signing disabled (sign=off)` | config disables signing | set `sign=pure` in `.mugiwara/config` |

## What you end up with
`report.md.mugisig` beside the report (algo, signature, pub, commit, timestamp),
verifiable offline by anyone holding the pub.
