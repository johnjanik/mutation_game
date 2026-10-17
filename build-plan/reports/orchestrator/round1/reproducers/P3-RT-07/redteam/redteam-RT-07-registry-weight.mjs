#!/usr/bin/env node
// RT-07 (attack 12 by analogy, and the attribution asked by attack 20): every tool route and every
// lesson fetches, before interaction, the presets of every OTHER tool, because ToolFrame imports
// lib/urlCodec.ts, which imports the tool registry (site/src/tools/index.ts), which loads every
// registry entry eagerly (import.meta.glob(..., { eager: true })), and the entries import their tools'
// presets modules, whose top-level code calls the engine to compose captions while the first tool
// hydrates (t02/presets.ts: roots of A3 and A2, positive roots of A3, a 40-layer orbit of the
// triangle; t05/presets.ts: plays; t08/presets.ts: weylOrder, legalLayers, countCompleteGames).
// Checks the static import closure of the client:idle island of each route given for caption text of
// T2's, T5's and T8's presets; exits 1 when a route that does not show those tools carries them.
// usage (after npm run build): node redteam/redteam-RT-07-registry-weight.mjs site/dist /tools/board/ /modules/m0-start/
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [dist, ...routes] = process.argv.slice(2);
const MARKS = {
  'T2 presets (t02/presets.ts)': 'the root poset',
  'T8 presets (t08/presets.ts)': 'one for each element of the group',
  'T2 model (t02/garden.ts)': 'garden',
};
let bad = 0;
for (const route of routes) {
  const html = readFileSync(join(dist, route, 'index.html'), 'utf8');
  const roots = [];
  for (const m of html.matchAll(/<astro-island\b([^>]*)>/g)) {
    if (!/client="idle"/.test(m[1])) continue;
    for (const k of ['component-url', 'renderer-url']) { const u = (m[1].match(new RegExp(`${k}="([^"]+)"`)) || [])[1]; if (u) roots.push(u.replace(/^\//, '')); }
  }
  const tool = (html.match(/data-tool="([^"]+)"/) || [])[1];
  const seen = new Set();
  const stack = [...roots];
  while (stack.length) {
    const p = stack.pop();
    if (seen.has(p)) continue;
    seen.add(p);
    for (const m of readFileSync(join(dist, p), 'utf8').matchAll(/(?:import|export)\s*(?:[\w*{}\s,$]*?from\s*)?["'](\.\/[^"']+\.js)["']/g)) {
      const next = join(p.replace(/[^/]+$/, ''), m[1]);
      if (existsSync(join(dist, next))) stack.push(next);
    }
  }
  const found = [];
  for (const [label, s] of Object.entries(MARKS).slice(0, 2)) {
    const where = [...seen].filter((p) => readFileSync(join(dist, p), 'utf8').includes(s));
    if (where.length) found.push(`${label} in ${where.join(', ')}`);
  }
  console.log(`${route} (first tool: ${tool}): ${found.length ? found.join('; ') : 'no other tool presets'}`);
  if (found.length && tool !== 'garden' && tool !== 'weyl') bad++;
}
if (bad) { console.log(`FAIL: ${bad} route(s) fetch other tools' presets before interaction`); process.exitCode = 1; }
