// src/targets/generic.js
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function makeGeneric({ id, label, rulesDir, bootstrapFile, bootstrapPointer }) {
  return {
    id,
    label,
    native: false,
    paths({ scope, projectDir }) {
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
      const notes = [];
      const written = [];
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
