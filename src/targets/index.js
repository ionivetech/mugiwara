// src/targets/index.js
import { target as claude } from './claude.js';
import { target as opencode } from './opencode.js';
import { target as copilot } from './copilot.js';
import { target as gemini } from './gemini.js';
import { target as codex } from './codex.js';
import { target as windsurf } from './windsurf.js';
import { target as cline } from './cline.js';
import { target as kilo } from './kilo.js';
import { target as antigravity } from './antigravity.js';

export const targets = { claude, opencode, copilot, gemini, codex, windsurf, cline, kilo, antigravity };
export const TARGET_IDS = Object.keys(targets);
