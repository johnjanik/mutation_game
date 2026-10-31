#!/usr/bin/env node
// RT-11 attack 5/8: the check that no command of CI makes. Reads packages/engine/test/golden/coverage.json
// (written by the global setup of the engine's Vitest configuration after a FULL run) and exits 1 when a key
// of a phase at or below K is missing. CONTRACTS.md 3 gives this check to GATE only; SPEC.md 7.7 makes the
// golden tests of every phase built so far "required for every merge".
// Usage: node redteam/redteam-RT-11-coverage-gate.mjs <K>
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const K = Number(process.argv[2] ?? '3');
const file = fileURLToPath(new URL('../packages/engine/test/golden/coverage.json', import.meta.url));
const cov = JSON.parse(readFileSync(file, 'utf8'));
let missing = 0;
for (let p = 0; p <= K; p++) {
  const m = cov.missingByPhase[String(p)] ?? [];
  if (m.length > 0) console.log(`phase ${p}: missing ${m.join(', ')}`);
  missing += m.length;
}
console.log(`coverage gate through phase ${K}: ${missing} key(s) missing`);
process.exit(missing === 0 ? 0 : 1);
