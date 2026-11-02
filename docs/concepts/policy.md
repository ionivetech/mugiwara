# Policy file

Team rules spoken in chat evaporate, and the next mission rediscovers that migrations need the full pipeline. A policy file puts those rules in one place every mission reads. This page holds the full schema and the one rule behind it.

Example: the org wants payments always reviewed in full, 90% coverage on new code, and no run on a tool that cannot enforce rules. One optional file at the repo root, `mugiwara.policy.yml`:

```yaml
lanes:
  force_full: ["src/payments/**", "**/migrations/**"]
gates:
  coverage:
    new: 90
    modified: 90
  require_human_approval: ["src/payments/**"]
evidence:
  require_nonempty_for_lanes: [standard, full]
harness:
  require_enforcement: true
```

Rule: policy only pushes up, never down. A forced lane can raise standard to full and can never shrink a sensitive-path escalation. A coverage threshold is the higher of the config value and the policy value, so `modified: 80` under the default of 85 changes nothing. No file means no change in behavior: no config key, no flag, no daemon. An unknown top-level key fails loudly, so a typo cannot silently turn off the rule it carried.

```
unknown policy key "bogus_key" (known: lanes, gates, evidence, integrity, attestation, harness)
```

## Schema

- `lanes.force_full`: list of globs. Any changed file that matches sends the mission to the full lane, and the reason records the glob. `**` crosses directories, `*` stays within one.
- `gates.coverage.new` and `gates.coverage.modified`: numbers. Raise the coverage gate. The gate prints the policy value when it is the one that binds.
- `gates.require_human_approval`: list of globs. Matching paths are listed in the gate output and need a human sign-off before shipping.
- `evidence.require_nonempty_for_lanes`: list of lanes. On those lanes an empty evidence set blocks archive instead of warning.
- `evidence.required`: list of evidence kinds such as `test` or `lint`. The file parser accepts it, and no script blocks on it today, so treat it as a note to the crew.
- `integrity.extra_secret_patterns`: list of `{ pattern, label, severity }` added to the archive secret scan. Severity is `block` or `warn`.
- `harness.require_enforcement`: `true` refuses to run on a platform that cannot enforce rules at runtime. Only opencode passes today. Claude Code and the rest are refused with `harness enforcement required but current harness is rules-based only`, so use opencode or set the key to `false`.
- `attestation`: report-signing rules. These belong to the optional signing add-on, see [signing](../optional/signing.md).

Platform detection reads environment variables (opencode and Claude Code set their own) and falls back to `.opencode/config.json`. The reader accepts a deliberate YAML subset: nested maps, string lists, scalars and comments, with no dependencies. Anchors and multi-line strings are not supported, so keep the file plain.

## Roll it out

1. Create the file, commit it and agree the numbers with the team.
2. Run a mission and check the effect. `mugiwara status` prints the lane with its reason, and `mugiwara cost --ledger` shows what a higher lane costs.
3. When a gate fails after a policy change, meet the higher number. Policy never lowers anything.
4. When archive blocks on empty evidence, record evidence or narrow `require_nonempty_for_lanes`.
