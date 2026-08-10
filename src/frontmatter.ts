// src/frontmatter.ts
// Typed wrapper over src/frontmatter.js — the JS file is the single source of
// truth because scripts/validate-content.mjs (kept as-is) imports it.
import { parseFrontmatter as _parse, stringifyFrontmatter as _stringify } from './frontmatter.js';

export type FrontmatterData = Record<string, string>;

export const parseFrontmatter: (text: string) => { data: FrontmatterData; body: string } = _parse;
export const stringifyFrontmatter: (data: FrontmatterData, body: string) => string = _stringify;
