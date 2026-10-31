#!/usr/bin/env node
// RT-10 (spec-compliance), phase 3 round 1, attack 2 (npm run report, the numbers-in-prose report).
// SPEC 7.7 Content row: "scripts/numbers-in-prose.mjs lists every number in lesson prose that is not
// written with <G>, for a person to review". This script appends one prose line with a typed number
// ("The answer is 4321.") to the end of each lesson source, in memory only, and asks the committed
// scanner (scanSource) whether it sees it. A scanner that misses the line hides every typed number in
// that part of the lesson from the report the owner reads before a release.
// Run: node redteam/redteam-RT-10-numbers-scan.mjs   (exit 1 when a lesson hides the probe)
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { lessonFiles, scanSource } from '../scripts/numbers-in-prose.mjs';

let hidden = 0;
for (const file of lessonFiles()) {
  const text = readFileSync(file, 'utf8');
  const probe = `${text}\n\nThe answer is 4321.\n`;
  const found = scanSource(probe, basename(file)).filter((f) => f.number === '4321');
  const ok = found.length === 1;
  if (!ok) hidden += 1;
  console.log(`${basename(file)}: probe at the end ${ok ? 'reported' : 'NOT reported'}`);
}
console.log(hidden === 0 ? 'every lesson: probe reported' : `${hidden} lesson file(s) hide a typed number at the end of the prose`);
process.exit(hidden === 0 ? 0 : 1);
