---
name: mugiwara-doubt-driven-development
description: Use when an in-flight decision (implementation choice, plan step, estimate, or verdict) is cheap to verify now but costly to reverse later - verify it adversarially in a fresh context before it ships: CLAIM, EXTRACT, DOUBT, RECONCILE, STOP. Find what is wrong, do NOT validate. Bounded rounds, then escalate.
---

# Doubt-driven development

Verify decisions while they are still in-flight — when a wrong call costs minutes to catch and hours to reverse. The default disposition of the person who made the call is self-preferential: it is biased toward its own conclusion. Doubt is the counterweight, and it works best in a fresh context. Never validate. Find what is wrong.

## When to use

- High stakes: the choice touches money, security, data, or a public contract.
- Unfamiliar code: you are deciding inside a subsystem you have not traced end to end.
- Confident outputs: a plan, estimate, or verdict produced fast and asserted smoothly — cheaper to verify now than to discover wrong later.
- Before committing a decision that other agents will build on.

## Process

Run CLAIM → EXTRACT → DOUBT → RECONCILE → STOP in order. Do not skip DOUBT because the claim feels right.

### 1. CLAIM — state the decision

Write the in-flight decision as one falsifiable sentence: what is being decided, and what it promises. A claim you cannot state is a claim you have not understood. Record who decided and when.

### 2. EXTRACT — pull the concrete facts it depends on

Break the claim into its smallest load-bearing facts. A fact is load-bearing when the claim fails if it is false. Facts are specific: a function name, a schema column, an ordering guarantee, a latency budget, an API contract, a count. Name the artifact and the file or scope it lives in. A claim that depends on one unexamined assumption is an unverified claim.

### 3. DOUBT — attack each fact, find what breaks

For each extracted fact, ask: "what must be true for this to hold, and what breaks if it is not?" Attack the fact from the direction it would be wrong: edge inputs, empty states, concurrent calls, upstream changes, naming collisions, contract drift, silent fallbacks. Do NOT hunt for confirmations — a fact that merely looks plausible is not verified. List every way the fact can be false before checking whether any of them is. Doubt in a fresh context: re-derive from the code and docs as if the claim never existed, rather than from the claim's own reasoning.

### 4. RECONCILE — verify against the actual source of truth

Check each doubted fact against the actual code, docs, schema, or measurements — not against the claim's summary of them. Classify every finding: contract-misread (the claim misstates the artifact), actionable (the decision is wrong or needs change), trade-off (defensible, costs known), noise (no signal). Report only the first three. Fix or reject the decision. A decision that survived doubt is not "correct" — it is "still standing after the search."

### 5. STOP — bound the loop, then escalate

The loop has a hard cap: 3 rounds. After the cap, either the claim is reconciled or it is not. If not, STOP and escalate with the unresolved claim — do not restart the loop with new energy and call it rigor. Bounded rounds are the difference between verification and paralysis.

## Rationalizations

| Rationalization | Truth |
| --- | --- |
| "It's obvious, no need to doubt" | Obviousness is a bias signal, not a proof. |
| "The plan says so" | The plan is the claim, not the evidence. |
| "We tested it" | Tests prove only what they cover. |
| "Fresh context costs time" | Wrong decisions cost more; verification is cheapest in-flight. |
| "One more round will settle it" | An unproductive third round means escalate, not a fourth. |
| "I'm just double-checking" | If you are confirming, you are validating. Stop. |

## Red flags

- The claim accepted without extraction of its load-bearing facts.
- A fact checked only in the direction that confirms it.
- Findings from the decider's own context with no fresh-context re-derivation.
- "Verified" reported without classification into contract-misread / actionable / trade-off.
- The loop run past 3 rounds instead of escalating.
- Editing code to "prove" a point — doubt finds, implementers fix.

## Verification

Close with: claim restated, facts extracted, each fact's doubt + reconcile outcome, round count, and escalate-or-resolve. The output is the doubt trail, not a verdict paragraph. A decision with no doubt trail is unverified.

Not `mugiwara-review`: that reviews a finished diff adversarially. This verifies a decision before the diff exists — different artifact, earlier moment, same stance.
