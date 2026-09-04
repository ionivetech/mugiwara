# Runbook: Policy file for a crew

**When to use this:** the org wants scrutiny floors no mission can go below.
**Time:** ~15 min to write, seconds to enforce.
**You need:** repo root write access, agreement on thresholds.

## Steps
1. Create `mugiwara.policy.yml` at the repo root.
   ```yaml
   lanes:
     force_full:
       - payments/**
   gates:
     coverage:
       new: 90
       modified: 80
   evidence:
     require_nonempty_for_lanes:
       - standard
       - full
   harness:
     require_enforcement: true
   ```
2. Know the direction: policy raises the lane, never lowers it. Thresholds resolve
   to the max of config and policy; `force_full` globs push matching missions up.
3. `require_nonempty_for_lanes` turns an empty evidence set from warning into an
   archive blocker on the listed lanes.
4. `harness.require_enforcement: true` refuses rules-only harnesses — run under the
   enforced harness or set the key to `false`.
5. A typo fails closed with the known roots listed:
   ```
   unknown policy key "bogus_key" (known: lanes, gates, evidence, integrity, attestation, harness)
   ```
6. Check cost impact of the raised lanes with `mugiwara cost --ledger`.

## If something goes wrong
| Symptom | Cause | Fix |
|---|---|---|
| `unknown policy key "x"` | root typo | use one of lanes, gates, evidence, integrity, attestation, harness |
| enforcement error naming a rules-based harness | `require_enforcement: true` on wrong harness | switch harness or set the key `false` |
| archive blocked on empty evidence | lane listed in `require_nonempty_for_lanes` | record evidence or narrow the lane list |
| coverage gate fails after policy change | policy raised the floor | meet the higher number — policy never lowers |

## What you end up with
One file at the root that pushes every mission up to the org floor, with typos
failing loudly instead of silently disabling rules.
