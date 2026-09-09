# Adversarial depth — doubt-driven verification inside the audit

Folded from `mugiwara-claim-audit` (removed): one skill, two depths. The
checklist above audits finished work; this pass verifies a decision while it
is still in-flight — when a wrong call costs minutes to catch and hours to
reverse. The default disposition of the decider is self-preferential: biased
toward its own conclusion. Doubt is the counterweight, and it works best in a
fresh context. Never validate. Find what is wrong.

## When to use (beyond the standard audit)

- High stakes: money, security, data, or a public contract at stake.
- Unfamiliar code: deciding inside a subsystem not traced end to end.
- Confident outputs: a plan, estimate, or verdict produced fast and asserted
  smoothly — cheaper to verify now than to discover wrong later.
- Before committing a decision other agents will build on.
- Skip when: cheap to reverse; already independently verified (fresh review,
  real test run, external check).

## Process — CLAIM → EXTRACT → DOUBT → RECONCILE → STOP, in order

### 1. CLAIM — state the decision

One falsifiable sentence: what is decided, what it promises. A claim you
cannot state is a claim you have not understood. Record who decided and when.

### 2. EXTRACT — pull the load-bearing facts

Break the claim into its smallest facts; a fact is load-bearing when the
claim fails if it is false. Facts are specific: function name, schema column,
ordering guarantee, latency budget, API contract, count. Name the artifact
and file. A claim on one unexamined assumption is unverified.

### 3. DOUBT — attack each fact, find what breaks

"What must be true for this to hold, and what breaks if not?" Attack from the
direction it would be wrong: edge inputs, empty states, concurrent calls,
upstream changes, naming collisions, contract drift, silent fallbacks. Do NOT
hunt confirmations. List every way the fact can be false first. Re-derive
from code and docs as if the claim never existed. Never skip DOUBT because
the claim feels right.

### 4. RECONCILE — verify against the source of truth

Check each doubted fact against actual code, docs, schema, measurements — not
the claim's summary. Classify: contract-misread, actionable, trade-off,
noise. Report the first three. Fix or reject. A surviving decision is not
"correct" — it is "still standing after the search."

### 5. STOP — cap 3 rounds, then escalate

After the cap the claim is reconciled or it is not. If not, STOP and escalate
with the unresolved claim — never restart and call it rigor.

## Rationalizations

| Rationalization | Truth |
| --- | --- |
| "It's obvious, no need to doubt" | Obviousness is a bias signal, not proof. |
| "The plan says so" | The plan is the claim, not the evidence. |
| "We tested it" | Tests prove only what they cover. |
| "Fresh context costs time" | Wrong decisions cost more. |
| "One more round will settle it" | Unproductive third round means escalate. |
| "I'm just double-checking" | Confirming is validating. Stop. |

## Red flags (adversarial)

- Claim accepted without extracting load-bearing facts.
- A fact checked only in the confirming direction.
- Findings from the decider's own context, no fresh re-derivation.
- "Verified" without classification.
- Past 3 rounds instead of escalating.
- Editing code to "prove" a point — doubt finds, implementers fix.

## Verification output

Claim restated, facts extracted, each fact's doubt + reconcile outcome, round
count, escalate-or-resolve. The output is the doubt trail, not a verdict
paragraph. A decision with no doubt trail is unverified.

Not `mugiwara-review`: that reviews a finished diff adversarially. This
verifies a decision before the diff exists — different artifact, earlier
moment, same stance.
