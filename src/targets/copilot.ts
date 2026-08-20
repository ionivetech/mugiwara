// src/targets/copilot.ts
import { join } from 'node:path';
import { stringifyFrontmatter, type FrontmatterData } from '../frontmatter.ts';
import type { Scope } from '../manifest.ts';
import type { Target } from '../installer.ts';

export const target: Target = {
  id: 'copilot',
  label: 'GitHub Copilot',
  native: true,
  paths({ scope, projectDir, home }) {
    const root = scope === 'global' ? join(home, '.copilot') : join(projectDir, '.github');
    return { skillsDir: join(root, 'instructions'), agentsDir: join(root, 'agents') };
  },
  // Copilot injects EVERY matching instruction file into EVERY request — so
  // the full corpus (26 files, ~27k tokens) was per-request cost, not
  // per-session. Ship a routing stub here and park the full body in the
  // per-skill refs dir, which the agent reads on demand. applyTo stays '**/*'
  // so the routing line is always present; it is a few lines, not a skill.
  transformSkill(data: FrontmatterData, body: string) {
    void body;
    return {
      relPath: `${data.name}.instructions.md`,
      text: stringifyFrontmatter(
        { description: data.description, applyTo: '**/*' },
        `# ${data.name}

> ${data.description}

Full skill: read \`.mugiwara/refs/${data.name}/${data.name}.md\` when the crew invokes this role.`,
      ),
    };
  },
  transformSkillFull(data: FrontmatterData, body: string) {
    return {
      relPath: `${data.name}.md`,
      text: stringifyFrontmatter({ description: data.description }, body),
    };
  },
  transformAgent(data: FrontmatterData, body: string) {
    return {
      relPath: `${data.name}.md`,
      text: stringifyFrontmatter({ name: data.name, description: data.description }, body),
    };
  },
  refsDir(_opts: { scope: Scope; projectDir: string; home: string }, skillName: string) {
    return join(_opts.projectDir, '.mugiwara', 'refs', skillName);
  },
};
