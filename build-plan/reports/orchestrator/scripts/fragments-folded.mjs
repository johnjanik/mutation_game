#!/usr/bin/env node
// RT-10 (spec-compliance), phase 4 round, attack 18 (README 3.2: every decisions fragment is folded into
// DECISIONS.md by MERGE): every "## " heading of every decisions/*.md fragment occurs in DECISIONS.md.
// Run: node build-plan/reports/orchestrator/scripts/fragments-folded.mjs   (exit 1 when a heading is missing)
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const decisions = readFileSync(`${root}DECISIONS.md`, 'utf8');
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const all = norm(decisions);
let missing = 0;
let total = 0;
for (const f of readdirSync(`${root}decisions`).filter((n) => n.endsWith('.md')).sort()) {
  const text = readFileSync(`${root}decisions/${f}`, 'utf8');
  for (const line of text.split('\n')) {
    if (!line.startsWith('## ')) continue;
    total++;
    if (!all.includes(norm(line))) {
      missing++;
      console.log(`${f}: not folded: ${line}`);
    }
  }
}
console.log(`${total} fragment headings, ${missing} not in DECISIONS.md`);
process.exit(missing === 0 ? 0 : 1);
