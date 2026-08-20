// src/targets/generic.ts
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Scope } from '../manifest.ts';
import type { Target } from '../installer.ts';

export function makeGeneric(opts: {
  id: string;
  label: string;
  rulesDir: string;
  bootstrapFile: string | null;
  bootstrapPointer: string | null;
  tier?: 2 | 3;
}): Target {
  const { id, label, rulesDir, bootstrapFile, bootstrapPointer, tier = bootstrapPointer ? 2 : 3 } = opts;
  const stubOnly = tier === 3;
  return {
    id,
    label,
    native: false,
    tier,
    paths({ scope, projectDir }: { scope: 'global' | 'project'; projectDir: string; home: string }) {
      if (scope === 'global') throw new Error(`${label} supports project scope only`);
      const dir = join(projectDir, rulesDir);
      return { skillsDir: dir, agentsDir: dir };
    },
    transformSkill(data, body) {
      if (stubOnly) {
        // Stub: routing + pointer only. Full body lands in .mugiwara/refs/
        // (outside the rules glob) so glob-loading harnesses stop eating ~40k
        // tokens at session start. The agent reads the full file on demand.
        return {
          relPath: `${data.name}.md`,
          text: `# ${data.name}\n\n> ${data.description}\n\n## Skip when\n\nFull skill: \`${data.name}\` — read \`.mugiwara/refs/${data.name}/${data.name}.md\` when the crew invokes this role.`,
        };
      }
      return { relPath: `${data.name}.md`, text: `# ${data.name}\n\n> ${data.description}\n\n${body}` };
    },
    transformSkillFull(data, body) {
      if (!stubOnly) return null;
      return { relPath: `${data.name}.md`, text: `# ${data.name}\n\n> ${data.description}\n\n${body}` };
    },
    transformAgent(data, body) {
      if (stubOnly) {
        return {
          relPath: `agent-${data.name}.md`,
          text: `# Agent: ${data.name}\n\n> ${data.description}\n\nSkills: ${data.skills ?? ''}. Read \`.mugiwara/refs/${data.name}/${data.name}.md\` when embodying this role.\n\nOnly zoro-execution and brook-healing may modify source code.\nReturn your output to luffy-orchestrator; do not choose the next step.`,
        };
      }
      return { relPath: `agent-${data.name}.md`, text: `# Agent: ${data.name}\n\n> ${data.description}\n\nSkills used: ${data.skills ?? ''}\n\n${body}` };
    },
    transformAgentFull(data, body) {
      if (!stubOnly) return null;
      return { relPath: `${data.name}.md`, text: `# Agent: ${data.name}\n\n> ${data.description}\n\nSkills used: ${data.skills ?? ''}\n\n${body}` };
    },
    refsDir({ projectDir }: { scope: Scope; projectDir: string; home: string }, skillName: string) {
      // Keep reference detail outside the rules dir so the harness never
      // glob-loads it; the skill names the path and the agent reads on demand.
      // Per-skill subdir is load-bearing, not tidiness: a flat refs dir let
      // same-named references collide (agent-security/checklist.md vs
      // frontend/checklist.md, contract-first/process.md vs
      // root-cause/process.md) and first-writer-wins silently served the
      // wrong document to the skill that asked for it.
      return join(projectDir, '.mugiwara', 'refs', skillName);
    },
    postInstall({ projectDir, dryRun }) {
      if (!bootstrapFile) return { written: [], notes: [] };
      const notes: string[] = [];
      const written: string[] = [];
      const file = join(projectDir, bootstrapFile);
      if (!existsSync(file)) {
        if (!dryRun) writeFileSync(file, `${bootstrapPointer}\n`);
        written.push(file);
      } else {
        notes.push(`add this line to ${bootstrapFile} so the agent finds the crew: "${bootstrapPointer}"`);
      }
      return { written, notes };
    },
  };
}
