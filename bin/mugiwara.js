#!/usr/bin/env node
// bin/mugiwara.js
import { run } from '../src/cli.js';

run(process.argv.slice(2)).catch(err => {
  console.error(`mugiwara: ${err.message}`);
  process.exit(1);
});
