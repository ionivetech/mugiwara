// src/targets/antigravity.js
import { makeGeneric } from './generic.js';

export const target = makeGeneric({
  id: 'antigravity',
  label: 'Antigravity',
  rulesDir: '.agents/rules',
  bootstrapFile: null,
  bootstrapPointer: null,
});
