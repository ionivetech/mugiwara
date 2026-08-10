// src/targets/kilo.ts
import { makeGeneric } from './generic.ts';

export const target = makeGeneric({
  id: 'kilo',
  label: 'Kilo Code',
  rulesDir: '.kilo/rules',
  bootstrapFile: 'kilo.jsonc',
  bootstrapPointer: '{\n  "instructions": [\n    ".kilo/rules/*.md"\n  ]\n}',
});
