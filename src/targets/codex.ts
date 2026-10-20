// src/targets/codex.ts
// Codex native layout (OpenAI docs):
//   skills : <repo>/.agents/skills/<name>/SKILL.md  | ~/.agents/skills   (name + description frontmatter)
//   agents : <repo>/.codex/agents/<name>.toml       | ~/.codex/agents    (name, description, developer_instructions required)
// Custom-agent files cannot override sandbox_mode, so write-scope stays prose; no hooks.
import { join } from 'node:path';
import { stringifyFrontmatter, type FrontmatterData } from '../frontmatter.ts';
import type { Target } from '../installer.ts';

const tomlStr = (s: string) => JSON.stringify(s); // JSON string escapes are valid TOML basic strings
const tomlMulti = (s: string) => `"""\n${s.replace(/\\/g, '\\\\').replace(/"""/g, '""\\"')}\n"""`;

export const target: Target = {
  id: 'codex',
  label: 'Codex',
  native: true,
  refPointerPrefix: '../',
  paths({ scope, projectDir, home }) {
    return scope === 'global'
      ? { skillsDir: join(home, '.agents', 'skills'), agentsDir: join(home, '.codex', 'agents') }
      : { skillsDir: join(projectDir, '.agents', 'skills'), agentsDir: join(projectDir, '.codex', 'agents') };
  },
  transformSkill(data: FrontmatterData, body: string) {
    return {
      relPath: join(data.name, 'SKILL.md'),
      text: stringifyFrontmatter({ name: data.name, description: data.description }, body),
    };
  },
  transformAgent(data: FrontmatterData, body: string) {
    return {
      relPath: `${data.name}.toml`,
      text: `name = ${tomlStr(data.name)}\ndescription = ${tomlStr(data.description)}\ndeveloper_instructions = ${tomlMulti(body)}\n`,
    };
  },
  refsDir({ scope, projectDir, home }, skillName: string) {
    const root = scope === 'global' ? join(home, '.agents') : join(projectDir, '.agents');
    return join(root, 'skills', skillName, 'references');
  },
};
