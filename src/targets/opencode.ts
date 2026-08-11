// src/targets/opencode.ts
import { join } from 'node:path';
import { stringifyFrontmatter, type FrontmatterData } from '../frontmatter.ts';
import type { Target } from '../installer.ts';

export const target: Target = {
  id: 'opencode',
  label: 'opencode',
  native: true,
  paths({ scope, projectDir, home }) {
    const root = scope === 'global' ? join(home, '.config', 'opencode') : join(projectDir, '.opencode');
    return { skillsDir: join(root, 'skills'), agentsDir: join(root, 'agents') };
  },
  transformSkill(data: FrontmatterData, body: string) {
    return {
      relPath: join(data.name, 'SKILL.md'),
      text: stringifyFrontmatter({ name: data.name, description: data.description }, body),
    };
  },
  transformAgent(data: FrontmatterData, body: string) {
    const fm: FrontmatterData = { name: data.name, description: data.description };
    if (data.tools) fm.tools = data.tools;
    return { relPath: `${data.name}.md`, text: stringifyFrontmatter(fm, body) };
  },
  refsDir({ scope, projectDir, home }, skillName: string) {
    const root = scope === 'global' ? join(home, '.config', 'opencode') : join(projectDir, '.opencode');
    return join(root, 'skills', skillName, 'references');
  },
};
