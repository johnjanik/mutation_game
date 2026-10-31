#!/usr/bin/env node
// RT-07 attack 24 (SPEC 5.6, last sentence: "A tool decides whether a board is of finite type by
// calling classify once when the board is loaded"): counts the computations of classify (the body of
// classifyUncached, which the engine's WeakMap cache calls once per board object, E-11) during a tool's
// load and during each board change from its picker, with a DevTools logpoint placed through the source
// map of a build made with redteam/redteam-RT-07-astro.sourcemap.config.mjs. Never modifies the site.
// usage: node redteam/redteam-RT-07-classify-count.mjs <dist-maps>
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { serve } from './redteam-RT-07-serve.mjs';

const dist = process.argv[2];
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function vlq(s) { const out = []; let v = 0, sh = 0; for (const ch of s) { let d = B64.indexOf(ch); const c = d & 32; d &= 31; v += d << sh; if (c) sh += 5; else { out.push(v & 1 ? -(v >> 1) : v >> 1); v = 0; sh = 0; } } return out; }
// find the generated position of `const C = intCartan(board);` in classifyUncached (classify.ts)
const srcLines = readFileSync(new URL('../packages/engine/src/classify.ts', import.meta.url), 'utf8').split('\n');
const fnLine = srcLines.findIndex((l) => l.startsWith('export function classifyUncached<T>(board: Board<T>): ClassifyRecord[] {'));
const target = fnLine + 1; // 0-based line of the first statement
let found = null;
for (const f of readdirSync(join(dist, '_astro')).filter((x) => x.endsWith('.js.map') && !x.includes('worker'))) {
  const m = JSON.parse(readFileSync(join(dist, '_astro', f), 'utf8'));
  const si = m.sources.findIndex((s) => s.endsWith('packages/engine/src/classify.ts'));
  if (si < 0) continue;
  let src = 0, ol = 0;
  m.mappings.split(';').forEach((line, gl) => {
    let gc = 0;
    for (const s of line.split(',')) {
      if (!s) continue;
      const v = vlq(s); gc += v[0];
      if (v.length >= 4) { src += v[1]; ol += v[2]; if (src === si && ol === target && !found) found = { file: f.slice(0, -4), line: gl, col: gc }; }
    }
  });
  if (found) break;
}
if (!found) { console.error('classifyUncached not found in the source maps'); process.exit(2); }
console.log(`logpoint at ${found.file}:${found.line}:${found.col} (classify.ts line ${target + 1})`);

const srv = await serve(dist, '/', 5122);
const browser = await chromium.launch();
async function run(route, picks) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const page = await ctx.newPage();
  let hits = 0;
  const byN = new Map();
  page.on('console', (m) => { const t = m.text(); if (t.startsWith('RT07-classify')) { hits++; const n = t.split(' ')[1]; byN.set(n, (byN.get(n) ?? 0) + 1); } });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Debugger.enable');
  await cdp.send('Debugger.setBreakpointByUrl', { urlRegex: `.*/_astro/${found.file.replace(/\./g, '\\.')}$`, lineNumber: found.line, columnNumber: found.col, condition: "console.log('RT07-classify n=' + (arguments[0] && arguments[0].n)), false" });
  await page.goto(srv.origin + route, { waitUntil: 'load' });
  await page.locator('[data-tool][data-hydrated="true"]').first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  const counts = [`load ${hits} by board size ${JSON.stringify(Object.fromEntries(byN))}`];
  for (const name of picks) {
    hits = 0; byN.clear();
    const picker = page.locator('[data-control="picker"]').first();
    if ((await picker.count()) === 0) { counts.push(`no picker`); break; }
    const tag = await picker.evaluate((e) => e.tagName);
    if (tag === 'SELECT') await picker.selectOption(name); else { counts.push(`picker is ${tag}`); break; }
    await page.waitForTimeout(1500);
    counts.push(`${name} ${hits} ${JSON.stringify(Object.fromEntries(byN))}`);
  }
  console.log(`${route.length > 60 ? route.slice(0, 40) + "...(12-cycle link)" : route}: classify computed ${counts.join('; ')}`);
  await ctx.close();
}
await run('/tools/board/', ['A4', 'D4', 'E6']);
await run('/tools/lab/', []);
await run('/tools/garden/', ['A4', 'D5']);
await run('/tools/sandbox/', []);
await run('/tools/kostant/', ['A4', 'B3']);
await run('/tools/affine/', []);
// a 12-node custom board by link (the 12-cycle, affine A11~: classify costs about 10 ms in Node here)
const RING12 = 'c:' + Array.from({ length: 12 }, (_, i) => Array.from({ length: 12 }, (_, j) => (i === j ? 2 : (j === (i + 1) % 12 || i === (j + 1) % 12 ? -1 : 0))).join(',')).join(';');
await run(`/tools/board/?z=1&g=${RING12}&v=p&m=f&c=p&s=1,0,0,0,0,0,0,0,0,0,0,0`, []);
await run(`/tools/lab/?z=1&g=${RING12}`, []);
await run(`/tools/sandbox/?z=1&g=${RING12}`, []);
await run(`/tools/garden/?z=1&g=${RING12}`, []);
await browser.close();
await srv.close();
