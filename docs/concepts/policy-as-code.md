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

Glob semantics: `**` crosses directories (`src/auth/**` matches
`src/auth/deep/x.ts`), `*` stays within one segment.

## Parser honesty

The bundled reader accepts a deliberate subset — nested maps, string arrays,
scalars, comments. It has no dependency and no YAML edge-case support beyond
that. If you need anchors or multi-line strings, keep the policy boring.
