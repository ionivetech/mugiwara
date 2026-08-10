// src/targets/generic.ts
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Target } from '../installer.ts';

export function makeGeneric(opts: {
  id: string;
  label: string;
  rulesDir: string;
  bootstrapFile: string | null;
  bootstrapPointer: string | null;
}): Target {
  const { id, label, rulesDir, bootstrapFile, bootstrapPointer } = opts;
  return {
    id,
    label,
    native: false,
    paths({ scope, projectDir }: { scope: 'global' | 'project'; projectDir: string; home: string }) {
      if (scope === 'global') throw new Error(`${label} supports project scope only`);
      const dir = join(projectDir, rulesDir);
      return { skillsDir: dir, agentsDir: dir };
    },
    transformSkill(data, body) {
      return { relPath: `${data.name}.md`, text: `# ${data.name}\n\n> ${data.description}\n\n${body}` };
    },
    transformAgent(data, body) {
      return { relPath: `agent-${data.name}.md`, text: `# Agent: ${data.name}\n\n> ${data.description}\n\nSkills used: ${data.skills ?? ''}\n\n${body}` };
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
