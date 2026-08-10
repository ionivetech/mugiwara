// src/targets/index.ts
import type { Target } from '../installer.ts';
import { target as claude } from './claude.ts';
import { target as opencode } from './opencode.ts';
import { target as copilot } from './copilot.ts';
import { target as gemini } from './gemini.ts';
import { target as codex } from './codex.ts';
import { target as windsurf } from './windsurf.ts';
import { target as cline } from './cline.ts';
import { target as kilo } from './kilo.ts';
import { target as antigravity } from './antigravity.ts';

export const targets: Record<string, Target> = { claude, opencode, copilot, gemini, codex, windsurf, cline, kilo, antigravity };
export const TARGET_IDS = Object.keys(targets);
