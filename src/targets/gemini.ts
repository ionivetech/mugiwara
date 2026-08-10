// src/targets/gemini.ts
import { makeGeneric } from './generic.ts';

export const target = makeGeneric({
  id: 'gemini',
  label: 'Gemini',
  rulesDir: '.gemini/mugiwara',
  bootstrapFile: 'GEMINI.md',
  bootstrapPointer: 'Mugiwara crew installed in .gemini/mugiwara/ — read .gemini/mugiwara/mugiwara-workflow.md to run the pipeline.',
});
