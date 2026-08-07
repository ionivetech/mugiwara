// src/targets/windsurf.js
import { makeGeneric } from './generic.js';

export const target = makeGeneric({
  id: 'windsurf',
  label: 'Windsurf',
  rulesDir: '.devin/rules',
  bootstrapFile: null,
  bootstrapPointer: null,
});
