// src/targets/copilot.ts
import { join } from 'node:path';
import { stringifyFrontmatter, type FrontmatterData } from '../frontmatter.ts';
import type { Target } from '../installer.ts';

export const target: Target = {
  id: 'copilot',
  label: 'GitHub Copilot',
  native: true,
  paths({ scope, projectDir, home }) {
    const root = scope === 'global' ? join(home, '.copilot') : join(projectDir, '.github');
    return { skillsDir: join(root, 'instructions'), agentsDir: join(root, 'agents') };
  },
  transformSkill(data: FrontmatterData, body: string) {
    return {
      relPath: `${data.name}.instructions.md`,
      text: stringifyFrontmatter({ description: data.description, applyTo: '**/*' }, body),
    };
  },
  transformAgent(data: FrontmatterData, body: string) {
    return {
      relPath: `${data.name}.md`,
      text: stringifyFrontmatter({ name: data.name, description: data.description }, body),
    };
  },
};
