# Optional: signed reports and provenance

**Optional add-on. Nothing in the core flow needs this page.** Skip it unless a reviewer or an auditor has to prove that a closed report was not edited and who produced it. Everyday missions never sign, and signing stays off until you ask for it.

A report anyone can edit proves nothing. Signing lets a reviewer check, offline, that `report.md` is byte-for-byte what was archived and that it came from a key your team trusts. Provenance answers a different question: for one file, which mission, lane and evidence produced its last change. `git blame` stops at who touched a line.

Example: sign a closed mission, verify it, change one line of the report, and verify again.

```bash
mugiwara sign --gen-key
```

```
✓ pure ed25519 key pair ready: ~/.mugiwara/mugiwara.key / ~/.mugiwara/mugiwara.pub
```

```bash
mugiwara sign m
```

```
✓ signed <project>/.mugiwara/missions/m/report.md.mugisig (pure ed25519, key: ~/.mugiwara/mugiwara.key)
```

```bash
mugiwara sign m --verify
```

```
✓ signature verifies against report.md (mugisig, ed25519-pure)
```

After a line of `report.md` changes, the same command fails:

```
✗ SIGNATURE INVALID — report.md changed after signing (mugisig)
```

Rule: archive first, then sign. Key generation never overwrites an existing key. Run `mugiwara sign` with no mission to list the signable ones (exit code 2).

## Require signatures and a trust list

Add an `attestation` block to `mugiwara.policy.yml` (see [policy](../concepts/policy.md)). With `required: true`, archive fails when `report.md` is unsigned or the signer is untrusted or revoked, and `sign --verify` also checks the signer against the list. Public keys are stored as `ed25519:` plus the base64 of the 32-byte raw key.

```yaml
attestation:
  required: true
  trusted_keys:
    - { id: "jane-doe", pubkey: "ed25519:BASE64PUB", added: "2026-08-31" }
  revoked:
    - { id: "old-laptop", revoked: "2026-08-15", reason: "key rotation" }
```

To rotate a key, generate a new one, add its public key to `trusted_keys`, sign the next report with both for one release, then move the old entry to `revoked`. From then on a report signed only by the old key fails with `signature valid but signer revoked`.

The backend is chosen by the `sign` config key (`off`, `minisign`, `pure` or `auto`, see [config](../concepts/config.md)). With `sign=off`, signing is disabled and the command says so.

## Provenance and handoff

Closure writes `provenance.md` beside the report: mission, agent, lane, mode, task count, evidence files and a pending-human-review line, ready to paste into a PR description. The model name comes from `MUGIWARA_MODEL` when set. The block records the git author identity, so read it before pasting it anywhere public.

To ask where one file came from, run `mugiwara handoff <mission> --path <file>`. It writes the handoff report and appends the last commit that touched the file, with that commit's note, and says so when no note exists. Notes live outside history, so rebases leave SHAs untouched, but a clone does not fetch them: teammates add `git fetch origin refs/notes/mugiwara:refs/notes/mugiwara`.

## When something fails

- `no report.md to sign`: nothing is closed yet. Run `mugiwara archive <mission>` first.
- `not signed (no .minisig or .mugisig beside report.md)`: run `mugiwara sign <mission>`.
- `signature valid but signer untrusted`: add the signer's public key to `trusted_keys`.
- `no per-commit note` from `handoff --path`: the notes ref was never fetched. Fetch it as above, or read the mission's `provenance.md`.
