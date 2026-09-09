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
