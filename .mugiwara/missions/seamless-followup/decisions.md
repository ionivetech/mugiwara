# Decisions — seamless-followup

## Flow 0 — triage (Luffy)

**Classification:** Explicit (follow-up 4 fixes from user audit)
**Lane:** Full (8+ files, 4 waves)
**Mode:** auto · solo (from P0 seamless-governors, user solo)
**Route:** → Flow 2 Planning (explicit) → Flow 3 Execute (Zoro)
**Actor:** AI: muse-spark-1.2-contributor-free
**Reason:** 4 tasks file-disjoint within wave, need Nami plan then Zoro

## Flow 0 — P0 Solo/Team gate

**Answer:** solo (inherited from seamless-governors, user solo) — state.json solo

## Flow 3 — Zoro (Execution) Wave 1

**Mode:** auto · **Branch:** feat/seamless-followup · **Commit:** conventional · **auto_commit:** on — auto always commits, branch from config `branch=feature/{type}-{issue}-{slug}` resolved to `feat/seamless-followup`.
**Tasks:** T1 Todos sync + T2 Banner all crews — inline sequential, no `[PARALLEL]` (shared files would conflict).
**Cost governor:** ladder reuse→stdlib→native→installed→one line→code — reuse existing `Host todo mirrors` + `Banners` lines, minimal diff 3 files + 1 reference; no new dep, no abstraction.
**Actor:** AI: muse-spark-1.2-contributor-free
