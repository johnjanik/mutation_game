#!/usr/bin/env node
// RT-10 Methods 5.6 (attacks 15 and 18): exact pins of the three package.json files, the 7.1 table,
// the engine's empty dependencies, and every dependency named in DECISIONS.md with its version.
// Run: node redteam/redteam-RT-10-pins-deps.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => JSON.parse(readFileSync(root + p, 'utf8'));
const files = ['package.json', 'packages/engine/package.json', 'site/package.json'];
const decisions = readFileSync(root + 'DECISIONS.md', 'utf8');
const TABLE = { astro: '7.3.8', '@astrojs/mdx': '8.0.3', svelte: '5.57.2', '@astrojs/svelte': '9.0.1', typescript: '6.0.3', nanostores: '1.5.5', vitest: '5.0.3', 'fast-check': '4.10.2', '@playwright/test': '1.64.0', '@axe-core/playwright': '4.13.0' };
const seen = {};
let problems = 0;
for (const f of files) {
  const p = read(f);
  for (const kind of ['dependencies', 'devDependencies']) {
    for (const [name, spec] of Object.entries(p[kind] ?? {})) {
      seen[name] = spec;
      if (!/^\d+\.\d+\.\d+$/.test(spec)) { console.log(`RANGE ${f} ${kind} ${name}@${spec}`); problems++; }
      const named = decisions.includes(name);
      const withVersion = decisions.includes(`${name} ${spec}`) || decisions.includes(`${name}@${spec}`) || decisions.includes(`\`${name}\` ${spec}`) || decisions.includes(`${name}\` ${spec}`);
      console.log(`${f} ${kind} ${name}@${spec}: DECISIONS.md names it ${named ? 'yes' : 'NO'}, with version ${withVersion ? 'yes' : 'not found as "name version"'}`);
    }
  }
}
for (const [name, v] of Object.entries(TABLE)) console.log(`7.1 ${name}: pinned ${seen[name] ?? 'ABSENT'} (table ${v})${seen[name] === v ? '' : '  <-- differs'}`);
const engine = read('packages/engine/package.json');
console.log(`engine dependencies: ${JSON.stringify(engine.dependencies)}; devDependencies: ${Object.keys(engine.devDependencies).join(', ')}`);
const rootPkg = read('package.json');
console.log(`root: ${JSON.stringify({ private: rootPkg.private, engines: rootPkg.engines, workspaces: rootPkg.workspaces })}`);

// Licences (SPEC 9.3: "recorded in DECISIONS.md with its version and licence"): a DECISIONS.md line on
// which the package name is followed, within 300 characters, by its pinned version and its installed
// licence identifier (the form of the P0-A3 table rows, of "`@types/node` 22.20.5 (MIT, ...)" and of
// "`nanostores` 1.5.5 ... Licence MIT").
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const lines = decisions.split('\n');
let missingLicence = 0;
for (const [name, version] of Object.entries(seen)) {
  let actual = '?';
  try { actual = JSON.parse(readFileSync(`${root}node_modules/${name}/package.json`, 'utf8')).license; } catch {}
  const rx = new RegExp(`(^|[^\\w@/-])${esc(name)}(?![\\w/-])[\\s\\S]{0,300}`);
  const has = lines.some((l) => {
    const m = rx.exec(l);
    return m !== null && m[0].includes(version) && m[0].includes(actual);
  });
  if (!has) missingLicence++;
  console.log(`licence of ${name}@${version} (installed: ${actual}) recorded with its version: ${has ? 'yes' : 'NO'}`);
}
console.log(`${missingLicence} dependencies without a DECISIONS.md line giving name, version and licence`);
process.exit(problems === 0 && missingLicence === 0 ? 0 : 1);
