#!/usr/bin/env node
// @bun
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);

// src/home.ts
import { homedir } from "node:os";
function homeDir() {
  if (process.platform !== "win32") {
    const h = process.env.HOME?.trim();
    if (h)
      return h;
  }
  return homedir();
}
var init_home = () => {};

// src/policy.ts
import { existsSync as existsSync6, readFileSync as readFileSync4 } from "node:fs";
import { join as join6 } from "node:path";
function parsePolicyYaml(text) {
  const root = {};
  const stack = [{ keyIndent: -1, obj: root }];
  const lines = text.split(/\r?\n/);
  const process2 = (i) => {
    if (i >= lines.length)
      return;
    const noComment = lines[i].replace(/(^|\s)#.*$/, "");
    if (!noComment.trim())
      return process2(i + 1);
    const indent = noComment.length - noComment.trimStart().length;
    const line = noComment.trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].keyIndent)
      stack.pop();
    const top = stack[stack.length - 1];
    if (top.pending && !line.startsWith("- ") && indent > top.pending.indent && !Array.isArray(top.obj[top.pending.key])) {
      const { key: key2, indent: pIndent } = top.pending;
      delete top.pending;
      const created = {};
      top.obj[key2] = created;
      stack.push({ keyIndent: pIndent, obj: created });
      return process2(i);
    }
    if (line.startsWith("- ")) {
      if (top.pending) {
        const existing = top.obj[top.pending.key];
        const arr = Array.isArray(existing) ? existing : [];
        arr.push(scalar(line.slice(2)));
        top.obj[top.pending.key] = arr;
      }
      return process2(i + 1);
    }
    const colon = line.indexOf(":");
    if (colon === -1)
      return process2(i + 1);
    const key = line.slice(0, colon).trim();
    const rest = line.slice(colon + 1).trim();
    if (rest === "") {
      top.pending = { key, indent };
    } else {
      top.obj[key] = scalar(rest);
      delete top.pending;
    }
    process2(i + 1);
  };
  process2(0);
  return root;
}
function scalar(v) {
  const t = v.trim().replace(/^["']|["']$/g, "");
  if (/^-?\d+(\.\d+)?$/.test(t))
    return Number(t);
  if (t === "true")
    return true;
  if (t === "false")
    return false;
  if (t.startsWith("[") && t.endsWith("]"))
    return splitFlowArray(t.slice(1, -1));
  return t;
}
function splitFlowArray(body) {
  const out = [];
  let cur = "";
  let quote = null;
  let depth = 0;
  const push = () => {
    const s = cur.trim();
    if (s)
      out.push(scalar(s));
    cur = "";
  };
  for (const ch of body) {
    if (quote) {
      cur += ch;
      if (ch === quote)
        quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === "{") {
      depth++;
      cur += ch;
    } else if (ch === "}") {
      depth = Math.max(0, depth - 1);
      cur += ch;
    } else if (ch === "," && depth === 0) {
      push();
    } else {
      cur += ch;
    }
  }
  push();
  return out;
}
function extractExtraSecretPatterns(text) {
  const lines = text.split(/\r?\n/);
  let inBlock = false;
  let baseIndent = -1;
  const out = [];
  let current = null;
  let currentIndent = -1;
  for (const rawLine of lines) {
    const noComment = rawLine.replace(/(^|\s)#.*$/, "");
    if (!noComment.trim())
      continue;
    const indent = noComment.length - noComment.trimStart().length;
    const trimmed = noComment.trim();
    if (!inBlock) {
      if (trimmed.startsWith("extra_secret_patterns:")) {
        inBlock = true;
        baseIndent = indent;
        continue;
      }
    } else {
      if (indent <= baseIndent && !trimmed.startsWith("-") && trimmed.includes(":")) {
        break;
      }
      if (trimmed.startsWith("-")) {
        if (current)
          out.push(current);
        current = {};
        currentIndent = indent;
        const afterDash = trimmed.slice(1).trim();
        if (!afterDash)
          continue;
        if (afterDash.startsWith("{") && afterDash.endsWith("}")) {
          const inner = afterDash.slice(1, -1);
          for (const part of inner.split(",")) {
            const colon = part.indexOf(":");
            if (colon === -1)
              continue;
            const k = part.slice(0, colon).trim();
            const v = part.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
            if (k && v)
              current[k] = v;
          }
        } else if (afterDash.includes(":")) {
          const colon = afterDash.indexOf(":");
          const k = afterDash.slice(0, colon).trim();
          const v = afterDash.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
          if (k && v)
            current[k] = v;
        } else {
          const v = afterDash.replace(/^["']|["']$/g, "");
          if (v)
            current["pattern"] = v;
        }
      } else if (current && trimmed.includes(":")) {
        if (indent > currentIndent) {
          const colon = trimmed.indexOf(":");
          const k = trimmed.slice(0, colon).trim();
          const v = trimmed.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
          if (k && v)
            current[k] = v;
        } else if (indent <= baseIndent) {
          break;
        }
      }
    }
  }
  if (current)
    out.push(current);
  return out.filter((o) => typeof o.pattern === "string" && typeof o.label === "string" && o.pattern.length > 0);
}
function extractAttestation(text) {
  const lines = text.split(/\r?\n/);
  let attBase = -1;
  let inAtt = false;
  let required;
  const trusted = [];
  const revoked = [];
  let collecting = null;
  let collectBase = -1;
  let current = null;
  let curIndent = -1;
  const flush = () => {
    if (!current)
      return;
    if (collecting === "trusted")
      trusted.push(current);
    else if (collecting === "revoked")
      revoked.push(current);
    current = null;
  };
  for (let idx = 0;idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const noComment = rawLine.replace(/(^|\s)#.*$/, "");
    if (!noComment.trim())
      continue;
    const indent = noComment.length - noComment.trimStart().length;
    const trimmed = noComment.trim();
    if (!inAtt) {
      if (trimmed === "attestation:" || trimmed.startsWith("attestation:")) {
        const after = trimmed.slice("attestation:".length).trim();
        if (after.startsWith("{")) {
          return null;
        }
        inAtt = true;
        attBase = indent;
        continue;
      }
      continue;
    }
    if (indent <= attBase && !trimmed.startsWith("-") && trimmed.includes(":")) {
      flush();
      break;
    }
    if (collecting) {
      if (indent <= collectBase && !trimmed.startsWith("-") && trimmed.includes(":")) {
        flush();
        collecting = null;
      } else if (trimmed.startsWith("-")) {
        flush();
        current = {};
        curIndent = indent;
        const afterDash = trimmed.slice(1).trim();
        if (!afterDash)
          continue;
        if (afterDash.startsWith("{") && afterDash.endsWith("}")) {
          const inner = afterDash.slice(1, -1);
          for (const part of inner.split(",")) {
            const colon = part.indexOf(":");
            if (colon === -1)
              continue;
            const k = part.slice(0, colon).trim();
            const v = part.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
            if (k && v)
              current[k] = v;
          }
        } else if (afterDash.includes(":")) {
          const colon = afterDash.indexOf(":");
          const k = afterDash.slice(0, colon).trim();
          const v = afterDash.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
          if (k && v)
            current[k] = v;
        } else {
          const v = afterDash.replace(/^["']|["']$/g, "");
          if (v)
            current["id"] = v;
        }
        continue;
      } else if (current && trimmed.includes(":")) {
        if (indent > curIndent) {
          const colon = trimmed.indexOf(":");
          const k = trimmed.slice(0, colon).trim();
          const v = trimmed.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
          if (k && v)
            current[k] = v;
          continue;
        }
      }
      if (collecting)
        continue;
    }
    if (trimmed.startsWith("required:")) {
      const v = trimmed.slice("required:".length).trim().replace(/^["']|["']$/g, "");
      if (v === "true")
        required = true;
      else if (v === "false")
        required = false;
      continue;
    }
    if (trimmed.startsWith("trusted_keys:")) {
      const after = trimmed.slice("trusted_keys:".length).trim();
      if (after === "[]")
        continue;
      collecting = "trusted";
      collectBase = indent;
      current = null;
      continue;
    }
    if (trimmed.startsWith("revoked:")) {
      const after = trimmed.slice("revoked:".length).trim();
      if (after === "[]")
        continue;
      collecting = "revoked";
      collectBase = indent;
      current = null;
      continue;
    }
  }
  flush();
  if (required === undefined && trusted.length === 0 && revoked.length === 0)
    return null;
  const out = {};
  if (required !== undefined)
    out.required = required;
  if (trusted.length)
    out.trusted_keys = trusted;
  if (revoked.length)
    out.revoked = revoked;
  return out;
}
function loadPolicy(projectDir) {
  for (const name of POLICY_FILES) {
    const file = join6(projectDir, name);
    if (!existsSync6(file))
      continue;
    const text = readFileSync4(file, "utf8");
    const raw = parsePolicyYaml(text);
    const extra = extractExtraSecretPatterns(text);
    if (extra.length) {
      if (!raw.integrity || typeof raw.integrity !== "object" || Array.isArray(raw.integrity))
        raw.integrity = {};
      raw.integrity.extra_secret_patterns = extra;
    }
    const att = extractAttestation(text);
    if (att) {
      if (!raw.attestation || typeof raw.attestation !== "object" || Array.isArray(raw.attestation))
        raw.attestation = {};
      const a = raw.attestation;
      if (att.required !== undefined)
        a.required = att.required;
      if (att.trusted_keys)
        a.trusted_keys = att.trusted_keys;
      if (att.revoked)
        a.revoked = att.revoked;
    }
    return normalize(raw);
  }
  return null;
}
function normalize(raw) {
  for (const k of Object.keys(raw)) {
    if (!KNOWN_ROOTS.includes(k))
      throw new Error(`unknown policy key "${k}" (known: ${KNOWN_ROOTS.join(", ")})`);
  }
  const out = {};
  const lanes = raw.lanes;
  if (lanes && Array.isArray(lanes.force_full))
    out.lanes = { force_full: strings(lanes.force_full) };
  const gates = raw.gates;
  if (gates) {
    out.gates = {};
    const cov = gates.coverage;
    if (cov) {
      out.gates.coverage = {};
      if (typeof cov.new === "number")
        out.gates.coverage.new = cov.new;
      if (typeof cov.modified === "number")
        out.gates.coverage.modified = cov.modified;
    }
    if (Array.isArray(gates.require_human_approval))
      out.gates.require_human_approval = strings(gates.require_human_approval);
  }
  const evidence = raw.evidence;
  if (evidence) {
    const ev = {};
    if (Array.isArray(evidence.required))
      ev.required = strings(evidence.required);
    else if (typeof evidence.required === "string" && evidence.required.trim().startsWith("[")) {
      try {
        const p = JSON.parse(evidence.required);
        if (Array.isArray(p))
          ev.required = strings(p);
      } catch {}
    }
    if (Array.isArray(evidence.require_nonempty_for_lanes))
      ev.require_nonempty_for_lanes = strings(evidence.require_nonempty_for_lanes);
    else if (typeof evidence.require_nonempty_for_lanes === "string" && evidence.require_nonempty_for_lanes.trim().startsWith("[")) {
      try {
        const p = JSON.parse(evidence.require_nonempty_for_lanes);
        if (Array.isArray(p))
          ev.require_nonempty_for_lanes = strings(p);
      } catch {}
    }
    if (ev.required || ev.require_nonempty_for_lanes)
      out.evidence = ev;
  }
  const integrity = raw.integrity;
  if (integrity && Array.isArray(integrity.extra_secret_patterns)) {
    const arr = integrity.extra_secret_patterns;
    const cleaned = [];
    for (const e of arr) {
      if (!e || typeof e !== "object")
        continue;
      const rec = e;
      if (typeof rec.pattern !== "string" || typeof rec.label !== "string")
        continue;
      const sev = rec.severity === "warn" ? "warn" : rec.severity === "block" ? "block" : undefined;
      const entry = { pattern: rec.pattern, label: rec.label };
      if (sev)
        entry.severity = sev;
      cleaned.push(entry);
    }
    if (cleaned.length)
      out.integrity = { extra_secret_patterns: cleaned };
  }
  const att = raw.attestation;
  if (att) {
    const a = {};
    if (typeof att.required === "boolean")
      a.required = att.required;
    if (Array.isArray(att.trusted_keys)) {
      const cleanedTk = [];
      for (const e of att.trusted_keys) {
        if (!e || typeof e !== "object")
          continue;
        const rec = e;
        if (typeof rec.id !== "string" || typeof rec.pubkey !== "string")
          continue;
        if (!rec.id.trim() || !rec.pubkey.trim())
          continue;
        const entry = { id: rec.id.trim(), pubkey: rec.pubkey.trim() };
        if (typeof rec.added === "string" && rec.added.trim())
          entry.added = rec.added.trim();
        cleanedTk.push(entry);
      }
      if (cleanedTk.length)
        a.trusted_keys = cleanedTk;
    }
    if (Array.isArray(att.revoked)) {
      const cleanedRv = [];
      for (const e of att.revoked) {
        if (!e || typeof e !== "object")
          continue;
        const rec = e;
        if (typeof rec.id !== "string" || !rec.id.trim())
          continue;
        const entry = { id: rec.id.trim() };
        if (typeof rec.revoked === "string" && rec.revoked.trim())
          entry.revoked = rec.revoked.trim();
        if (typeof rec.reason === "string" && rec.reason.trim())
          entry.reason = rec.reason.trim();
        if (typeof rec.pubkey === "string" && rec.pubkey.trim())
          entry.pubkey = rec.pubkey.trim();
        cleanedRv.push(entry);
      }
      if (cleanedRv.length)
        a.revoked = cleanedRv;
    }
    if (a.required !== undefined || a.trusted_keys || a.revoked)
      out.attestation = a;
  }
  const harness = raw.harness;
  if (harness && typeof harness.require_enforcement === "boolean") {
    out.harness = { require_enforcement: harness.require_enforcement };
  }
  return out;
}
function strings(a) {
  return a.filter((x) => typeof x === "string" && x.length > 0);
}
var POLICY_FILES, KNOWN_ROOTS;
var init_policy = __esm(() => {
  POLICY_FILES = ["mugiwara.policy.yml", "mugiwara.policy.yaml"];
  KNOWN_ROOTS = ["lanes", "gates", "evidence", "integrity", "attestation", "harness"];
});

// src/config.ts
import { existsSync as existsSync9, lstatSync as lstatSync2, mkdirSync as mkdirSync3, readFileSync as readFileSync7, writeFileSync as writeFileSync5 } from "node:fs";
import { join as join11 } from "node:path";
function configPaths2(projectDir) {
  return [join11(projectDir, ".mugiwara", "config"), join11(homeDir(), ".mugiwara", "config")];
}
function readConfig2(projectDir) {
  const out = {};
  for (const file of configPaths2(projectDir)) {
    if (!existsSync9(file))
      continue;
    for (const line of readFileSync7(file, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#"))
        continue;
      const eq = t.indexOf("=");
      if (eq === -1)
        continue;
      const key = t.slice(0, eq).trim();
      if (!key)
        continue;
      if (key in out)
        continue;
      let rawVal = t.slice(eq + 1).trim();
      const hash = rawVal.indexOf("#");
      if (hash !== -1)
        rawVal = rawVal.slice(0, hash).trim();
      out[key] = rawVal;
    }
  }
  return out;
}
var DEFAULT_CONFIG2;
var init_config = __esm(() => {
  init_home();
  DEFAULT_CONFIG2 = [
    "mode=guided",
    "verbosity=normal",
    "branch=feature/{type}-{issue}-{slug}",
    "commit=conventional",
    "auto_commit=off",
    "coverage=85",
    "review_depth=full",
    "quality_depth=full",
    "delegate_threshold=60",
    "heal_max_cycles=3",
    "independent_review=on",
    "# lane_scope_glob=packages/api/**",
    "# context_budget_chars=150000",
    "# team=off",
    "# sign=auto",
    "# features=core+auto",
    "# enforce=warn"
  ].join(`
`) + `
`;
});

// hooks/pipeline-guard.ts
import { appendFileSync as appendFileSync3, existsSync as existsSync14, mkdirSync as mkdirSync7, readFileSync as readFileSync13, readdirSync as readdirSync8, statSync as statSync4, lstatSync as lstatSync3, writeFileSync as writeFileSync7 } from "fs";
import { execFileSync as execFileSync5 } from "child_process";
import { homedir as homedir2 } from "os";
import { dirname as dirname2, join as join18 } from "path";
import { spawnSync as spawnSync3 } from "child_process";
import { fileURLToPath as fileURLToPath2 } from "url";

// src/run.ts
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
var here = dirname(fileURLToPath(import.meta.url));
var SCRIPTS_DIR = join(here, "..", "scripts");
function findBash() {
  const explicit = process.env.MUGIWARA_BASH?.trim();
  if (explicit)
    return existsSync(explicit) ? explicit : null;
  const candidates = process.platform === "win32" ? [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
    join(process.env.LOCALAPPDATA ?? "", "Programs", "Git", "bin", "bash.exe")
  ] : ["/bin/bash", "/usr/bin/bash", "/usr/local/bin/bash", "/opt/homebrew/bin/bash"];
  for (const p of candidates) {
    if (p && existsSync(p))
      return p;
  }
  const probe = spawnSync(process.platform === "win32" ? "where" : "which", ["bash"], {
    encoding: "utf8"
  });
  const first = probe.stdout?.split(/\r?\n/).find((l) => l.trim());
  return first?.trim() || null;
}

// src/config.ts
init_home();
import { existsSync as existsSync2, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join as join2 } from "node:path";
var DEFAULT_CONFIG = [
  "mode=guided",
  "verbosity=normal",
  "branch=feature/{type}-{issue}-{slug}",
  "commit=conventional",
  "auto_commit=off",
  "coverage=85",
  "review_depth=full",
  "quality_depth=full",
  "delegate_threshold=60",
  "heal_max_cycles=3",
  "independent_review=on",
  "# lane_scope_glob=packages/api/**",
  "# context_budget_chars=150000",
  "# team=off",
  "# sign=auto",
  "# features=core+auto",
  "# enforce=warn"
].join(`
`) + `
`;
function configPaths(projectDir) {
  return [join2(projectDir, ".mugiwara", "config"), join2(homeDir(), ".mugiwara", "config")];
}
function readConfig(projectDir) {
  const out = {};
  for (const file of configPaths(projectDir)) {
    if (!existsSync2(file))
      continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#"))
        continue;
      const eq = t.indexOf("=");
      if (eq === -1)
        continue;
      const key = t.slice(0, eq).trim();
      if (!key)
        continue;
      if (key in out)
        continue;
      let rawVal = t.slice(eq + 1).trim();
      const hash = rawVal.indexOf("#");
      if (hash !== -1)
        rawVal = rawVal.slice(0, hash).trim();
      out[key] = rawVal;
    }
  }
  return out;
}

// src/active-mission.ts
import { existsSync as existsSync3, readFileSync as readFileSync2, readdirSync, statSync } from "node:fs";
import { join as join3 } from "node:path";
var SAFE = /^[A-Za-z0-9._-]+$/;
var REVIEW_LEDGER = "review-dispatch.jsonl";
function dispatchedAgents(cwd, mission) {
  return new Set(dispatchCounts(cwd, mission).keys());
}
function dispatchCounts(cwd, mission) {
  const out = new Map;
  if (!mission)
    return out;
  try {
    const file = join3(cwd, ".mugiwara", REVIEW_LEDGER);
    if (!existsSync3(file))
      return out;
    for (const line of readFileSync2(file, "utf8").split(/\r?\n/)) {
      if (!line.trim())
        continue;
      try {
        const e = JSON.parse(line);
        if (e.mission === mission && typeof e.agent === "string")
          out.set(e.agent, (out.get(e.agent) ?? 0) + 1);
      } catch {}
    }
  } catch {}
  return out;
}
function closingPending(cwd) {
  const base = join3(cwd, ".mugiwara", "missions");
  let best = null;
  try {
    for (const e of readdirSync(base, { withFileTypes: true })) {
      if (!e.isDirectory() || !SAFE.test(e.name) || /^\.+$/.test(e.name))
        continue;
      const dir = join3(base, e.name);
      const files = readdirSync(dir);
      const live = files.some((f) => f.endsWith(".json") && f !== "continue.json" && !f.startsWith("continue-"));
      if (!live || files.includes("report.md"))
        continue;
      const marks = ["06-closure.md", "07-pr-verdict.md"].map((f) => join3(dir, "flows", f)).filter((f) => existsSync3(f));
      if (files.includes("review.md") && files.includes("security.md"))
        marks.push(join3(dir, files.includes("review.md") ? "review.md" : "security.md"));
      if (!marks.length)
        continue;
      const at = Math.max(...marks.map((f) => statSync(f).mtimeMs));
      if (!best || at > best.at)
        best = { name: e.name, at };
    }
  } catch {}
  return best?.name ?? null;
}

// src/risk.ts
var RISK_WORDS = new RegExp("\\b(" + [
  "auth\\w*",
  "log[- ]?in",
  "sign[- ]?in",
  "password\\w*",
  "credential\\w*",
  "secrets?",
  "tokens?",
  "rbac",
  "roles?",
  "permissions?",
  "tenant\\w*",
  "multi-tenant",
  "payments?",
  "billing",
  "refund\\w*",
  "invoices?",
  "migrat\\w+",
  "schema",
  "ci/cd",
  "github actions",
  "izin",
  "hak akses",
  "otorisasi",
  "autentikasi",
  "masuk akun",
  "pembayaran",
  "penagihan",
  "pengembalian dana",
  "kata sandi",
  "sandi",
  "rahasia",
  "kunci api",
  "penyewa",
  "migrasi",
  "skema"
].join("|") + ")\\b", "i");
var RISK_PATH_PARTS = new Set(["auth", "payment", "payments", "billing", "migration", "migrations", "rbac", "permission", "permissions", "secret", "secrets"]);
function reviewNextStep(mission, ran = new Set) {
  const todo = [["robin-reviewer", "Robin"], ["jinbe-security", "Jinbe"]].filter(([a]) => !ran.has(a)).map(([a, n]) => `${n} (${a})`);
  return `Next step: start ${todo.length ? todo.join(" and ") : "the reviewers"} as separate agents for mission "${mission}", then run \`mugiwara archive ${mission}\`.`;
}

// src/auto-close.ts
import { existsSync as existsSync13, readFileSync as readFileSync12, readdirSync as readdirSync7 } from "node:fs";
import { join as join17 } from "node:path";

// src/record.ts
import { execFileSync, spawnSync as spawnSync2 } from "node:child_process";
import { existsSync as existsSync5, mkdirSync as mkdirSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { join as join5 } from "node:path";

// src/active-mission.ts
import { existsSync as existsSync4, readFileSync as readFileSync3, readdirSync as readdirSync2, statSync as statSync2 } from "node:fs";
import { join as join4 } from "node:path";
var REVIEW_LEDGER2 = "review-dispatch.jsonl";
function dispatchedAgents2(cwd, mission) {
  return new Set(dispatchCounts2(cwd, mission).keys());
}
function dispatchCounts2(cwd, mission) {
  const out = new Map;
  if (!mission)
    return out;
  try {
    const file = join4(cwd, ".mugiwara", REVIEW_LEDGER2);
    if (!existsSync4(file))
      return out;
    for (const line of readFileSync3(file, "utf8").split(/\r?\n/)) {
      if (!line.trim())
        continue;
      try {
        const e = JSON.parse(line);
        if (e.mission === mission && typeof e.agent === "string")
          out.set(e.agent, (out.get(e.agent) ?? 0) + 1);
      } catch {}
    }
  } catch {}
  return out;
}

// src/risk.ts
var RISK_WORDS2 = new RegExp("\\b(" + [
  "auth\\w*",
  "log[- ]?in",
  "sign[- ]?in",
  "password\\w*",
  "credential\\w*",
  "secrets?",
  "tokens?",
  "rbac",
  "roles?",
  "permissions?",
  "tenant\\w*",
  "multi-tenant",
  "payments?",
  "billing",
  "refund\\w*",
  "invoices?",
  "migrat\\w+",
  "schema",
  "ci/cd",
  "github actions",
  "izin",
  "hak akses",
  "otorisasi",
  "autentikasi",
  "masuk akun",
  "pembayaran",
  "penagihan",
  "pengembalian dana",
  "kata sandi",
  "sandi",
  "rahasia",
  "kunci api",
  "penyewa",
  "migrasi",
  "skema"
].join("|") + ")\\b", "i");
var RISK_PATH_PARTS2 = new Set(["auth", "payment", "payments", "billing", "migration", "migrations", "rbac", "permission", "permissions", "secret", "secrets"]);
function riskPath(text) {
  for (const tok of text.split(/[\s"'`()<>,;]+/)) {
    if (!tok.includes("/"))
      continue;
    for (const part of tok.toLowerCase().split(/[/\\_.\-]+/))
      if (RISK_PATH_PARTS2.has(part))
        return tok;
  }
  return null;
}
function riskPathsIn(files) {
  return files.filter((f) => riskPath(f.includes("/") ? f : `./${f}`) !== null);
}

// src/record.ts
var STAGES = ["execution", "audit", "quality", "gates", "healing", "closure"];
function git(projectDir, args) {
  try {
    return execFileSync("git", args, { cwd: projectDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
function changedFiles(projectDir) {
  const tracked = git(projectDir, ["diff", "--name-only", "HEAD"]).split(`
`);
  const fresh = git(projectDir, ["ls-files", "--others", "--exclude-standard"]).split(`
`);
  return [...new Set([...tracked, ...fresh].filter((f) => f && !f.startsWith(".mugiwara/")))];
}
var tail = (s, n = 20) => s.split(`
`).slice(-n).join(`
`).trim();
function buildStage(projectDir, mission, stage, o) {
  const note = o.note ? `
## Note

${o.note.trim()}
` : "";
  const files = changedFiles(projectDir);
  switch (stage) {
    case "execution": {
      if (!files.length)
        return { error: "no changed files to record (git shows no diff)." };
      return { body: `# Execution

Changed files (${files.length}):

${files.map((f) => `- ${f}`).join(`
`)}

\`\`\`
${git(projectDir, ["diff", "--stat", "HEAD"])}
\`\`\`
${note}` };
    }
    case "audit": {
      const risky = riskPathsIn(files);
      return { body: `# Audit

Files in scope: ${files.length}.
Risky paths: ${risky.length ? risky.join(", ") : "none found"}.
${note}` };
    }
    case "gates": {
      if (!o.cmd)
        return { error: 'gates needs --cmd "<command>": the CLI runs it and records the real exit code.' };
      const r = spawnSync2(o.cmd, { cwd: projectDir, shell: true, encoding: "utf8", timeout: o.timeoutMs ?? 600000 });
      const code = r.status === null ? `no exit (${r.signal ?? "timeout"})` : String(r.status);
      return { body: `# Gates

Command: \`${o.cmd}\`
Exit code: ${code} (${r.status === 0 ? "pass" : "fail"})

\`\`\`
${tail(`${r.stdout ?? ""}
${r.stderr ?? ""}`)}
\`\`\`
${note}` };
    }
    case "closure": {
      const ran = dispatchedAgents2(projectDir, mission);
      const rev = ["robin-reviewer", "jinbe-security"].map((a) => `- ${a}: ${ran.has(a) ? "dispatched as a separate agent" : "not dispatched"}`).join(`
`);
      return { body: `# Closure

Independent review (from the dispatch ledger):

${rev}
${note}` };
    }
    default:
      if (!o.note)
        return { error: `${stage} needs --note "<what happened>"; nothing is recorded without it.` };
      return { body: `# ${stage[0].toUpperCase()}${stage.slice(1)}
${note}` };
  }
}
function recordStage(projectDir, mission, stage, o = {}) {
  const dir = join5(projectDir, ".mugiwara", "missions", mission);
  if (!existsSync5(dir))
    return { error: `no mission named '${mission}'.` };
  const built = buildStage(projectDir, mission, stage, o);
  if ("error" in built)
    return built;
  const flows = join5(dir, "flows");
  mkdirSync2(flows, { recursive: true });
  const path = join5(flows, `0${STAGES.indexOf(stage) + 1}-${stage}.md`);
  writeFileSync2(path, built.body);
  return { path };
}

// src/mission.ts
import { existsSync as existsSync12, rmSync, readFileSync as readFileSync11, readdirSync as readdirSync6, mkdirSync as mkdirSync6, writeFileSync as writeFileSync6, renameSync, openSync, writeSync, closeSync } from "node:fs";
import { execFileSync as execFileSync4 } from "node:child_process";
import { join as join16 } from "node:path";

// src/integrity.ts
init_policy();
import { existsSync as existsSync7, readdirSync as readdirSync3, readFileSync as readFileSync5 } from "node:fs";
import { isAbsolute, join as join7, relative } from "node:path";
var SECRET_PATTERNS = [
  [/AKIA[0-9A-Z]{16}/, "AWS access key id", "block"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key block", "block"],
  [/gh[pousr]_[A-Za-z0-9]{20,}/, "GitHub token", "block"],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/, "Slack token", "block"],
  [/sk-[A-Za-z0-9]{32,}/, "API key (sk-…)", "block"],
  [/eyJhbGciOi[A-Za-z0-9_.-]{20,}/, "JWT pasted verbatim", "block"],
  [/(api[_-]?key|secret|passwd|password)\s*[=:]\s*["'][^"'\s]{8,}["']/i, "credential assignment", "block"],
  [/AIza[0-9A-Za-z_-]{35}/, "Google API key", "block"],
  [/ya29\.[0-9A-Za-z_-]{20,}/, "Google OAuth token", "block"],
  [/\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]{4,}@[^\s/]+/i, "connection string with inline credential", "block"],
  [/\bAC[a-f0-9]{32}\b/, "Twilio account SID", "block"],
  [/\bSK[a-f0-9]{32}\b/, "Twilio API key", "block"],
  [/\bglpat-[A-Za-z0-9_-]{20,}/, "GitLab token", "block"],
  [/\bnpm_[A-Za-z0-9]{36}\b/, "npm token", "block"],
  [/\bdop_v1_[a-f0-9]{64}\b/, "DigitalOcean token", "block"],
  [/\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/, "card-number shape (verify before committing)", "warn"]
];
var ALLOW_SECRET = "mugiwara:allow-secret";
function loadExtraPatterns(projectRoot) {
  try {
    const policy = loadPolicy(projectRoot);
    const extras = policy?.integrity?.extra_secret_patterns;
    if (!extras || !Array.isArray(extras))
      return [];
    const out = [];
    for (const e of extras) {
      if (!e || typeof e.pattern !== "string" || typeof e.label !== "string")
        continue;
      const rec = e;
      const sev = rec.severity === "warn" ? "warn" : "block";
      try {
        const re = new RegExp(rec.pattern);
        out.push([re, rec.label, sev]);
      } catch {}
    }
    return out;
  } catch {
    return [];
  }
}
function findSecrets(body, extra) {
  const out = [];
  const patterns = extra ? [...SECRET_PATTERNS, ...extra] : SECRET_PATTERNS;
  for (const line of body.split(/\r?\n/)) {
    if (line.includes(ALLOW_SECRET))
      continue;
    for (const [re, label, severity] of patterns) {
      const hit = line.match(re);
      if (hit)
        out.push({ label, hit: hit[0], severity: severity ?? "block" });
    }
  }
  return out;
}
var TRAIL_EXTS = new Set([".md", ".json", ".sh", ".jsonl"]);
function trailFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync3(d, { withFileTypes: true })) {
      const p = join7(d, e.name);
      if (e.isDirectory())
        walk(p);
      else if (TRAIL_EXTS.has(e.name.slice(e.name.lastIndexOf(".")) || ""))
        out.push(p);
    }
  };
  walk(dir);
  return out;
}
function linkedPaths(md) {
  const out = [];
  for (const m of md.matchAll(/\]\(([^)\s]+)\)/g)) {
    const t = m[1];
    if (/^(https?:|mailto:|#|\/\/)/.test(t))
      continue;
    out.push(t.split("#")[0]);
  }
  return out.filter(Boolean);
}
function hasCommandOutputShape(body) {
  return /`[^`]+`/.test(body) || /\b(exit\s+[01]|✓|✗|\bPASS\b|\bFAIL\b|passed|failed|\d+\s+(passed|failed))\b/i.test(body);
}
function collectPassCitedPaths(missionDir) {
  const out = [];
  for (const f of trailFiles(missionDir)) {
    let body;
    try {
      body = readFileSync5(f, "utf8");
    } catch {
      continue;
    }
    for (const line of body.split(/\r?\n/)) {
      if (!/\bPASS\b/.test(line))
        continue;
      for (const p of linkedPaths(line))
        out.push(p);
      for (const m of line.matchAll(/(?:^|[\s"'(])([a-zA-Z0-9._\/-]+\.(?:md|txt|log|json))\b/g)) {
        const cand = m[1];
        if (cand.includes("/"))
          out.push(cand);
      }
    }
  }
  return [...new Set(out)];
}
function checkTrail(missionDir, projectRoot) {
  const issues = [];
  const files = trailFiles(missionDir);
  const extraPatterns = loadExtraPatterns(projectRoot);
  for (const f of files) {
    let body;
    try {
      body = readFileSync5(f, "utf8");
    } catch {
      continue;
    }
    for (const target of linkedPaths(body)) {
      if (isAbsolute(target))
        continue;
      const fromMission = join7(missionDir, target);
      const fromRoot = join7(projectRoot, target);
      if (!existsSync7(fromMission) && !existsSync7(fromRoot)) {
        issues.push({
          kind: "dangling-path",
          detail: `${relative(projectRoot, f)} links "${target}" — no such file (mission dir or repo root)`
        });
      }
    }
    for (const { label, hit, severity } of findSecrets(body, extraPatterns.length ? extraPatterns : undefined)) {
      const isWarn = severity === "warn";
      issues.push({
        kind: isWarn ? "secret-warn" : "secret",
        detail: `${relative(projectRoot, f)} matches ${label}: ${hit.slice(0, 12)}…`,
        severity: isWarn ? "warn" : "block"
      });
    }
  }
  const evidencePaths = [];
  const stateFiles = existsSync7(missionDir) ? readdirSync3(missionDir).filter((n) => n.endsWith(".json") && n !== "continue.json" && !n.startsWith("continue-")).sort() : [];
  for (const name of stateFiles) {
    const evidenceFile = join7(missionDir, name);
    try {
      const s = JSON.parse(readFileSync5(evidenceFile, "utf8"));
      if (!Array.isArray(s.evidence))
        continue;
      for (const e of s.evidence) {
        if (typeof e !== "string" || !e.trim())
          continue;
        evidencePaths.push(e);
        const cand = join7(projectRoot, e);
        if (!isAbsolute(e) && !existsSync7(cand) && !existsSync7(join7(missionDir, e))) {
          issues.push({ kind: "evidence", detail: `${name} evidence "${e}" does not exist` });
        }
      }
    } catch {}
  }
  if (evidencePaths.length === 0) {
    let severity = "warn";
    try {
      const policy = loadPolicy(projectRoot);
      const lanes = policy?.evidence?.require_nonempty_for_lanes;
      if (Array.isArray(lanes) && lanes.length) {
        const stateLanes = new Set;
        for (const name of stateFiles) {
          try {
            const s = JSON.parse(readFileSync5(join7(missionDir, name), "utf8"));
            if (typeof s.lane === "string")
              stateLanes.add(s.lane);
          } catch {}
        }
        if ([...stateLanes].some((l) => lanes.includes(l)))
          severity = "block";
      }
    } catch {}
    issues.push({
      kind: "evidence",
      severity,
      detail: "mission declares no evidence — closing with zero recorded checks"
    });
  }
  const passCited = collectPassCitedPaths(missionDir);
  for (const e of passCited) {
    if (!e.trim() || isAbsolute(e))
      continue;
    if (/(?:^|\/)(state|continue)(-[^\/]*)?\.json$/.test(e))
      continue;
    const candMission = join7(missionDir, e);
    const candRoot = join7(projectRoot, e);
    const resolved = existsSync7(candMission) ? candMission : existsSync7(candRoot) ? candRoot : null;
    if (!resolved)
      continue;
    let body;
    try {
      body = readFileSync5(resolved, "utf8");
    } catch {
      continue;
    }
    if (!hasCommandOutputShape(body)) {
      issues.push({ kind: "evidence-thin", detail: `evidence "${e}" exists but lacks command output (no backticked command or exit-status token)` });
    }
  }
  for (const rel of ["pr-verdict.md", join7("flows", "07-pr-verdict.md")]) {
    const f = join7(missionDir, rel);
    if (!existsSync7(f))
      continue;
    let body;
    try {
      body = readFileSync5(f, "utf8");
    } catch {
      continue;
    }
    const isVerdict = sectionBody(body, "Verdict") !== null;
    for (const heading of ["Tests", "Checks", "Deferred / follow-ups"]) {
      const sec = sectionBody(body, heading);
      if (sec === null) {
        if (!isVerdict)
          continue;
        issues.push({ kind: "verdict-shape", severity: "warn", detail: `${rel} has no "## ${heading}" section — the verdict template requires it` });
        continue;
      }
      const lines = sec.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (!lines.length) {
        issues.push({ kind: "verdict-shape", severity: "warn", detail: `${rel} "## ${heading}" is empty — write \`None.\` explicitly or list the boxes` });
        continue;
      }
      if (lines.length === 1 && /^-?\s*`?none\.?`?$/i.test(lines[0]))
        continue;
      const bad = lines.filter((l) => !/^- \[[ xX]\] \S/.test(l));
      if (bad.length) {
        issues.push({
          kind: "verdict-shape",
          severity: "warn",
          detail: `${rel} "## ${heading}" has ${bad.length} non-checkbox line(s) — one \`- [x]\`/\`- [ ]\` item per line; first: "${bad[0].slice(0, 60)}"`
        });
      }
    }
  }
  return issues;
}
function sectionBody(md, heading) {
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1)
    return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^## /.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join(`
`);
}
function formatIssues(issues) {
  return issues.map((i) => `  ✗ [${i.kind}] ${i.detail}`).join(`
`);
}

// src/check-artifacts.ts
import { existsSync as existsSync8, readFileSync as readFileSync6, readdirSync as readdirSync4 } from "node:fs";
import { join as join8 } from "node:path";
var LANE_MIN = new Set(["standard", "full", "spike"]);
function checkMissionArtifacts(missionDir, opts = {}) {
  const statePath = join8(missionDir, "state.json");
  if (!existsSync8(statePath)) {
    return { ok: true, missing: [], lane: null };
  }
  let lane = "unknown";
  try {
    const s = JSON.parse(readFileSyncSafe(statePath));
    if (typeof s.lane === "string")
      lane = s.lane;
  } catch {}
  if (!LANE_MIN.has(lane)) {
    return { ok: true, missing: [], lane };
  }
  const missing = [];
  if (!opts.unplanned && !existsSync8(join8(missionDir, "plan.md")))
    missing.push("plan.md");
  const flowsDir = join8(missionDir, "flows");
  const hasFlows = existsSync8(flowsDir) && readdirSync4(flowsDir).length > 0;
  if (!hasFlows)
    missing.push("flows/ (no execution evidence)");
  return { ok: missing.length === 0, missing, lane };
}
function readFileSyncSafe(p) {
  try {
    return readFileSync6(p, "utf8");
  } catch {
    return "";
  }
}

// src/rollback.ts
import { execFileSync as execFileSync2 } from "node:child_process";
import { writeFileSync as writeFileSync3 } from "node:fs";
import { join as join9 } from "node:path";
function git2(cwd, args) {
  return execFileSync2("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}
function buildRollback(input, commitsNewestFirst, filesTouched) {
  const lines = [
    "#!/usr/bin/env bash",
    `# Rollback map for mission "${input.mission}" — generated at closure.`,
    "# Human-executed. Review before running; mugiwara never runs this.",
    `# Branch: ${input.branch}`,
    `# Base:   ${input.baseSha}`,
    "",
    "set -euo pipefail",
    ""
  ];
  if (!commitsNewestFirst.length && !filesTouched.length) {
    lines.push("# No commits between base and HEAD on this branch — nothing to revert.", "");
    return lines.join(`
`);
  }
  if (!commitsNewestFirst.length) {
    lines.push("# UNRESOLVED: squash-merged state detected.", `# git rev-list ${input.baseSha}..${input.branch} is empty, but the diff`, `# ${input.baseSha}..${input.branch} touches ${filesTouched.length} file(s):`, "# the mission's changes were collapsed into commit(s) already on the base", "# ref. No per-commit revert list can be derived automatically.", "# Locate the squash commit, review it, then revert it:", `#   git log --oneline ${input.baseSha}..HEAD --grep="${input.mission}"`, "#   git revert <squash-commit>", "# Files carrying the squashed changes (verify each after reverting):", ...filesTouched.map((f) => `#   ${f}`), "", 'echo "ROLLBACK INCOMPLETE: squash-merged state — locate and revert the squash commit manually" >&2', "exit 1", "");
    return lines.join(`
`);
  }
  lines.push("# Revert newest-first so earlier reverts never conflict with later ones.", "git revert --no-edit \\", commitsNewestFirst.map((c) => `  ${c}`).join(" \\\n"), "");
  if (filesTouched.length) {
    lines.push("# Files this mission touched (verify the working tree is clean afterwards):", ...filesTouched.map((f) => `#   ${f}`), "");
  }
  return lines.join(`
`);
}
function generateRollback(projectDir, missionDir, input) {
  try {
    const range = `${input.baseSha}..${input.branch}`;
    const revList = git2(projectDir, ["rev-list", "--reverse", range]).split(/\r?\n/).filter(Boolean);
    const commitsNewestFirst = [...revList].reverse();
    const filesTouched = input.baseSha === "unknown" ? [] : git2(projectDir, ["diff", "--name-only", input.baseSha, input.branch]).split(/\r?\n/).filter(Boolean);
    const body = buildRollback(input, commitsNewestFirst, filesTouched);
    const file = join9(missionDir, "rollback.sh");
    writeFileSync3(file, body, { mode: 493 });
    return { file: "rollback.sh", commits: commitsNewestFirst.length };
  } catch {
    return null;
  }
}

// src/provenance.ts
import { execFileSync as execFileSync3 } from "node:child_process";
import { writeFileSync as writeFileSync4 } from "node:fs";
import { join as join10 } from "node:path";
function git3(cwd, args) {
  return execFileSync3("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}
function modelLabel() {
  return process.env.MUGIWARA_MODEL?.trim() || process.env.ANTHROPIC_MODEL?.trim() || "model-unrecorded (set MUGIWARA_MODEL to attribute)";
}
function actorName(actor) {
  const n = (actor || "").replace(/\s*<[^<>]*>/g, "").replace(/[^\s<>]+@[^\s<>]+/g, "").replace(/\s+/g, " ").trim();
  return n || "unknown";
}
function buildNote(s) {
  const gates = s.evidence.length ? s.evidence.join(" · ") : "no evidence recorded";
  const uniqModels = [...new Set((s.models ?? []).filter(Boolean))];
  const modelPart = uniqModels.length ? `model(s): ${uniqModels.join(", ")}` : s.model ?? modelLabel();
  return [
    `mission: ${s.mission}`,
    `agent: ${actorName(s.actor)} · ${modelPart} · lane ${s.lane} · mode ${s.mode}`,
    `tasks: ${s.tasks_done}/${s.tasks_total}`,
    `gates/evidence: ${gates}`,
    `branch: ${s.branch}`,
    "human review: pending (PR review is the terminal gate)"
  ].join(`
`);
}
function renderProvenanceMd(note, sha) {
  const lines = [
    "# Provenance",
    "",
    "<!-- paste below into the PR description or a PR comment -->",
    "",
    "```",
    note,
    "```",
    "",
    sha ? `Commit: ${sha}` : "Commit: not recorded (no git head resolved at closure)",
    "",
    "Query locally after pushing notes:",
    "`git fetch origin refs/notes/mugiwara:refs/notes/mugiwara` then `mugiwara handoff <mission> --path <path>`."
  ];
  return lines.join(`
`) + `
`;
}
function attachGitNote(projectDir, branch, note, baseSha) {
  try {
    const range = baseSha ? `${baseSha}..${branch}` : branch;
    let shas = [];
    try {
      const raw = git3(projectDir, ["rev-list", range]);
      shas = raw.split(`
`).filter(Boolean);
    } catch {
      shas = [];
    }
    if (shas.length > 200) {
      console.warn(`attachGitNote: range ${shas.length} >200, falling back to head-only`);
      shas = [];
    }
    let targets = shas;
    if (!targets.length) {
      try {
        targets = [git3(projectDir, ["rev-parse", "--verify", branch])];
      } catch {
        targets = [git3(projectDir, ["rev-parse", "HEAD"])];
      }
    }
    for (const sha of targets) {
      git3(projectDir, ["notes", "--ref=mugiwara", "add", "-f", "-m", note, sha]);
    }
    return { sha: targets[0], count: targets.length };
  } catch {
    return null;
  }
}
function writeProvenance(projectDir, missionDir, state, baseSha) {
  const note = buildNote(state);
  const resolvedBase = baseSha ?? (typeof state.base_sha === "string" ? state.base_sha : undefined);
  const cleanBase = resolvedBase && resolvedBase !== "unknown" ? resolvedBase : undefined;
  const attached = attachGitNote(projectDir, state.branch, note, cleanBase);
  writeFileSync4(join10(missionDir, "provenance.md"), renderProvenanceMd(note, attached ? attached.sha : null));
}

// src/mission.ts
init_policy();

// src/routing.ts
var DOC_PAT = /\.(md|txt|rst)$|^docs\/|^(CHANGELOG|LICENSE|README)/;
var TEST_PAT = /\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)(tests?|__tests__|specs?)\//;
function scorePath(path, sensitivePaths, evidenceJoined) {
  const reasons = [];
  let score = 0;
  const sensitiveHit = sensitivePaths.some((s) => s && (path === s || path.startsWith(s.replace(/\/?$/, "/")) || new RegExp(s.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")).test(path)));
  if (sensitiveHit) {
    score += 100;
    reasons.push("sensitive path");
  }
  if (!DOC_PAT.test(path) && !TEST_PAT.test(path)) {
    score += 50;
    reasons.push("production code");
  } else if (TEST_PAT.test(path)) {
    score += 10;
    reasons.push("test scaffolding — skim unless behavior changed");
  } else {
    score += 5;
    reasons.push("docs/config");
  }
  if (!evidenceJoined.includes(path)) {
    score += 20;
    reasons.push("not covered by recorded evidence");
  }
  return { score, reasons };
}
function rankFiles(paths, state) {
  const sensitive = state.sensitive_paths ?? [];
  const ev = state.evidence.join(" ");
  return paths.map((path) => {
    const { score, reasons } = scorePath(path, sensitive, ev);
    return { path, score, reasons };
  }).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}
function renderRouting(ranked, mission) {
  if (!ranked.length)
    return "";
  const lines = [
    "",
    "## Where to start reviewing",
    "",
    "Suggested reading order, most important first. It says where to look first, not what is correct:",
    ""
  ];
  ranked.forEach((r, i) => {
    lines.push(`${i + 1}. \`${r.path}\` — ${r.reasons.join("; ")}`);
  });
  lines.push("");
  return lines.join(`
`);
}

// src/budget.ts
init_config();
import { existsSync as existsSync10, readdirSync as readdirSync5, statSync as statSync3 } from "node:fs";
import { join as join12 } from "node:path";
function readBudgetConfig(projectDir) {
  const cfg = readConfig2(projectDir);
  const raw = cfg.context_budget_chars;
  if (raw === undefined || raw === "")
    return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function measureContextChars(missionDir) {
  let total = 0;
  const add = (p) => {
    try {
      total += statSync3(p).size;
    } catch {}
  };
  for (const f of readdirSync5(missionDir)) {
    if (/\.md$/.test(f))
      add(join12(missionDir, f));
  }
  for (const sub of ["flows", "waves"]) {
    const dir = join12(missionDir, sub);
    if (existsSync10(dir)) {
      for (const f of readdirSync5(dir))
        add(join12(dir, f));
    }
  }
  return total;
}
function formatFootprint(chars, budget) {
  const base = `Context footprint: ${chars} chars`;
  if (!budget)
    return `${base} (no budget configured)`;
  return chars > budget ? `${base} — OVER budget ${budget}` : `${base} (budget ${budget})`;
}
var COMPRESS_THRESHOLD_PCT = 0.8;
function shouldCompress(budget, chars) {
  return budget > 0 && chars > Math.floor(budget * COMPRESS_THRESHOLD_PCT);
}
function compressThreshold(budget) {
  return Math.floor(budget * COMPRESS_THRESHOLD_PCT);
}

// src/cost.ts
import { appendFileSync, mkdirSync as mkdirSync4, readFileSync as readFileSync8 } from "node:fs";
import { join as join13 } from "node:path";
var LANE_BUDGET = {
  lean: 12000,
  standard: 30000,
  full: 50000,
  spike: 9000
};
function budgetForLane(lane) {
  return LANE_BUDGET[lane] ?? 0;
}
function warnAt(budget) {
  return Math.floor(budget * 3 / 2);
}
function stopAt(budget) {
  return budget * 3;
}
function budgetStatus(budget, tokens) {
  if (budget > 0 && tokens >= stopAt(budget))
    return "stop";
  if (budget > 0 && tokens >= warnAt(budget))
    return "warn";
  return "ok";
}
function costEnvelope(state) {
  const planned = typeof state.budget === "number" && state.budget > 0 ? state.budget : budgetForLane(state.lane ?? "");
  const used = typeof state.tokens_est === "number" ? state.tokens_est : 0;
  const remaining = Math.max(planned - used, 0);
  const pct = planned > 0 ? Math.round(used / planned * 100) : 0;
  return {
    planned,
    used,
    remaining,
    pct,
    warn_at: warnAt(planned),
    stop_at: stopAt(planned),
    status: budgetStatus(planned, used)
  };
}
var COST_EVENTS_FILE = "cost-events.jsonl";
function isAllowedMissionDir(dir) {
  if (!dir || dir.includes(".."))
    return false;
  if (dir.includes(".mugiwara/missions"))
    return true;
  if (dir.includes("mugiwara-"))
    return true;
  if (dir.startsWith("/tmp/") && dir.includes("-"))
    return true;
  return false;
}
function assertMissionDir(dir) {
  if (!isAllowedMissionDir(dir))
    throw new Error(`Invalid missionDir: ${dir}`);
}
function appendCostEvent(missionDir, event) {
  assertMissionDir(missionDir);
  mkdirSync4(missionDir, { recursive: true });
  const line = Object.assign({ ts: new Date().toISOString() }, event);
  appendFileSync(join13(missionDir, COST_EVENTS_FILE), JSON.stringify(line) + `
`, "utf8");
}
var COMPRESSED_KIND = "compressed";
var DECISIONS_FILE = "decisions.md";
var OPT_SECTION = "## Cost governor decisions";
function recordOptDecision(missionDir, d) {
  assertMissionDir(missionDir);
  mkdirSync4(missionDir, { recursive: true });
  const file = join13(missionDir, DECISIONS_FILE);
  let hasSection = false;
  try {
    hasSection = readFileSync8(file, "utf8").split(/\r?\n/).some((l) => l.trim() === OPT_SECTION);
  } catch {}
  const ts = new Date().toISOString();
  const flat = (s) => s.replace(/[\r\n]+/g, " ");
  const ev = d.evidence ? ` — evidence: ${flat(d.evidence)}` : "";
  const actor = flat(d.actor).replace(/\s*<[^<>\s]+@[^<>\s]+>/g, "");
  const bullet = `- ${ts} — ${actor}: ${flat(d.decision)} — reason: ${flat(d.reason)}${ev}`;
  const body = hasSection ? `
${bullet}
` : `
${OPT_SECTION}

${bullet}
`;
  appendFileSync(file, body, "utf8");
}

// src/evidence.ts
import { createHash } from "node:crypto";
import { appendFileSync as appendFileSync2, mkdirSync as mkdirSync5, readFileSync as readFileSync9 } from "node:fs";
import { join as join14 } from "node:path";
function fingerprint(content) {
  return createHash("sha256").update(content).digest("hex");
}
var REGISTRY_FILE = "context-registry.jsonl";
function isAllowedMissionDir2(dir) {
  if (!dir || dir.includes(".."))
    return false;
  if (dir.includes(".mugiwara/missions"))
    return true;
  if (dir.includes("mugiwara-"))
    return true;
  if (dir.startsWith("/tmp/") && dir.includes("-"))
    return true;
  return false;
}
function assertMissionDir2(dir) {
  if (!isAllowedMissionDir2(dir))
    throw new Error(`Invalid missionDir: ${dir}`);
}
function loadRegistry(missionDir) {
  assertMissionDir2(missionDir);
  const file = join14(missionDir, REGISTRY_FILE);
  try {
    const out = [];
    for (const line of readFileSync9(file, "utf8").split(/\r?\n/)) {
      if (!line.trim())
        continue;
      let e;
      try {
        e = JSON.parse(line);
      } catch {
        continue;
      }
      if (e === null || typeof e !== "object")
        continue;
      const entry = e;
      const ok = typeof entry.fingerprint === "string" && typeof entry.kind === "string" && typeof entry.file === "string" && typeof entry.id === "string" && typeof entry.ref === "string" && typeof entry.reads === "number" && Number.isFinite(entry.reads) && entry.reads >= 0;
      if (!ok)
        continue;
      entry.reads = Math.floor(entry.reads);
      out.push(entry);
    }
    return out;
  } catch {
    return [];
  }
}

// src/context.ts
function contextStatus(budgetChars, chars) {
  return budgetChars > 0 && chars > budgetChars ? "over" : "ok";
}
function computeContextMetrics(stats) {
  const reuse_rate = stats.reads_total > 0 ? stats.reads_reused / stats.reads_total : 0;
  const duplicate_chars = stats.total_chars - stats.unique_chars;
  return {
    files_loaded: stats.files_loaded,
    repeated_reads: stats.repeated_reads,
    duplicate_chars,
    reuse_rate,
    read_avoidance_chars: duplicate_chars
  };
}

// src/reporting.ts
import { existsSync as existsSync11, readFileSync as readFileSync10 } from "node:fs";
import { join as join15 } from "node:path";
function isAllowedMissionDir3(dir) {
  if (!dir || dir.includes(".."))
    return false;
  if (dir.includes(".mugiwara/missions"))
    return true;
  if (dir.includes("mugiwara-"))
    return true;
  if (dir.startsWith("/tmp/") && dir.includes("-"))
    return true;
  return false;
}
function assertMissionDir3(dir) {
  if (!isAllowedMissionDir3(dir))
    throw new Error(`Invalid missionDir: ${dir}`);
}
function parseDecisionTrail(missionDir) {
  assertMissionDir3(missionDir);
  const file = join15(missionDir, "decisions.md");
  if (!existsSync11(file))
    return [];
  const raw = readFileSync10(file, "utf8");
  const lines = raw.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => l.trim() === "## Cost governor decisions" || l.trim() === "## Budget");
  const scan = headerIdx >= 0 ? lines.slice(headerIdx) : lines;
  const out = [];
  const bulletRe = /^-\s+(.+?)\s+—\s+(.+?):\s+(.+?)\s+—\s+reason:\s+(.+?)(?:\s+—\s+evidence:\s+(.+))?\s*$/;
  for (const line of scan) {
    const m = bulletRe.exec(line.trim());
    if (!m)
      continue;
    out.push({ ts: m[1], actor: m[2], decision: m[3], reason: m[4], ...m[5] ? { evidence: m[5] } : {} });
  }
  return out;
}
function summarizeAdaptation(missionDir) {
  const trail = parseDecisionTrail(missionDir);
  const postureRe = /posture|switch|adapt|pause|parallel-workers|context-relief|phase-isolated|team-scoped/i;
  const rows = trail.filter((t) => postureRe.test(`${t.decision} ${t.reason}`)).map((t) => ({ ts: t.ts, decision: t.decision, reason: t.reason }));
  return { count: rows.length, rows };
}
function renderAdaptationSection(missionDir) {
  const { count, rows } = summarizeAdaptation(missionDir);
  if (count === 0)
    return "";
  const lines = ["", "## Adaptation", "", "| Time | Decision | Reason |", "|---|---|---|"];
  for (const r of rows)
    lines.push(`| ${r.ts} | ${r.decision} | ${r.reason} |`);
  if (rows.length === 0)
    lines.push("| — | (posture rows recorded in decisions.md) | |");
  return lines.join(`
`);
}

// src/report-fold.ts
var TOPICS = {
  spec: { title: "Spec", flow: "-", crew: "-" },
  todos: { title: "Tasks", flow: "-", crew: "-" },
  execution: { title: "Implementation", flow: "3", crew: "Zoro" },
  audit: { title: "Audit", flow: "4", crew: "Chopper" },
  quality: { title: "Quality", flow: "5", crew: "Sanji" },
  gates: { title: "Coverage", flow: "6", crew: "Franky" },
  security: { title: "Security", flow: "7", crew: "Jinbe" },
  review: { title: "Review", flow: "7", crew: "Robin" },
  healing: { title: "Fixes", flow: "8", crew: "Brook" },
  verifier: { title: "Verification", flow: "4.5", crew: "Skeptic" },
  closure: { title: "Closure", flow: "9", crew: "Luffy" },
  decisions: { title: "Decisions", flow: "-", crew: "-" },
  blockers: { title: "Blockers", flow: "-", crew: "-" }
};
var LABELLED = {
  Review: { agent: "robin-reviewer", name: "Robin" },
  Security: { agent: "jinbe-security", name: "Jinbe" }
};
var ORDER = ["Spec", "Tasks", "Implementation", "Audit", "Quality", "Coverage", "Security", "Review", "Fixes", "Verification", "Closure"];
var COST_GOV = /^## Cost governor decisions[^\n]*\n[\s\S]*?(?=^## |(?![\s\S]))/m;
var TOOLING_LINE = /^(Context footprint:|Ranked reading order for ).*$/gm;
function topicFor(name) {
  const stem = name.replace(/\.md$/, "").replace(/^\d+-/, "");
  const known = TOPICS[stem];
  if (known)
    return known;
  const words = stem.replace(/[-_]+/g, " ").trim();
  return { title: words ? words[0].toUpperCase() + words.slice(1) : "Notes", flow: "-", crew: "-" };
}
function cleanBody(raw, tooling) {
  let body = raw.replace(/\r\n/g, `
`).trim();
  for (let i = 0;i < 2; i++) {
    const m = body.match(/^#{1,2} [^\n]*\n*/);
    if (!m)
      break;
    body = body.slice(m[0].length);
  }
  body = body.replace(TOOLING_LINE, (l) => {
    tooling.push(l.trim());
    return "";
  });
  let fence = false;
  body = body.split(`
`).map((l) => {
    if (/^```/.test(l))
      fence = !fence;
    return !fence && /^#{1,2} /.test(l) ? `#${l}` : l;
  }).join(`
`);
  return body.replace(/\n{3,}/g, `

`).trim();
}
function parseSeed(seed) {
  const lines = seed.replace(/\r\n/g, `
`).split(`
`);
  let i = 0;
  while (i < lines.length && !lines[i].trim())
    i++;
  let title = null;
  if (/^# /.test(lines[i] ?? "")) {
    title = lines[i].slice(2).trim();
    i++;
  }
  const parts = lines.slice(i).join(`
`).split(/^(?=## )/m);
  const first = parts[0] ?? "";
  const hasHead = !first.startsWith("## ");
  const intro = (hasHead ? first : "").split(`
`).filter((l) => !(l.includes(" · ") && /lane/i.test(l))).join(`
`).trim();
  const sections = parts.slice(hasHead ? 1 : 0).map((p) => {
    const nl = p.indexOf(`
`);
    return { title: (nl === -1 ? p : p.slice(0, nl)).slice(3).trim(), text: nl === -1 ? "" : p.slice(nl + 1).trim() };
  });
  return { title, intro, sections };
}
function buildReport(o) {
  const tooling = [...o.tooling];
  const seed = parseSeed(o.seed);
  const seedHas = (t) => seed.sections.some((s) => s.title.toLowerCase() === t.toLowerCase());
  const seedSec = (t) => seed.sections.find((s) => s.title.toLowerCase() === t.toLowerCase());
  const groups = new Map;
  const evidence = [];
  for (const f of o.files) {
    const topic = topicFor(f.name);
    if (o.seedIsClosure && topic.title === "Closure") {
      evidence.push({ title: "Summary", file: f.name, topic });
      continue;
    }
    let raw = f.body;
    if (topic.title === "Decisions") {
      const gov = raw.match(COST_GOV);
      if (gov) {
        tooling.push(gov[0].trim());
        raw = raw.replace(COST_GOV, "");
      }
    }
    let body = cleanBody(raw, tooling);
    if (!body)
      continue;
    const who = LABELLED[topic.title];
    if (who) {
      const label = (o.dispatched ?? []).includes(who.agent) ? `*Checked independently: ${who.name} ran as a separate agent with fresh context.*` : "*Checked inline: the same conversation and model that wrote the change.*";
      body = `${label}

${body}`;
    }
    groups.set(topic.title, [...groups.get(topic.title) ?? [], body]);
    evidence.push({ title: topic.title, file: f.name, topic });
  }
  const out = [`# ${seed.title ?? `Mission: ${o.mission}`}`];
  const summary = [seed.intro, o.changeLine].filter(Boolean).join(`

`);
  if (summary)
    out.push(summary);
  out.push(`## Verdict

${seedSec("Verdict")?.text || fallbackVerdict(o.files.map((f) => f.body))}`);
  const reserved = new Set(["verdict", "cost", "decisions", "not verified", "gates", "review order", "where to start reviewing"]);
  for (const s of seed.sections) {
    if (!reserved.has(s.title.toLowerCase()))
      out.push(`## ${s.title}

${s.text}`);
  }
  const titles = [...groups.keys()].filter((t) => t !== "Decisions" && t !== "Blockers");
  titles.sort((a, b) => {
    const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
    return (ia === -1 ? ORDER.length : ia) - (ib === -1 ? ORDER.length : ib) || a.localeCompare(b);
  });
  for (const t of titles)
    out.push(`## ${t}

${groups.get(t).join(`

`)}`);
  const decisions = seedSec("Decisions")?.text ?? (groups.get("Decisions") ?? []).join(`

`);
  if (decisions)
    out.push(`## Decisions

${decisions}`);
  else if (o.hasState)
    out.push(`## Decisions

No decisions recorded.`);
  if (groups.has("Blockers"))
    out.push(`## Blockers

${groups.get("Blockers").join(`

`)}`);
  const notVerified = seedSec("Not verified")?.text;
  if (notVerified)
    out.push(`## Not verified

${notVerified}`);
  else if (o.absent?.length)
    out.push(`## Not verified

No ${o.absent.join(" and no ")} in the mission folder, so that part was not checked or not recorded.`);
  else if (o.hasState)
    out.push(`## Not verified

No list of unverified items was recorded. Treat that as unknown, not as "nothing".`);
  const seedCost = seedSec("Cost")?.text;
  out.push(seedCost ? `## Cost

${seedCost}` : o.cost.trim());
  const seedOrder = seedSec("Where to start reviewing") ?? seedSec("Review order");
  out.push(seedOrder ? `## ${seedOrder.title}

${seedOrder.text}` : o.routing.trim());
  const ev = [
    "## Evidence",
    "",
    "Where each part of this report came from. Crew names and Flow numbers appear only here.",
    "",
    ...evidence.some((e) => (e.title in LABELLED)) ? ['The Review and Security labels come from a record kept by the tooling, not from the review text. "Checked independently" means that reviewer was started as a separate agent with fresh context. "Checked inline" means the same conversation and model that wrote the change did the check.', ""] : [],
    "| Section | Source file | Flow | Crew |",
    "|---|---|---|---|"
  ];
  for (const e of evidence)
    ev.push(`| ${e.title} | \`${e.file}\` | ${e.topic.flow} | ${e.topic.crew} |`);
  if (seedHas("Gates"))
    ev.push("", "### Gates", "", seedSec("Gates").text);
  const log = [...new Set(tooling.map((t) => t.trim()).filter(Boolean))];
  if (log.length)
    ev.push("", "<details>", "<summary>Tooling log</summary>", "", ...log.flatMap((l) => [l, ""]), "</details>");
  out.push(ev.join(`
`));
  return out.filter(Boolean).join(`

`).replace(/\n{3,}/g, `

`) + `
`;
}
function fallbackVerdict(bodies) {
  const all = bodies.join(`
`);
  if (/\bNO-GO\b|\bneeds fixes\b|\bnot ready\b|^\s*[-*]?\s*\**(verdict|result|status)\**\s*:?\s*\**\s*FAIL/im.test(all)) {
    return "**Needs fixes.** A check in the trail failed. Read the sections below before merging.";
  }
  if (!/\b(PASS|passed|ready for review)\b/i.test(all))
    return "**Not enough evidence.** The trail holds no check result, so nothing is claimed as ready.";
  return "**Ready for review.** The recorded checks passed.";
}

// src/mission.ts
init_config();

// src/posture.ts
function selectPosture(input) {
  if (input.governor === "stop") {
    return {
      posture: "inline-sequential",
      pause: true,
      reason: "governor stop — pause safely, keep inline; state + continue emitted",
      evidence_refs: ["governor circuit-breaker", "state.json"]
    };
  }
  if (input.team_members > 1) {
    return {
      posture: "team-scoped",
      pause: false,
      reason: `${input.team_members} team members with non-overlapping scope`,
      evidence_refs: ["plan ownership map"]
    };
  }
  if (input.phases > 3 || input.plan_lines > 1500) {
    return {
      posture: "phase-isolated",
      pause: false,
      reason: `large campaign — ${input.phases} phases / ${input.plan_lines} lines`,
      evidence_refs: ["plan.md", "large-campaign-subplan.md"]
    };
  }
  if (input.context_pressure && input.order_dependent) {
    return {
      posture: "context-relief",
      pause: false,
      reason: "context pressure with ordered dependent tasks — one worker at a time, order preserved",
      evidence_refs: ["state context metrics", "remaining task order"]
    };
  }
  if (input.independent_tasks >= 2) {
    if (input.lane !== "full") {
      return {
        posture: "inline-batched",
        pause: false,
        reason: `${input.independent_tasks} independent tasks on lane ${input.lane} — below the dispatch floor (~132k/worker vs ~5k inline); batch them inline`,
        evidence_refs: ["Nami dependency map", "cost-governor dispatch floor"]
      };
    }
    return {
      posture: "parallel-workers",
      pause: false,
      reason: `${input.independent_tasks} independent tasks, no shared files/interfaces, lane ${input.lane} — dispatch cost amortized`,
      evidence_refs: ["Nami dependency map", "work-governor delegation verdict"]
    };
  }
  return {
    posture: "inline-sequential",
    pause: false,
    reason: "no parallel/phase/team/relief trigger — default inline in plan order",
    evidence_refs: ["triage route", "lane"]
  };
}

// src/scope.ts
function detectScopeDrift(input) {
  const outside = input.touched_files.filter((f) => !input.declared_scope.some((tok) => f.includes(tok)));
  const scope_score = input.touched_files.length === 0 ? 0 : outside.length / input.touched_files.length;
  if (outside.length === 0) {
    return { change: input.change, drift: false, reason: "within declared scope", scope_score };
  }
  return {
    change: input.change,
    drift: true,
    reason: `outside declared scope: ${outside.join(", ")}`,
    scope_score
  };
}

// src/slop.ts
function detectRetrySlop(input) {
  const kind = "retry";
  if (input.outcome !== "fail")
    return { slop: false, reason: "no slop — outcome is pass", kind };
  const found = input.history.some((h) => h.action === input.action && h.evidence_fingerprint === input.evidence_fingerprint && h.outcome === "fail");
  if (found)
    return { slop: true, reason: `slop: retry — same action ${input.action} with same evidence ${input.evidence_fingerprint} repeatedly failing`, kind };
  return { slop: false, reason: "no slop — no matching failed history", kind };
}
function detectScopeSlop(input) {
  const kind = "scope";
  const outOfScope = input.files_changed.filter((f) => !input.declared_scope.includes(f));
  const hasScopeDrift = outOfScope.length > 0 || input.unrelated_refactors.length > 0;
  if (hasScopeDrift && !input.acceptance_expanded) {
    const names = [...outOfScope, ...input.unrelated_refactors].join(", ");
    return { slop: true, reason: `slop: scope — out-of-scope ${names} without acceptance expansion`, kind };
  }
  return { slop: false, reason: "no scope slop — within declared scope or acceptance expanded", kind };
}
function detectCodeSlop(input) {
  const kind = "code";
  if (input.acceptance_expanded || input.justification_provided) {
    return { slop: false, reason: "no code slop — acceptance expanded or justified", kind };
  }
  const signals = [];
  if (input.new_abstractions > 0)
    signals.push(`abstractions ${input.new_abstractions}`);
  if (input.new_dependencies > 0)
    signals.push(`dependencies ${input.new_dependencies}`);
  if (input.boilerplate_chars > 0)
    signals.push(`boilerplate ${input.boilerplate_chars} chars`);
  if (input.loc_added > 100)
    signals.push(`loc ${input.loc_added}`);
  if (signals.length > 0)
    return { slop: true, reason: `slop: code — ${signals.join("; ")} without acceptance or justification`, kind };
  return { slop: false, reason: "no code slop", kind };
}
function recordSlopDecision(missionDir, d) {
  const prefix = d.kind ? `[${d.kind}] ` : "";
  recordOptDecision(missionDir, {
    actor: "slop-governor",
    decision: `${prefix}${d.decision}`,
    reason: d.reason,
    evidence: d.evidence
  });
}

// src/work.ts
function detectDuplicateExplanation(input) {
  const groups = new Map;
  for (const exp of input.explanations) {
    const fp = fingerprint(exp);
    groups.set(fp, [...groups.get(fp) ?? [], exp]);
  }
  const duplicate_groups = [...groups.values()].filter((g) => g.length >= 2);
  const duplicate = duplicate_groups.length > 0;
  const reason = duplicate ? `${duplicate_groups.length} duplicate group(s) — ${duplicate_groups.length} duplicate explanation(s) found` : "no duplicate explanations";
  return { duplicate, reason, duplicate_groups };
}
function retryWasteFinding(input) {
  const retry = input.retry ? detectRetrySlop({
    action: input.retry.action,
    evidence_fingerprint: input.retry.evidence_fingerprint,
    outcome: input.retry.outcome,
    history: input.retry.history
  }) : { slop: false, reason: "no slop — no retry signal" };
  return { kind: "retry", slop: retry.slop, reason: retry.reason };
}
function codeWasteFinding(input) {
  const code = detectCodeSlop({
    new_abstractions: input.new_abstractions ?? 0,
    new_dependencies: input.new_dependencies ?? 0,
    loc_added: input.loc_added ?? 0,
    acceptance_expanded: input.acceptance_expanded,
    justification_provided: input.justification_provided ?? false,
    boilerplate_chars: input.boilerplate_chars ?? 0
  });
  return { kind: "code", slop: code.slop, reason: code.reason };
}
function outputWasteFinding(input) {
  const dup = (input.explanations?.length ?? 0) > 0 ? detectDuplicateExplanation({ explanations: input.explanations ?? [] }) : { duplicate: false, reason: "no slop — no output signal" };
  const output = dup.duplicate ? { slop: true, reason: `slop: output — ${dup.reason}` } : { slop: false, reason: dup.reason };
  return { kind: "output", slop: output.slop, reason: output.reason };
}
function scopeWasteFinding(input) {
  const drift = detectScopeDrift({
    change: input.change,
    declared_scope: input.declared_scope,
    touched_files: input.files_changed
  });
  const scopeSlop = detectScopeSlop({
    files_changed: input.files_changed,
    declared_scope: input.declared_scope,
    acceptance_expanded: input.acceptance_expanded,
    unrelated_refactors: input.unrelated_refactors ?? []
  });
  const scope = input.acceptance_expanded ? { slop: false, reason: "no scope slop — acceptance expanded" } : drift.drift ? { slop: true, reason: `slop: scope — ${drift.reason}` } : { slop: scopeSlop.slop, reason: scopeSlop.reason };
  return { kind: "scope", slop: scope.slop, reason: scope.reason };
}
function assembleWasteFindings(input) {
  return [
    retryWasteFinding(input),
    codeWasteFinding(input),
    outputWasteFinding(input),
    scopeWasteFinding(input)
  ];
}
function runWasteChecks(input) {
  const findings = assembleWasteFindings(input);
  return { change: input.change, findings, slop: findings.some((f) => f.slop), advisory: true };
}
function recordWasteChecks(missionDir, result) {
  for (const f of result.findings) {
    if (!f.slop)
      continue;
    recordSlopDecision(missionDir, {
      decision: `waste check: ${result.change}`,
      reason: f.reason,
      evidence: result.change,
      kind: f.kind
    });
  }
}

// src/mission.ts
function isStateFile(f) {
  const stem = f.replace(/\.json$/, "");
  return f.endsWith(".json") && stem !== "continue" && !stem.startsWith("continue-");
}
function orderedStateFiles(files) {
  return files.filter(isStateFile).sort((a, b) => a === "state.json" ? -1 : b === "state.json" ? 1 : a.localeCompare(b));
}
function primaryState(dir, files) {
  const name = files.includes("state.json") ? "state.json" : files.find((f) => f.endsWith(".json") && f !== "continue.json" && !f.startsWith("continue-"));
  if (!name)
    return null;
  try {
    return JSON.parse(readFileSync11(join16(dir, name), "utf8"));
  } catch {
    return null;
  }
}
function tasksFromState(state) {
  if (!state)
    return { done: 0, total: 0 };
  const t = state.tasks;
  if (t && typeof t.done === "number" && typeof t.total === "number")
    return { done: t.done, total: t.total };
  const done = Number(state.tasks_done);
  const total = Number(state.tasks_total);
  return { done: Number.isFinite(done) ? done : 0, total: Number.isFinite(total) ? total : 0 };
}
function countPlanTasks(missionDir) {
  let total = 0;
  let done = 0;
  const planFile = join16(missionDir, "plan.md");
  if (existsSync12(planFile)) {
    try {
      const text = readFileSync11(planFile, "utf8");
      for (const line of text.split(/\r?\n/)) {
        if (/^\s*-\s*\[[ xX]\]/.test(line)) {
          total++;
          if (/^\s*-\s*\[[xX]\]/.test(line))
            done++;
        }
      }
    } catch {}
  }
  if (total === 0) {
    const subPlanDir = join16(missionDir, "sub-plan");
    if (existsSync12(subPlanDir)) {
      try {
        for (const f of readdirSync6(subPlanDir)) {
          if (!f.endsWith(".md"))
            continue;
          const text = readFileSync11(join16(subPlanDir, f), "utf8");
          for (const line of text.split(/\r?\n/)) {
            if (/^\s*-\s*\[[ xX]\]/.test(line)) {
              total++;
              if (/^\s*-\s*\[[xX]\]/.test(line))
                done++;
            }
          }
        }
      } catch {}
    }
  }
  return { done, total };
}
function changedFiles2(projectDir, state) {
  const base = typeof state?.base_sha === "string" ? state.base_sha : "";
  const branch = typeof state?.branch === "string" ? state.branch : "";
  if (!base || base === "unknown" || !branch)
    return [];
  try {
    return execFileSync4("git", ["diff", "--name-only", base, branch], {
      cwd: projectDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}
function rosterSize(missionDir) {
  const plan = join16(missionDir, "plan.md");
  if (!existsSync12(plan))
    return 1;
  const text = readFileSync11(plan, "utf8");
  const assignees = new Set;
  let inTable = false;
  for (const line of text.split(`
`)) {
    const lower = line.trim().toLowerCase();
    if (lower.startsWith("| id ") && lower.includes("| name ")) {
      inTable = true;
      continue;
    }
    if (inTable) {
      if (!line.trim().startsWith("|"))
        break;
      if (/^\|[\s:-]+\|/.test(line))
        continue;
      const cols = line.split("|").map((c) => c.trim());
      const who = cols[3];
      if (who && who !== "-")
        assignees.add(who);
    }
  }
  return assignees.size || 1;
}
function rosterAssignees(missionDir) {
  const plan = join16(missionDir, "plan.md");
  if (!existsSync12(plan))
    return [];
  const text = readFileSync11(plan, "utf8");
  const assignees = new Set;
  let inTable = false;
  for (const line of text.split(`
`)) {
    const lower = line.trim().toLowerCase();
    if (lower.startsWith("| id ") && lower.includes("| name ")) {
      inTable = true;
      continue;
    }
    if (inTable) {
      if (!line.trim().startsWith("|"))
        break;
      if (/^\|[\s:-]+\|/.test(line))
        continue;
      const cols = line.split("|").map((c) => c.trim());
      const who = cols[3];
      if (who && who !== "-")
        assignees.add(who);
    }
  }
  return [...assignees];
}
function readMemberStates(missionDir) {
  if (!existsSync12(missionDir))
    return [];
  const out = [];
  for (const f of orderedStateFiles(readdirSync6(missionDir))) {
    try {
      const raw = JSON.parse(readFileSync11(join16(missionDir, f), "utf8"));
      const member = f === "state.json" ? null : f.slice(0, -".json".length);
      const flow = Number(raw.flow ?? raw.wave ?? 0);
      if (member !== null && !/^[A-Za-z0-9._-]+$/.test(member))
        continue;
      if (member === "continue")
        continue;
      out.push({ member, flow: Number.isFinite(flow) ? flow : 0 });
    } catch {}
  }
  return out;
}
function closureBlockers(missionDir, mission) {
  const roster = rosterAssignees(missionDir);
  const states = readMemberStates(missionDir);
  const problems = [];
  for (const who of roster) {
    const s = states.find((x) => x.member === who);
    if (!s)
      problems.push(`  ${who.padEnd(12)} assigned, never started`);
    else if (s.flow < 9)
      problems.push(`  ${who.padEnd(12)} Flow ${s.flow}, still in flight`);
  }
  for (const s of states) {
    if (s.member && roster.length && !roster.includes(s.member)) {
      problems.push(`  ${s.member.padEnd(12)} has state but no sub-mission in plan.md`);
    }
  }
  if (states.some((x) => !x.member) && !states.some((x) => x.member) && roster.length) {
    problems.push(`  plan names ${roster.length} assignee(s) but mission is solo — use "-" for solo rows or run: mugiwara migrate --to-team <member>`);
  }
  return problems;
}
function archiveMission(projectDir, mission, opts = {}) {
  const { dryRun = false, force = false } = opts;
  const root = join16(projectDir, ".mugiwara");
  if (!mission || /[^a-zA-Z0-9._-]/.test(mission) || /^\.+$/.test(mission))
    throw new Error(`invalid mission name "${mission}" (allowlist: [a-zA-Z0-9._-], not a dot-path)`);
  const removed = [];
  const kept = [];
  const dir = join16(root, "missions", mission);
  if (!existsSync12(dir))
    return { report: null, removed, kept };
  if (!dryRun) {
    const blockers = closureBlockers(dir, mission);
    if (blockers.length && !force) {
      const msg = `closure blocked — mission "${mission}" is not finished:
${blockers.join(`
`)}

  Every assignee must reach Flow 9. Run \`mugiwara status\` to check.
  Use --force to archive anyway — in-flight resume points will be lost.`;
      throw new Error(msg);
    }
  }
  if (!dryRun) {
    const issues = checkTrail(dir, projectDir);
    const blocking = issues.filter((i) => i.kind !== "secret-warn" && i.severity !== "warn");
    if (blocking.length) {
      throw new Error(`closure integrity gate failed — fix these before archiving:
${formatIssues(blocking)}`);
    }
    if (issues.length && blocking.length === 0) {
      try {
        const warnText = formatIssues(issues);
        if (warnText)
          console.warn(`closure integrity warnings (non-blocking):
${warnText}`);
      } catch {}
    }
    const artifacts = checkMissionArtifacts(dir, { unplanned: opts.unplanned });
    if (!artifacts.ok) {
      throw new Error(`archive artifact gate failed — missing: ${artifacts.missing.join(", ")} (lane ${artifacts.lane}). Record what actually ran with: mugiwara record <execution|audit|quality|gates|healing|closure> (or mugiwara close <mission>) before archiving; never invent evidence.`);
    }
    if (!opts.attestationChecked) {
      let required = false;
      try {
        required = !!loadPolicy(projectDir)?.attestation?.required;
      } catch (e) {
        if (e.message.startsWith("unknown policy key"))
          throw e;
      }
      if (required)
        throw new Error("closure integrity gate failed — attestation required but not checked: run `mugiwara archive` (CLI) or await requireAttestation() first");
    }
  }
  const files = readdirSync6(dir);
  const state = primaryState(dir, files);
  if (!dryRun && !force && state) {
    const risky = state.lane === "full" || Array.isArray(state.sensitive_paths) && state.sensitive_paths.length > 0;
    const ledgerActive = existsSync12(join16(root, ".engaged")) || existsSync12(join16(root, "review-dispatch.jsonl"));
    if (risky && ledgerActive && readConfig2(projectDir).independent_review !== "off") {
      const ran = dispatchedAgents2(projectDir, mission);
      const missing = [
        ran.has("robin-reviewer") ? "" : "the review (Robin)",
        ran.has("jinbe-security") ? "" : "the security check (Jinbe)"
      ].filter(Boolean);
      if (missing.length) {
        throw new Error(`closure blocked — mission "${mission}" has not had ${missing.join(" and ")} run as a separate agent. This change touches a risky area, so those checks must not be done in the conversation that wrote it. Run the missing check as a separate agent, then close again; or set independent_review=off in .mugiwara/config to accept an inline check (--force also archives, and the report then says the check was inline).`);
      }
    }
  }
  try {
    if (state) {
      const sRisk = Array.isArray(state.sensitive_paths) && state.sensitive_paths.length ? "high" : "low";
      const sTokens = typeof state.tokens_est === "number" ? state.tokens_est : 0;
      const sBudget = typeof state.budget === "number" ? state.budget : 0;
      selectPosture({
        lane: typeof state.lane === "string" ? state.lane : "standard",
        risk: sRisk,
        independent_tasks: 0,
        order_dependent: true,
        context_pressure: sBudget > 0 && sTokens > sBudget * 0.6,
        team_members: rosterSize(dir),
        phases: 1,
        plan_lines: 0,
        governor: state.budget_status === "stop" ? "stop" : state.budget_status === "warn" ? "avoid" : "normal"
      });
      try {
        const wFiles = changedFiles2(projectDir, state);
        if (wFiles.length) {
          const wCheck = runWasteChecks({
            change: `archive:${mission}`,
            files_changed: wFiles,
            declared_scope: wFiles,
            acceptance_expanded: true
          });
          recordWasteChecks(dir, wCheck);
        }
      } catch {}
    }
  } catch {}
  const stageModels = [...new Set(orderedStateFiles(files).map((f) => {
    try {
      const s = JSON.parse(readFileSync11(join16(dir, f), "utf8"));
      return typeof s.model === "string" ? s.model : "";
    } catch {
      return "";
    }
  }).filter(Boolean))];
  let costSection = "";
  const toolingLog = [];
  if (!dryRun && state) {
    const chars = measureContextChars(dir);
    const budget = readBudgetConfig(projectDir);
    const footprintLine = formatFootprint(chars, budget);
    const est = typeof state.tokens_est === "number" ? state.tokens_est : 0;
    const src = typeof state.tokens_source === "string" ? state.tokens_source : "computed";
    const lane = typeof state.lane === "string" ? state.lane : "unknown";
    const laneBudget = budgetForLane(lane);
    const env = costEnvelope({ lane, budget: laneBudget, tokens_est: est });
    const effBudget = budget || laneBudget;
    const delta = effBudget ? est <= effBudget ? `${(effBudget - est).toLocaleString()} under` : `${(est - effBudget).toLocaleString()} over` : "no budget configured";
    const srcLabel = src === "reported" ? "provider-reported" : "estimator";
    const statusLabel = env.status.toUpperCase();
    const ctxStatus = contextStatus(budget, chars);
    const registry = loadRegistry(dir);
    const reads_total = registry.reduce((s, e) => s + e.reads, 0);
    const repeated_reads = registry.reduce((s, e) => s + Math.max(e.reads - 1, 0), 0);
    const unique_chars = registry.reduce((s, e) => s + (e.chars ?? 0), 0);
    const total_chars = registry.reduce((s, e) => s + (e.chars ?? 0) * e.reads, 0);
    const charTracked = registry.length > 0 && total_chars > 0;
    const metrics = registry.length ? computeContextMetrics({
      files_loaded: registry.length,
      reads_total,
      reads_reused: repeated_reads,
      unique_chars,
      total_chars,
      repeated_reads
    }) : { files_loaded: 0, repeated_reads: 0, duplicate_chars: 0, reuse_rate: 0, read_avoidance_chars: 0 };
    const ctxNote = registry.length ? charTracked ? "" : " (char data not tracked)" : " (no registry — reads not tracked)";
    let reportedTotal = 0;
    let hasReported = false;
    let processEst = 0;
    let cacheRead = 0;
    let cacheCreate = 0;
    for (const f of files.filter(isStateFile)) {
      try {
        const s = JSON.parse(readFileSync11(join16(dir, f), "utf8"));
        if (s.tokens_source === "reported" && typeof s.tokens_est === "number") {
          reportedTotal += s.tokens_est;
          hasReported = true;
          if (typeof s.tokens_process_est === "number")
            processEst += s.tokens_process_est;
          if (typeof s.tokens_cache_read === "number")
            cacheRead += s.tokens_cache_read;
          if (typeof s.tokens_cache_creation === "number")
            cacheCreate += s.tokens_cache_creation;
        }
      } catch {}
    }
    if (!hasReported && src === "reported" && est > 0) {
      reportedTotal = est;
      hasReported = true;
    }
    const healCycleVal = typeof state.heal_cycle === "number" ? state.heal_cycle : 1;
    const pctOf = (n) => effBudget ? ` of ${effBudget.toLocaleString()} tokens (${Math.round(n / effBudget * 100)}%)` : " tokens";
    if (hasReported && reportedTotal) {
      costSection = `## Cost

${processEst ? `Process estimate: ${processEst.toLocaleString()}${pctOf(processEst)}.` : "The process estimate was not recorded."}
`;
      costSection += `
Provider-reported: ${reportedTotal.toLocaleString()} input and output tokens` + (cacheRead || cacheCreate ? `, plus ${cacheRead.toLocaleString()} cache reads and ${cacheCreate.toLocaleString()} cache writes` : "") + `.
`;
    } else {
      costSection = `## Cost

Used **${est.toLocaleString()}** of ${effBudget ? effBudget.toLocaleString() : "—"} tokens${effBudget ? ` (${env.pct}%)` : ""}.
`;
    }
    toolingLog.push(`Lane \`${lane}\`, ${healCycleVal} heal cycle${healCycleVal === 1 ? "" : "s"}.`);
    try {
      const adaptation = renderAdaptationSection(dir).trim();
      if (adaptation)
        toolingLog.push(adaptation.replace(/^## /, "### "));
    } catch {}
    if (shouldCompress(budget, chars)) {
      try {
        const flowsDir2 = join16(dir, "flows");
        const wavesDir = join16(dir, "waves");
        const targetDir = existsSync12(flowsDir2) ? flowsDir2 : existsSync12(wavesDir) ? wavesDir : null;
        if (targetDir && existsSync12(targetDir)) {
          const flowFiles = readdirSync6(targetDir).filter((f) => f.endsWith(".md"));
          if (flowFiles.length) {
            const pct = Math.round(chars / budget * 100);
            const stub = `# Compressed trail

Trail ${chars} chars exceeds ${pct}% of budget ${budget} (threshold ${compressThreshold(budget)}) — flows archived as stub to preserve budget. Original flows: ${flowFiles.join(", ")}
`;
            for (const f of flowFiles) {
              try {
                rmSync(join16(targetDir, f), { force: true });
              } catch {}
            }
            writeFileSync6(join16(targetDir, "00-compressed.md"), stub);
          }
        }
        appendCostEvent(dir, {
          kind: COMPRESSED_KIND,
          mission,
          tokens_est: est,
          budget: laneBudget,
          status: "compressed",
          context_chars: chars,
          context_status: ctxStatus,
          context_metrics: metrics
        });
        toolingLog.push(`Context compressed: ${chars} chars is over 80% of the ${budget} budget; flow files were replaced by 00-compressed.md.`);
      } catch {}
    }
    appendCostEvent(dir, {
      kind: "closure",
      mission,
      tokens_est: est,
      budget: laneBudget,
      status: env.status,
      context_chars: chars,
      context_status: ctxStatus,
      context_metrics: metrics
    });
    if (budget && chars > budget) {
      throw new Error(`closure context budget failed — ${footprintLine}. Trim the trail or raise context_budget_chars.`);
    }
  }
  if (!dryRun && !state) {
    const chars = measureContextChars(dir);
    const budget = readBudgetConfig(projectDir);
    if (budget && chars > budget) {
      throw new Error(`closure context budget failed — ${formatFootprint(chars, budget)}. Trim the trail or raise context_budget_chars.`);
    }
  }
  const FOLD_TOP = ["decisions.md", "blockers.md", "review.md", "security.md", "spec.md"];
  const fold = [];
  for (const f of FOLD_TOP) {
    if (files.includes(f))
      fold.push(f);
  }
  const PR_VERDICT = "pr-verdict.md";
  const PR_VERDICT_SRC = join16("flows", "07-pr-verdict.md");
  const flowsDir = join16(dir, "flows");
  const legacyWavesDir = join16(dir, "waves");
  const artDir = existsSync12(flowsDir) ? flowsDir : existsSync12(legacyWavesDir) ? legacyWavesDir : flowsDir;
  const artRel = artDir === legacyWavesDir ? "waves" : "flows";
  if (existsSync12(artDir)) {
    for (const f of readdirSync6(artDir).sort()) {
      if (artRel === "flows" && f === "07-pr-verdict.md")
        continue;
      fold.push(join16(artRel, f));
    }
  }
  const hasCostEvents = existsSync12(join16(dir, "cost-events.jsonl"));
  const hasRegistry = existsSync12(join16(dir, "context-registry.jsonl"));
  let report = "";
  const reportPath = join16(dir, "report.md");
  if (files.includes("report.md"))
    report = readFileSync11(reportPath, "utf8");
  else if (existsSync12(join16(artDir, "06-closure.md")))
    report = readFileSync11(join16(artDir, "06-closure.md"), "utf8");
  if (!dryRun) {
    mkdirSync6(dir, { recursive: true });
    const prVerdictSrc = join16(dir, PR_VERDICT_SRC);
    if (existsSync12(prVerdictSrc)) {
      const prVerdictPath = join16(dir, PR_VERDICT);
      writeFileSync6(prVerdictPath, readFileSync11(prVerdictSrc, "utf8"));
      kept.push(join16("missions", mission, PR_VERDICT));
    }
    const rs = state;
    const num = (k) => rs && typeof rs[k] === "number" ? rs[k] : 0;
    const sens = rs && Array.isArray(rs.sensitive_paths) ? rs.sensitive_paths : [];
    const changeLine = state ? `${num("files_touched")} file${num("files_touched") === 1 ? "" : "s"} changed (+${num("loc_ins")} / -${num("loc_del")}) on branch \`${typeof state.branch === "string" ? state.branch : "unknown"}\`, closed ${new Date().toISOString().slice(0, 10)}.` + (sens.length ? ` Sensitive paths touched: \`${sens.join("`, `")}\`.` : "") : "";
    const routingSection = state ? renderRouting(rankFiles(changedFiles2(projectDir, state), {
      mission,
      evidence: Array.isArray(state.evidence) ? state.evidence : [],
      sensitive_paths: Array.isArray(state.sensitive_paths) ? state.sensitive_paths : []
    }), mission) : "";
    const seedIsClosure = !files.includes("report.md") && existsSync12(join16(artDir, "06-closure.md"));
    const folded = fold.map((f) => ({ name: f.split("/").pop() ?? f, body: readFileSync11(join16(dir, f), "utf8") }));
    const hasReportBody = fold.length > 0 || changeLine || routingSection || costSection;
    if (hasReportBody || !existsSync12(reportPath)) {
      const tmp = `${reportPath}.tmp`;
      writeFileSync6(tmp, buildReport({
        mission,
        seed: report,
        seedIsClosure,
        files: folded,
        changeLine,
        cost: costSection,
        routing: routingSection,
        tooling: toolingLog,
        hasState: !!state,
        dispatched: [...dispatchedAgents2(projectDir, mission)],
        absent: [...opts.unplanned ? ["plan.md"] : [], "review.md", "security.md"].filter((f) => !files.includes(f))
      }));
      renameSync(tmp, reportPath);
    }
    for (const f of fold) {
      rmSync(join16(dir, f), { force: true, recursive: true });
      removed.push(join16("missions", mission, f));
    }
    if (hasCostEvents) {
      rmSync(join16(dir, "cost-events.jsonl"), { force: true });
      removed.push(join16("missions", mission, "cost-events.jsonl"));
    }
    if (hasRegistry) {
      rmSync(join16(dir, "context-registry.jsonl"), { force: true });
      removed.push(join16("missions", mission, "context-registry.jsonl"));
    }
    if (existsSync12(prVerdictSrc)) {
      rmSync(join16(dir, PR_VERDICT_SRC), { force: true });
      removed.push(join16("missions", mission, PR_VERDICT_SRC));
    }
    for (const f of files.filter((f2) => f2.endsWith(".json")))
      rmSync(join16(dir, f), { force: true });
    if (existsSync12(artDir) && readdirSync6(artDir).length === 0)
      rmSync(artDir, { recursive: true, force: true });
    if (!existsSync12(reportPath)) {
      writeFileSync6(reportPath, `# Mission: ${mission}

Archived before closure — no wave artifacts were present.

## Not verified

No review.md and no security.md in the mission folder, so nothing was checked or recorded.
`);
    }
    if (state && typeof state.branch === "string") {
      const rb = generateRollback(projectDir, dir, {
        mission,
        branch: state.branch,
        baseSha: typeof state.base_sha === "string" ? state.base_sha : "unknown"
      });
      if (rb)
        kept.push(join16("missions", mission, rb.file));
      try {
        const st = tasksFromState(state);
        const pt = countPlanTasks(dir);
        const tasks_done = pt.total > 0 ? pt.done : st.done;
        const tasks_total = pt.total > 0 ? pt.total : st.total;
        const baseShaForNote = typeof state.base_sha === "string" ? state.base_sha : undefined;
        writeProvenance(projectDir, dir, {
          mission,
          actor: typeof state.actor === "string" ? state.actor : "",
          lane: typeof state.lane === "string" ? state.lane : "",
          mode: typeof state.mode === "string" ? state.mode : "",
          branch: state.branch,
          tasks_done,
          tasks_total,
          evidence: Array.isArray(state.evidence) ? state.evidence : [],
          models: stageModels,
          base_sha: baseShaForNote
        }, baseShaForNote);
        kept.push(join16("missions", mission, "provenance.md"));
      } catch {}
    }
  } else {
    for (const f of fold)
      removed.push(join16("missions", mission, f));
  }
  removed.push(join16("missions", mission, "<session state>"));
  if (files.includes("plan.md"))
    kept.push(join16("missions", mission, "plan.md"));
  if (files.includes("handoff.md"))
    kept.push(join16("missions", mission, "handoff.md"));
  kept.push(join16("missions", mission, "report.md"));
  let index;
  const indexFile = join16(root, "index.md");
  const line = `- ${mission} — ${new Date().toISOString().slice(0, 10)}
`;
  if (!dryRun) {
    const existing = existsSync12(indexFile) ? readFileSync11(indexFile, "utf8") : "";
    if (!existing.split(/\r?\n/).some((l) => l.startsWith(`- ${mission} —`))) {
      const header = existing ? "" : `# Mission index

`;
      const fd = openSync(indexFile, "a");
      try {
        writeSync(fd, header + line);
      } finally {
        closeSync(fd);
      }
    }
    index = "index.md";
  }
  return { report: join16("missions", mission, "report.md"), removed, kept, index };
}

// src/auto-close.ts
function missionMode(cwd, mission) {
  const dir = join17(cwd, ".mugiwara", "missions", mission);
  try {
    for (const f of readdirSync7(dir).sort()) {
      if (!f.endsWith(".json") || f === "continue.json" || f.startsWith("continue-"))
        continue;
      const m = JSON.parse(readFileSync12(join17(dir, f), "utf8")).mode;
      if (typeof m === "string")
        return m;
    }
  } catch {}
  return "";
}
function autoCloseIfAuto(cwd, mission) {
  const mode = missionMode(cwd, mission);
  if (mode !== "auto")
    return { closed: false, message: `not auto-closed: mission mode is ${mode || "unknown"}, a person decides.` };
  const dir = join17(cwd, ".mugiwara", "missions", mission);
  try {
    for (const stage of ["execution", "closure"]) {
      if (!existsSync13(join17(dir, "flows", `0${stage === "execution" ? 1 : 6}-${stage}.md`)))
        recordStage(cwd, mission, stage);
    }
    const unplanned = !existsSync13(join17(dir, "plan.md"));
    archiveMission(cwd, mission, { unplanned });
    return { closed: true, message: `closed mission "${mission}" automatically (mode auto): report.md written${unplanned ? ", plan listed as Not verified" : ""}.` };
  } catch (e) {
    return { closed: false, message: `automatic close failed: ${e.message}` };
  }
}
var FAILING = /verdict[^\n]*\b(fail(ed|s)?|changes requested|needs? (fixes|changes)|blocked)\b/i;
function openFindings(cwd, mission) {
  const dir = join17(cwd, ".mugiwara", "missions", mission);
  for (const f of ["security.md", "review.md"]) {
    try {
      const line = readFileSync12(join17(dir, f), "utf8").split(`
`).find((l) => FAILING.test(l));
      if (line)
        return `${f}: ${line.replace(/[*#`]/g, "").trim().slice(0, 120)}`;
    } catch {}
  }
  return null;
}
function healProgress(cwd, mission) {
  const robin = dispatchCounts2(cwd, mission).get("robin-reviewer") ?? 0;
  let max = 3;
  try {
    const dir = join17(cwd, ".mugiwara", "missions", mission);
    const f = readdirSync7(dir).find((x) => x.endsWith(".json") && x !== "continue.json" && !x.startsWith("continue-"));
    const m = f ? JSON.parse(readFileSync12(join17(dir, f), "utf8")).heal_max_cycles : undefined;
    if (typeof m === "number" && m > 0)
      max = m;
  } catch {}
  return { cycles: Math.max(0, robin - 1), max };
}

// hooks/pipeline-guard.ts
var cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
var MARKER_TTL_MS = 12 * 60 * 60 * 1000;
function readEnforce() {
  for (const base of [cwd, homedir2()]) {
    if (!base)
      continue;
    const file = join18(base, ".mugiwara", "config");
    if (!existsSync14(file))
      continue;
    for (const line of readFileSync13(file, "utf8").split(/\r?\n/)) {
      const [k, v] = line.split("=").map((s) => s.trim());
      if (k !== "enforce")
        continue;
      if (v === "off" || v === "warn" || v === "block")
        return v;
      process.stderr.write(`mugiwara: unknown enforce="${v}" in ${file}, using "warn"
`);
      return "warn";
    }
  }
  return "warn";
}
function countForcedContinuation() {
  try {
    const file = join18(cwd, ".mugiwara", ".forced-continuations");
    const prev = existsSync14(file) ? Number(readFileSync13(file, "utf8").trim()) : 0;
    mkdirSync7(join18(cwd, ".mugiwara"), { recursive: true });
    writeFileSync7(file, `${(Number.isInteger(prev) && prev > 0 ? prev : 0) + 1}
`);
  } catch {}
}
function engaged(sessionId) {
  const file = join18(cwd, ".mugiwara", ".engaged");
  if (!existsSync14(file))
    return false;
  try {
    const m = JSON.parse(readFileSync13(file, "utf8"));
    if (sessionId && m.session_id)
      return m.session_id === sessionId;
    const touched = Date.parse(m.touched_at ?? "") || 0;
    return Date.now() - touched < MARKER_TTL_MS;
  } catch {
    return false;
  }
}
function sourceChanged(ignoreInstallNoise = false) {
  try {
    const out = execFileSync5("git", ["status", "--porcelain"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out.split(/\r?\n/).map((l) => l.slice(3).trim()).filter(Boolean).some((p) => !p.startsWith(".mugiwara/") && !(ignoreInstallNoise && /^(\.claude\/|\.opencode\/|\.gitignore$)/.test(p)));
  } catch {
    return false;
  }
}
function sessionStartFrom(markerFile) {
  try {
    const m = JSON.parse(readFileSync13(markerFile, "utf8"));
    return Date.parse(m.first_seen ?? "") || Date.parse(m.touched_at ?? "") || 0;
  } catch {
    return 0;
  }
}
function artifactWorkNow() {
  const markerFile = join18(cwd, ".mugiwara", ".engaged");
  if (!existsSync14(markerFile))
    return false;
  const sessionStart = sessionStartFrom(markerFile);
  if (!sessionStart)
    return false;
  try {
    const stack = ["missions", "spec", "plans"].map((s) => join18(cwd, ".mugiwara", s)).filter((p) => existsSync14(p));
    while (stack.length) {
      const cur = stack.pop();
      for (const e of readdirSync8(cur, { withFileTypes: true })) {
        const full = join18(cur, e.name);
        try {
          if (e.isSymbolicLink())
            continue;
          if (e.isDirectory()) {
            stack.push(full);
            continue;
          }
          if (statSync4(full).mtimeMs + 1000 >= sessionStart)
            return true;
        } catch {}
      }
    }
  } catch {
    return false;
  }
  return false;
}
function newestMissionState() {
  const base = join18(cwd, ".mugiwara", "missions");
  if (!existsSync14(base))
    return null;
  let best = null;
  let bestAt = -1;
  try {
    for (const e of readdirSync8(base, { withFileTypes: true })) {
      if (!e.isDirectory())
        continue;
      for (const f of readdirSync8(join18(base, e.name))) {
        const stem = f.replace(/\.json$/, "");
        if (!f.endsWith(".json") || stem === "continue" || stem.startsWith("continue-"))
          continue;
        const p = join18(base, e.name, f);
        try {
          const s = JSON.parse(readFileSync13(p, "utf8"));
          if (typeof s.mission !== "string" || !s.mission)
            continue;
          const at = statSync4(p).mtimeMs;
          if (at <= bestAt)
            continue;
          bestAt = at;
          best = { mission: s.mission, lane: typeof s.lane === "string" ? s.lane : "", dir: e.name, sensitive: Array.isArray(s.sensitive_paths) && s.sensitive_paths.length > 0 };
        } catch {}
      }
    }
  } catch {}
  return best;
}
var LANE_RANK = { direct: 0, lean: 1, standard: 2, full: 3, spike: 4 };
function executorDispatched(sessionId) {
  const file = join18(cwd, ".mugiwara", ".engaged");
  if (!existsSync14(file))
    return false;
  try {
    const m = JSON.parse(readFileSync13(file, "utf8"));
    const at = Date.parse(m.executor_dispatched_at ?? "") || 0;
    if (!at)
      return false;
    if (sessionId && m.session_id && m.session_id !== sessionId)
      return false;
    return Date.now() - at < MARKER_TTL_MS;
  } catch {
    return false;
  }
}
function plannerDispatched(sessionId) {
  const file = join18(cwd, ".mugiwara", ".engaged");
  if (!existsSync14(file))
    return false;
  try {
    const m = JSON.parse(readFileSync13(file, "utf8"));
    const at = Date.parse(m.planner_dispatched_at ?? "") || 0;
    if (!at)
      return false;
    if (sessionId && m.session_id && m.session_id !== sessionId)
      return false;
    return Date.now() - at < MARKER_TTL_MS;
  } catch {
    return false;
  }
}
function planTouched() {
  const missionsDir = join18(cwd, ".mugiwara", "missions");
  if (!existsSync14(missionsDir))
    return false;
  const markerFile = join18(cwd, ".mugiwara", ".engaged");
  if (!existsSync14(markerFile))
    return false;
  let sessionStart = 0;
  try {
    const m = JSON.parse(readFileSync13(markerFile, "utf8"));
    sessionStart = Date.parse(m.first_seen ?? "") || 0;
  } catch {}
  if (!sessionStart)
    return false;
  try {
    for (const e of readdirSync8(missionsDir, { withFileTypes: true })) {
      if (!e.isDirectory())
        continue;
      const plan = join18(missionsDir, e.name, "plan.md");
      if (!existsSync14(plan))
        continue;
      const at = lstatSync3(plan).mtimeMs;
      if (at + 1000 >= sessionStart)
        return true;
    }
  } catch {}
  return false;
}
var TRANSCRIPT_BANNER_RE = /## .*Flow (\d+)\s*\u2014/g;
var CREW_BANNER_RE = /## \S+ (?:Luffy|Nami|Usopp|Zoro|Chopper|Sanji|Franky|Robin|Jinbe|Brook|Skeptic) \u00B7 [^\n"]*?\((\d+)\/\d+\)/g;
function extractBannerFlow(text) {
  let best = 0;
  for (const re of [TRANSCRIPT_BANNER_RE, CREW_BANNER_RE]) {
    for (const m of text.matchAll(re)) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > best)
        best = n;
    }
  }
  return best;
}
function recordBannerFlow(flow, sessionId) {
  const file = join18(cwd, ".mugiwara", ".engaged");
  try {
    const prev = existsSync14(file) ? JSON.parse(readFileSync13(file, "utf8")) : {};
    const sameSession = !sessionId || typeof prev.session_id !== "string" || prev.session_id === sessionId;
    if (!sameSession)
      return;
    writeFileSync7(file, JSON.stringify({
      ...prev,
      touched_at: new Date().toISOString(),
      last_banner_flow: flow,
      last_banner_flow_at: new Date().toISOString()
    }, null, 2) + `
`);
  } catch {}
}
function bannerRecorded(sessionId) {
  const file = join18(cwd, ".mugiwara", ".engaged");
  if (!existsSync14(file))
    return false;
  try {
    const m = JSON.parse(readFileSync13(file, "utf8"));
    if (typeof m.last_banner_flow !== "number" || !m.last_banner_flow_at)
      return false;
    if (sessionId && m.session_id && m.session_id !== sessionId)
      return false;
    return Date.now() - (Date.parse(m.last_banner_flow_at) || 0) < MARKER_TTL_MS;
  } catch {
    return false;
  }
}
function bannerFromTranscript(payload) {
  const p = payload.transcript_path;
  if (typeof p !== "string" || !p)
    return null;
  try {
    if (!existsSync14(p))
      return null;
    return extractBannerFlow(readFileSync13(p, "utf8"));
  } catch {
    return null;
  }
}
function bannerThisSession() {
  const markerFile = join18(cwd, ".mugiwara", ".engaged");
  if (!existsSync14(markerFile))
    return true;
  const sessionStart = sessionStartFrom(markerFile);
  if (!sessionStart)
    return true;
  const re = /^## .*Flow (\d+)\s*\u2014/m;
  try {
    const missionsDir = join18(cwd, ".mugiwara", "missions");
    for (const e of readdirSync8(missionsDir, { withFileTypes: true })) {
      if (!e.isDirectory())
        continue;
      const files = [`${join18(missionsDir, e.name)}/decisions.md`];
      const flowsDir = join18(missionsDir, e.name, "flows");
      if (existsSync14(flowsDir)) {
        for (const f of readdirSync8(flowsDir)) {
          if (f.endsWith(".md"))
            files.push(join18(flowsDir, f));
        }
      }
      for (const f of files) {
        try {
          if (!existsSync14(f))
            continue;
          if (statSync4(f).mtimeMs + 1000 < sessionStart)
            continue;
          if (re.test(readFileSync13(f, "utf8")))
            return true;
        } catch {}
      }
    }
  } catch {
    return true;
  }
  return false;
}
var EXPLICIT_MAX_BLOCKS = 2;
var root = join18(dirname2(fileURLToPath2(import.meta.url)), "..");
function readMarker() {
  try {
    return JSON.parse(readFileSync13(join18(cwd, ".mugiwara", ".engaged"), "utf8"));
  } catch {
    return {};
  }
}
function explicitSession(sessionId) {
  const m = readMarker();
  if (!m.explicit_crew_at)
    return false;
  if (sessionId && m.session_id)
    return m.session_id === sessionId;
  return Date.now() - (Date.parse(m.touched_at ?? "") || 0) < MARKER_TTL_MS;
}
function computedLane() {
  try {
    const bash = findBash();
    const script = join18(root, "scripts", "lane.sh");
    if (!bash || !existsSync14(script))
      return null;
    const r = spawnSync3(bash, [script, "main", "--json"], { cwd, encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "ignore"] });
    if (r.status !== 0)
      return null;
    const j = JSON.parse(r.stdout);
    if (typeof j.lane !== "string")
      return null;
    return {
      lane: j.lane,
      sensitive: Array.isArray(j.sensitive_paths) ? j.sensitive_paths.filter((x) => typeof x === "string") : [],
      files: typeof j.files_touched === "number" ? j.files_touched : 0
    };
  } catch {
    return null;
  }
}
function closedThisSession(sessionId) {
  try {
    const base = join18(cwd, ".mugiwara", "missions");
    if (!existsSync14(base))
      return false;
    const start = sessionStartFrom(join18(cwd, ".mugiwara", ".engaged"));
    let ledger = [];
    try {
      ledger = readFileSync13(join18(cwd, ".mugiwara", "review-dispatch.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).flatMap((l) => {
        try {
          return [JSON.parse(l)];
        } catch {
          return [];
        }
      });
    } catch {}
    for (const e of readdirSync8(base, { withFileTypes: true })) {
      if (!e.isDirectory())
        continue;
      const closed = ["report.md", "pr-verdict.md"].map((f) => join18(base, e.name, f)).filter((f) => existsSync14(f));
      if (!closed.length)
        continue;
      if (start && closed.some((f) => statSync4(f).mtimeMs + 1000 >= start))
        return true;
      if (ledger.some((x) => x.mission === e.name && (!sessionId || !x.session_id || x.session_id === sessionId)))
        return true;
    }
  } catch {}
  return false;
}
function explicitProblem(sessionId) {
  if (!sourceChanged(true))
    return null;
  const lane = computedLane();
  if (!lane || lane.lane === "direct")
    return null;
  const state = newestMissionState();
  if (!state) {
    if (closedThisSession(sessionId))
      return null;
    if (!(lane.lane === "full" || lane.sensitive.length))
      return null;
    const what = lane.sensitive.length ? `a risky area (${lane.sensitive.slice(0, 3).join(", ")}${lane.sensitive.length > 3 ? `, and ${lane.sensitive.length - 3} more` : ""})` : `${lane.files} files`;
    return `Mugiwara: this change touches ${what}, and the crew's process was requested with /mugiwara but has not run. ` + "Size and record the work, then plan, build, review and check security before finishing; if the crew was not wanted, tell the user that instead of continuing.";
  }
  if (!(lane.lane === "full" || state.sensitive || lane.sensitive.length))
    return null;
  const dir = join18(cwd, ".mugiwara", "missions", state.dir);
  const missing = [];
  if (!existsSync14(join18(dir, "review.md")))
    missing.push("review");
  if (!existsSync14(join18(dir, "security.md")))
    missing.push("security check");
  if (missing.length) {
    return `Mugiwara: this change has no ${missing.join(" and no ")}, and the crew's process was requested with /mugiwara. ` + `Run the ${missing.join(" and the ")} now and write the result into the mission folder before finishing.`;
  }
  if (readConfig(cwd).independent_review !== "off" && dispatchedAgents(cwd, state.mission).size === 0) {
    return "Mugiwara: the review of this change ran in the same conversation that wrote it, and the crew's process was requested with /mugiwara. " + "Ask the crew to run the independent review (Robin and Jinbe as separate agents) before finishing, or tell the user you are skipping it. " + reviewNextStep(state.mission);
  }
  return null;
}
function explicitCheck(sessionId) {
  const reason = explicitProblem(sessionId);
  if (!reason)
    return false;
  const marker = readMarker();
  const blocks = typeof marker.explicit_blocks === "number" ? marker.explicit_blocks : 0;
  if (blocks >= EXPLICIT_MAX_BLOCKS) {
    process.stderr.write(`\u26A0 ${reason}
`);
    return false;
  }
  try {
    writeFileSync7(join18(cwd, ".mugiwara", ".engaged"), JSON.stringify({ ...marker, explicit_blocks: blocks + 1 }, null, 2) + `
`);
  } catch {}
  countForcedContinuation();
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  return true;
}
function closingCheck() {
  const pending = closingPending(cwd);
  if (!pending)
    return false;
  {
    const marker = readMarker();
    const bump = (key, n) => {
      try {
        writeFileSync7(join18(cwd, ".mugiwara", ".engaged"), JSON.stringify({ ...marker, [key]: n + 1 }, null, 2) + `
`);
      } catch {}
      countForcedContinuation();
    };
    const num = (k) => typeof marker[k] === "number" ? marker[k] : 0;
    const open = openFindings(cwd, pending);
    const auto = missionMode(cwd, pending) === "auto";
    const heal = healProgress(cwd, pending);
    if (open && !auto) {
      process.stderr.write(`Mugiwara: mission "${pending}" has open findings (${open}); it stays open for your decision.
`);
    } else if (open && heal.cycles < heal.max) {
      if (num("heal_blocks") < heal.max) {
        bump("heal_blocks", num("heal_blocks"));
        process.stdout.write(JSON.stringify({ decision: "block", reason: `Mugiwara: mission "${pending}" is in mode auto and has open findings (${open}). Heal now, do not stop: start Brook (brook-healing) to fix them, then run Robin (robin-reviewer) and Jinbe (jinbe-security) again as separate agents, and rewrite review.md and security.md with the new verdicts. Heal cycle ${heal.cycles + 1} of ${heal.max}. When both pass, run: mugiwara close ${pending}.` }));
        return true;
      }
    } else {
      const reason = `Mugiwara: mission "${pending}" has its review files but no report.md. Run: mugiwara close ${pending} (without a global install: npx -y @ionivetech/mugiwara@latest close ${pending}).${open ? ` The heal cap of ${heal.max} is spent, so the report records the open findings as Needs fixes.` : ""}`;
      if (num("archive_blocks") < EXPLICIT_MAX_BLOCKS) {
        bump("archive_blocks", num("archive_blocks"));
        process.stdout.write(JSON.stringify({ decision: "block", reason }));
        return true;
      }
      const r = autoCloseIfAuto(cwd, pending);
      process.stderr.write(r.closed ? `Mugiwara: ${r.message}
` : `${reason}
`);
    }
  }
  return false;
}
async function main() {
  let input = "";
  for await (const chunk of process.stdin)
    input += chunk;
  let payload = {};
  try {
    payload = JSON.parse(input);
  } catch {}
  if (process.env.MUGIWARA_HOOK_DEBUG) {
    try {
      const sid = typeof payload.session_id === "string" ? payload.session_id : "";
      const pend = closingPending(cwd);
      appendFileSync3(process.env.MUGIWARA_HOOK_DEBUG, JSON.stringify({ at: new Date().toISOString(), event: payload.hook_event_name, stop_hook_active: payload.stop_hook_active === true, engaged: engaged(sid), pending: pend, enforce: readEnforce(), marker: Object.keys(readMarker()) }) + `
`);
    } catch {}
  }
  const sid0 = typeof payload.session_id === "string" ? payload.session_id : "";
  if (payload.hook_event_name !== "SubagentStop" && explicitSession(sid0) && readEnforce() !== "off" && explicitCheck(sid0))
    return;
  if (payload.hook_event_name !== "SubagentStop" && readEnforce() !== "off" && engaged(typeof payload.session_id === "string" ? payload.session_id : "") && closingCheck())
    return;
  if (payload.stop_hook_active === true)
    return;
  const enforce = readEnforce();
  if (enforce === "off")
    return;
  const sessionId = typeof payload.session_id === "string" ? payload.session_id : "";
  if (!engaged(sessionId))
    return;
  const state = newestMissionState();
  const sourceChangedNow = sourceChanged();
  if (state) {
    const rank = LANE_RANK[state.lane] ?? -1;
    if (rank >= 1 && sourceChangedNow && !executorDispatched(sessionId)) {
      process.stderr.write(`\u26A0 Mugiwara: source files changed in mission "${state.mission}" but no builder agent (zoro-execution or brook-healing) was started this session. ` + `Start one, or set enforce=off in .mugiwara/config to stop these warnings.
`);
    }
    if (planTouched() && !plannerDispatched(sessionId)) {
      process.stderr.write("\u26A0 Mugiwara: a plan was written this session but the planner (nami-planner) was not started. " + `Start nami-planner to write it, or set enforce=off in .mugiwara/config to stop these warnings.
`);
    }
    try {
      const risky = state.lane === "full" || state.sensitive;
      const reviewed = ["review.md", "security.md"].some((f) => existsSync14(join18(cwd, ".mugiwara", "missions", state.dir, f)));
      if (risky && reviewed && readConfig(cwd).independent_review !== "off" && dispatchedAgents(cwd, state.mission).size === 0) {
        process.stderr.write("Mugiwara: the review of this change ran in the same conversation that wrote it. " + "Ask the crew to run the independent review (Robin and Jinbe as separate agents), or set independent_review=off if you accept an inline review. " + reviewNextStep(state.mission, dispatchedAgents(cwd, state.mission)) + `
`);
      }
    } catch {}
    const transcriptFlow = bannerFromTranscript(payload);
    if (transcriptFlow !== null && transcriptFlow > 0)
      recordBannerFlow(transcriptFlow, sessionId);
    const bannerShown = transcriptFlow !== null ? transcriptFlow > 0 : bannerRecorded(sessionId) || bannerThisSession();
    if ((sourceChangedNow || planTouched()) && !bannerShown) {
      process.stderr.write("\u26A0 Mugiwara: work was recorded but no crew banner was shown this session. " + `Open each stage with its crew banner (see references/flow-banners.md) so the user can see the crew ran.
`);
    }
    return;
  }
  if (!state) {
    if (!sourceChangedNow && !artifactWorkNow())
      return;
    const reason = "Mugiwara: this session changed source or mission artifacts but no mission was started to size the work. " + "Start the mugiwara workflow first (it also records trivial work), or set enforce=off in .mugiwara/config to stop this check.";
    if (enforce === "warn") {
      process.stderr.write(`\u26A0 ${reason}
`);
      return;
    }
    countForcedContinuation();
    process.stdout.write(JSON.stringify({ decision: "block", reason }));
  }
}
main().catch(() => {});
