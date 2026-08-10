// src/targets/windsurf.ts
import { makeGeneric } from './generic.ts';

export const target = makeGeneric({
  id: 'windsurf',
  label: 'Windsurf',
  rulesDir: '.devin/rules',
  bootstrapFile: null,
  bootstrapPointer: null,
});
