// src/targets/cline.js
import { makeGeneric } from './generic.js';

export const target = makeGeneric({
  id: 'cline',
  label: 'Cline',
  rulesDir: '.clinerules',
  bootstrapFile: null,
  bootstrapPointer: null,
});
