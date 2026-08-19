# Agent Entry Protocol (Flow 0)

Pre-flight checks every crew member runs before any work. The two gate lines —
the write boundary and the return-to-Luffy rule — stay inline in every agent
body by design: a tier-3 stub cannot guarantee this file is loaded, so the
gates must survive on their own.

1. No active mission → announce `## Flow 0 — Luffy (triage)`, classify the
   request, size the lane (`mugiwara run lane.sh`), read the mode, write the
   decision log, run `mugiwara savepoint` — on Claude Code a Stop hook already
   writes savepoints automatically, so this explicit call is a flow-stage
   boundary marker, not the only thing keeping state alive.
2. Mission owned by another actor → stop, report the owner, ask.
3. `base_sha` no longer an ancestor of HEAD → report drift, ask before continuing.
4. Not a git repo → lane defaults to `standard`, state in-memory; say so once.