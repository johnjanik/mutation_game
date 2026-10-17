#!/usr/bin/env node
// RT-07 attack 12: the engine code the index page (the phase-0 page, one Game Board on A2) fetches
// before interaction, against the engine code its island actually calls. The island (BoardSeed.svelte,
// Board.svelte, draw/roads.ts) imports boardFromName, mutate, toLabels, toPositions and adjacency from
// the engine; the route nevertheless fetches the one shared engine chunk that every island of the site
// imports, which holds the union of every island's engine functions (classify, weyl, heaps, geometry,
// affine, form ...). Exits 1 when the fetched engine chunk exceeds what those five functions need
// (bundled alone by the installed rolldown, minified, gzip level 9) by more than 1000 bytes.
// usage (after npm run build): node redteam/redteam-RT-07-engine-weight.mjs site/dist
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { rolldown } from 'rolldown';

const dist = resolve(process.argv[2] ?? 'site/dist');
const gz = (b) => gzipSync(b, { level: 9 }).length;
// 1. the static import closure of the client:idle island of / (what the browser fetches; it equals
//    the measured set of redteam/redteam-RT-07-size.mjs and of npm run size)
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const roots = [];
for (const m of html.matchAll(/<astro-island\b([^>]*)>/g)) {
  for (const k of ['component-url', 'renderer-url']) { const u = (m[1].match(new RegExp(`${k}="([^"]+)"`)) || [])[1]; if (u) roots.push(u.replace(/^\//, '')); }
}
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
const engineChunks = [...seen].filter((p) => readFileSync(join(dist, p), 'utf8').includes('EngineOverflow'));
const fetched = engineChunks.reduce((s, p) => s + gz(readFileSync(join(dist, p))), 0);
const total = [...seen].reduce((s, p) => s + gz(readFileSync(join(dist, p))), 0);
for (const p of engineChunks) {
  const src = readFileSync(join(dist, p), 'utf8');
  const marks = ['weylDimension', 'commutation', 'cholesky', 'smallestNonfinite', 'spectralRadius', 'NotAffine'].filter((s) => src.includes(s));
  console.log(`engine chunk fetched by /: ${p}, ${gz(readFileSync(join(dist, p)))} bytes gzip; contains ${marks.join(', ')}`);
}
// 2. the five functions bundled alone
const engine = resolve(dirname(fileURLToPath(import.meta.url)), '../packages/engine/src/index.ts');
const code = `export { boardFromName, mutate, toLabels, toPositions, adjacency } from ${JSON.stringify(engine)};`;
const bundle = await rolldown({ input: 'entry', plugins: [{ name: 'e', resolveId: (id) => (id === 'entry' ? id : null), load: (id) => (id === 'entry' ? code : null) }], logLevel: 'silent' });
const { output } = await bundle.generate({ format: 'esm', minify: true });
await bundle.close();
const needed = gz(Buffer.from(output.filter((o) => o.type === 'chunk').map((o) => o.code).join('\n')));
console.log(`the five engine functions the index island imports, bundled alone: ${needed} bytes gzip`);
console.log(`route / fetches ${total} bytes gzip of JavaScript in all (limit 60000); engine code beyond what it calls: about ${fetched - needed} bytes`);
if (fetched > needed + 1000) {
  console.log('FAIL: the index page fetches engine code it never calls (SPEC 7.6: the shared code is the "engine core"; a route carries "the engine functions only it uses")');
  process.exitCode = 1;
}
