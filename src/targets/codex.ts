// src/targets/codex.ts
import { makeGeneric } from './generic.ts';

export const target = makeGeneric({
  id: 'codex',
  label: 'Codex',
  rulesDir: '.codex/mugiwara',
  bootstrapFile: 'AGENTS.md',
  bootstrapPointer: 'Mugiwara crew installed in .codex/mugiwara/ — read .codex/mugiwara/mugiwara-workflow.md to run the pipeline.',
});
