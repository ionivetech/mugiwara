// src/args.ts
export type FlagValue = string | boolean | undefined;
export type Args = {
  command: string;
  _: string[];
  flags: Record<string, FlagValue>;
};

const VALUE_FLAGS: Record<string, string> = { '--project': 'project', '--target': 'target', '--before': 'before', '--backend': 'backend', '--mission': 'mission', '--to-team': 'toTeam', '--to-solo': 'toSolo', '--flow': 'flow', '--area': 'area', '--files': 'files' };
const BOOL_FLAGS: Record<string, string> = {
  '--global': 'global', '--yes': 'yes', '-y': 'yes', '--force': 'force',
  '--dry-run': 'dryRun', '--keep-logs': 'keepLogs', '--check': 'check', '--all': 'all', '--verify': 'verify',
  '--gen-key': 'genKey', '--help': 'help', '-h': 'help', '--version': 'version', '-v': 'version',
  '--json': 'json', '--ledger': 'ledger',
};

export function parseArgs(argv: string[]): Args {
  const out: Args = { _: [], flags: {}, command: 'install' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a in BOOL_FLAGS) { out.flags[BOOL_FLAGS[a]] = true; continue; }
    if (a in VALUE_FLAGS) {
      const v = argv[++i];
      if (v === undefined || v.startsWith('-')) throw new Error(`Flag ${a} missing value`);
      out.flags[VALUE_FLAGS[a]] = v;
      continue;
    }
    if (a.startsWith('-')) throw new Error(`Unknown flag: ${a}`);
    out._.push(a);
  }
  out.command = out._[0] ?? 'install';
  return out;
}
