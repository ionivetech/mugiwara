# Closure tools

What happens when a mission ends. Five deterministic mechanisms run at or
around `mugiwara archive` — no model judgement, so they cannot be talked
past.

## Closure integrity gate

The trail validates itself before it folds. The archive **fails** when:

- a relative markdown link in any trail file points at a file that does not
  exist (checked against the mission dir and the repo root)
- any trail file matches a secret shape — AWS keys, GitHub/Slack tokens,
  private-key blocks, pasted JWTs, credential assignments
- an evidence path recorded in `state.json` does not exist

```
✗ archive fails:
  ✗ [secret] review.md matches GitHub token: ghp_ABCDEFGHIJ…
  ✗ [dangling-path] report.md links "missing.md" — no such file
```

Fix the trail and re-archive; there is no flag to bypass the gate.

## Executable rollback map

Closure generates `.mugiwara/missions/<mission>/rollback.sh`: the branch,
its base, the exact `git revert` commands newest-first, and the list of files
the mission touched. Executable bit set; the human runs it, mugiwara never
does (no-auto-deploy stands). No git history derivable → no file, rather than
a wrong one.

## Review routing

Instead of a flat diff, the report gains a ranked reading order: sensitive
paths first, then production code not covered by recorded evidence, tests and
docs last. It decides where to look first — never whether a line is correct.

## Context footprint

The report records the byte size of everything the mission left behind.
Configure a ceiling in `.mugiwara/config`:

```
context_budget_chars=150000
```

Over the ceiling fails the archive like a failed test; unset means measured
and printed only.

## Signed attestation (optional)

`mugiwara sign <mission>` signs the mission report; `--verify` checks it. The
backend comes from `sign_backend` in `.mugiwara/config`
(`auto` | `minisign` | `pure` | `off`; default `auto`):

- **auto (default)** — uses `minisign` if installed and keyed, else falls back
  to the built-in **pure** ed25519 backend (zero binary, zero deps).
- **pure** — internal `node:crypto` ed25519; keys generated with
  `mugiwara sign --gen-key` (no external tool needed).
- **minisign** — external binary + `MUGIWARA_SIGN_KEY` / `MUGIWARA_SIGN_PASSWORD`
  or `~/.mugiwara/minisign.{key,pub}`.
- **off** — no signature.

```bash
mugiwara sign --gen-key                    # one-time: create pure ed25519 keys
mugiwara sign <mission>                    # signs report.md (current backend)
mugiwara sign <mission> --verify           # checks the signature
```

Signing is **optional** — it is not required to close or archive a mission. A
signature turns "here is my evidence" into "here is evidence that cannot be
edited after the fact".

### Enterprise keys

Today the attestation is ed25519 (minisign or the pure backend). The planned
enterprise path is **sigstore/keyless** or KMS-backed signing — same interface,
no breaking change: `mugiwara sign <mission>` and
`mugiwara sign <mission> --verify` will not change. Teams that need a KMS or a
transparency log can adopt the new backend when it lands without updating call
sites. The staged marker is tracked as a future item.
