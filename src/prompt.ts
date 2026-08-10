// src/prompt.ts
import readline from 'node:readline/promises';

export type Rl = { question: (prompt: string) => Promise<string> };

export function createRl(): readline.Interface {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

export async function choose(rl: Rl, question: string, options: string[]): Promise<number> {
  for (;;) {
    console.log(`\n${question}`);
    options.forEach((o, i) => console.log(`  ${i + 1}) ${o}`));
    const n = Number((await rl.question('choice> ')).trim());
    if (Number.isInteger(n) && n >= 1 && n <= options.length) return n - 1;
    console.log(`Enter a number between 1 and ${options.length}.`);
  }
}

export async function multiChoose(rl: Rl, question: string, options: string[]): Promise<number[]> {
  for (;;) {
    console.log(`\n${question} (comma-separated numbers, or "all")`);
    options.forEach((o, i) => console.log(`  ${i + 1}) ${o}`));
    const raw = (await rl.question('choices> ')).trim().toLowerCase();
    if (raw === 'all') return options.map((_, i) => i);
    const nums = raw.split(',').map(s => Number(s.trim()));
    if (nums.length > 0 && nums.every(n => Number.isInteger(n) && n >= 1 && n <= options.length)) {
      return [...new Set(nums.map(n => n - 1))];
    }
    console.log('Invalid selection.');
  }
}

export async function confirm(rl: Rl, question: string): Promise<boolean> {
  const raw = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
  return raw === 'y' || raw === 'yes';
}
