// src/targets/copilot.js
import { join } from 'node:path';
import { stringifyFrontmatter } from '../frontmatter.js';

export const target = {
  id: 'copilot',
  label: 'GitHub Copilot',
  native: true,
  paths({ scope, projectDir, home }) {
    const root = scope === 'global' ? join(home, '.copilot') : join(projectDir, '.github');
    return { skillsDir: join(root, 'instructions'), agentsDir: join(root, 'agents') };
  },
  transformSkill(data, body) {
    return {
      relPath: `${data.name}.instructions.md`,
      text: stringifyFrontmatter({ description: data.description, applyTo: '**/*' }, body),
    };
  },
  transformAgent(data, body) {
    return {
      relPath: `${data.name}.md`,
      text: stringifyFrontmatter({ name: data.name, description: data.description }, body),
    };
  },
};
