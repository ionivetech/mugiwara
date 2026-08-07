// src/targets/kilo.js
import { makeGeneric } from './generic.js';

export const target = makeGeneric({
  id: 'kilo',
  label: 'Kilo Code',
  rulesDir: '.kilo/rules',
  bootstrapFile: 'kilo.jsonc',
  bootstrapPointer: '{\n  "instructions": [\n    ".kilo/rules/*.md"\n  ]\n}',
});
