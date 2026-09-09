# What is an agent made of?

A new crew member written freehand drifts: missing summon line, no boundary, output landing nowhere. The fixed skeleton below keeps every agent readable the same way, so authors fill slots instead of inventing shape.

Example: Chopper's file opens with frontmatter naming `chopper-checkpoint`, its audit description, and its held skill, then a Role section stating "auditor, never fixes code". Any reader knows in seconds when to summon it and what it will not do.

```markdown
---
name: chopper-checkpoint
description: Audit flow-stage results against the plan and issue a Definition-of-Done verdict. Auditor only; never fixes code.
skills: mugiwara-checkpoint
---
```

## Frontmatter fields

`name` is required: lowercase hyphenated, matching the file name. `description` is required and states what the agent does plus when to summon it. `skills` is optional: the held crew skills, comma-separated. Harnesses may add their own keys in their installed copy; content stays portable.

## Body skeleton

Role states the work and the boundary never crossed. Experience gives a one-line persona for model instincts. Dispatch states the flow stage and inputs. Rules stay numbered, each an action bound to its reason, deferring to the held skill for protocol. Output names the artifact path and route. Red flags name behaviors proving the member stopped doing its job.

A skill is the reusable playbook; an agent is the persona applying it. One agent may hold many skills, and the main thread embodies the persona inline by loading them. Validation runs with the skill checks; see [developer onboarding](developer-onboarding.md).
