# Plan amendments mid-execution

The plan is Nami's contract; Zoro never edits it directly. When execution
proves the plan wrong (a root cause the plan missed, a task impossible as
written — not a contradiction, which escalates to Luffy), run this loop:

1. **Propose** — to Nami, with evidence (failing command + output) and the
   exact plan diff (task text before → after, no other lines touched).
2. **Approve** — Nami accepts, rejects, or counters. No approval, no change;
   the blocked task waits, other waves continue if disjoint.
3. **Version** — Nami writes the new plan text and appends one row to
   `decisions.md` (what changed, evidence, approver). The old text stays in
   git history — never rewrite, only amend forward.
4. **Continue** — Zoro resumes from the amended task; the amendment row is
   cited in the execution log next to the task's evidence.

Rules: one amendment per proposal (bundled plan rewrites are rejected);
an amendment never widens scope — new scope is a new task via Luffy, not a
silent edit. Emergency (blocked pipeline, fix obvious and tiny): apply,
then file the proposal within the same wave — forgiveness once, never twice.

## The widening test (apply before calling anything an amendment)

"Never widens scope" is felt, not measured, and a felt boundary moves under
pressure. It is an amendment only if ALL THREE hold; any one failing makes it
new scope, which goes to Luffy as a new task:

1. **Files** — every file it touches is already on the task's `Files` line.
   One path not listed there is new scope, however small the edit.
2. **Size** — the task's `Size` class is unchanged. An S that becomes an M is
   a different task wearing the same number.
3. **Acceptance** — the task's acceptance criterion still decides it. If the
   criterion has to be rewritten to cover the change, the change is not what
   the plan approved.

Worked: a task planned as "align one agent's entry block" that turns out to
need the same edit in thirteen agents fails test 1 and test 2. It is a real
finding and the right fix, and it is still a new task — route it, log it,
then do it. Recording it as an amendment is how a 1-file task quietly becomes
a 13-file one with nobody's approval on the difference.

## When the criterion cannot decide

A task whose acceptance turns out to be unverifiable as written (the command
does not exist, the check cannot fail, the criterion was already true before
the task ran) is not "done" and not "blocked" — it is an amendment candidate.
Propose the criterion that would actually decide it, with the evidence that
the written one cannot. Never pass a task on a criterion that could not have
failed.
