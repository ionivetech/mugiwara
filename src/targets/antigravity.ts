// src/targets/antigravity.ts
import { makeGeneric } from './generic.ts';

export const target = makeGeneric({
  id: 'antigravity',
  label: 'Antigravity',
  rulesDir: '.agents/rules',
  bootstrapFile: null,
  bootstrapPointer: null,
});
