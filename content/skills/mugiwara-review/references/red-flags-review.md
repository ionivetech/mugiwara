# Red Flags — Review

- The diff reviewed without a damage map first.
- A CL >400 LOC reviewed in place instead of split.
- The implementer's claim accepted without adversarial re-derivation.
- A changed public symbol (export, function, route, config key, CLI flag, DB schema, env var, event, message format) not checked for callers.
- A damage map incomplete: changed symbols with no caller grep, or callers not all checked.
- Behavior drift unflagged: altered behavior outside the declared scope passed as benign.
- A public-break with no migration path reported as anything but a blocker.
- A severity without criteria backing it, or findings without `path:line`.
- Deep security concerns re-reviewed here instead of handed to the security review.
- A blocker/major merged without the owner's acknowledgement.
- Ego over evidence: holding a finding after the implementer showed the code is correct.
- The same claim cycled more than 3 times without stopping or escalating.
- Echoing raw output when `verbosity=normal` — summarize and cite the evidence path.

All mean: the review missed its job. Go back and map before you report.
