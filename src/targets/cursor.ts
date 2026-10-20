// src/targets/cursor.ts
// Cursor native layout (cursor.com/docs/context/skills, /docs/subagents):
//   skills : .cursor/skills/<name>/SKILL.md   (name must match folder; description required)
//   agents : .cursor/agents/<name>.md         (frontmatter name, description, model, readonly, is_background)
// `readonly: true` blocks ALL edits, which would also block .mugiwara/** artifacts, so it is not used:
// write-scope stays prose. No hooks.
import { join } from 'node:path';
import { stringifyFrontmatter, type FrontmatterData } from '../frontmatter.ts';
import type { Target } from '../installer.ts';

const root = (scope: string, projectDir: string, home: string) => join(scope === 'global' ? home : projectDir, '.cursor');

export const target: Target = {
  id: 'cursor',
  label: 'Cursor',
  native: true,
  refPointerPrefix: '../',
  paths({ scope, projectDir, home }) {
    const r = root(scope, projectDir, home);
    return { skillsDir: join(r, 'skills'), agentsDir: join(r, 'agents') };
  },
  transformSkill(data: FrontmatterData, body: string) {
    return {
      relPath: join(data.name, 'SKILL.md'),
      text: stringifyFrontmatter({ name: data.name, description: data.description }, body),
    };
  },
  transformAgent(data: FrontmatterData, body: string) {
    return {
      relPath: `${data.name}.md`,
      text: stringifyFrontmatter({ name: data.name, description: data.description, model: 'inherit' }, body),
    };
  },
  refsDir({ scope, projectDir, home }, skillName: string) {
    return join(root(scope, projectDir, home), 'skills', skillName, 'references');
  },
};
