// src/targets/cline.ts
import { makeGeneric } from './generic.ts';

export const target = makeGeneric({
  id: 'cline',
  label: 'Cline',
  rulesDir: '.clinerules',
  bootstrapFile: null,
  bootstrapPointer: null,
});
