// src/targets/opencode.js
import { join } from 'node:path';
import { stringifyFrontmatter } from '../frontmatter.js';

export const target = {
  id: 'opencode',
  label: 'opencode',
  native: true,
  paths({ scope, projectDir, home }) {
    const root = scope === 'global' ? join(home, '.config', 'opencode') : join(projectDir, '.opencode');
    return { skillsDir: join(root, 'skills'), agentsDir: join(root, 'agents') };
  },
  transformSkill(data, body) {
    return {
      relPath: join(data.name, 'SKILL.md'),
      text: stringifyFrontmatter({ name: data.name, description: data.description }, body),
    };
  },
  transformAgent(data, body) {
    const fm = { name: data.name, description: data.description };
    if (data.tools) fm.tools = data.tools;
    return { relPath: `${data.name}.md`, text: stringifyFrontmatter(fm, body) };
  },
};
