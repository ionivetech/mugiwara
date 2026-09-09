# What may each role touch?

A reviewer with write access stops reviewing and starts rewriting. Stated boundaries collapse under schedule pressure, so each persona declares the tools its role allows before work starts: auditors narrower than executors, reviewers narrowest.

Example: Chopper audits with read plus inspection shell (`git show`, `git diff`, test re-runs) and writes artifacts under `.mugiwara/` only. Source edits from an auditor account mean the boundary failed, and the trail shows it.

## Declared scopes

Chopper (checkpoint): read plus inspection shell; never writes source. Robin (reviewer): read, grep, glob; no shell, no network, no writes outside artifacts. Brook (healer): read, in-repo write, test and build shell; no network, so new dependencies escalate to Luffy. The pattern extends: scope follows role, and an auditor that edits code is not an auditor.

## Enforcement tiers

Tier 1 harnesses enforce scopes natively; attach the deny snippet to the agent invocation context, keeping read tools available:

```json
{ "permissions": { "deny": ["Write(src/**)", "Edit(src/**)", "WebFetch"] } }
```

Tier 2 and 3 keep the `## Tool scope` section as contract: the model is asked to obey it, and the audit trail shows when it did not. Stated plainly, those tiers have no enforcement, and nothing here pretends otherwise. Check the harness matrix before relying on a boundary. Scoping limits what a persona may touch, never who sees the work: scoped crew still report inline, since unattended hidden work is what mugiwara refuses.
