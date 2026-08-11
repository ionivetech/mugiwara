---
description: Run the mugiwara crew workflow for a task
---
Mugiwara workflow:

1. The crew runs inline in the main conversation. Start any non-trivial task through `using-mugiwara` (embodied inline) to route to the right crew member.
2. The pipeline flows: Luffy triage -> Usopp brainstorm (when needed) -> Nami planning -> Zoro execution -> Chopper checkpoint -> Sanji quality -> Franky gates -> Robin/Jinbe review -> Brook healing -> Luffy closure.
3. Subagents are used only for parallel work (Zoro's [PARALLEL] workers, Robin + Jinbe concurrent review, independent re-run checks).
4. Switch runtime mode with `/mugiwara-mode` (guided | semi | auto). Default is guided.

See skills/mugiwara-workflow for the full pipeline.
