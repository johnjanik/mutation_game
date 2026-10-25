// P6-size: a route fetches, before interaction, only the engine modules its own code uses (SPEC.md 7.6:
// a tool route carries "the tool's own code with the engine functions only it uses"). Two causes put
// every engine module into one chunk that every route fetched: site/src/lib/worker.ts spread the whole
// engine namespace into its main-thread table, and Challenge.svelte imported the whole engine
// dynamically; and the bundler kept the engine's modules for side effects they do not have, so an
// import through the engine's index.ts reached all of them (astro.config.mjs moduleSideEffects).
// After phase 6 added satake.ts and satakeCatalogue.ts, /tools/rep/ measured 92.2 kB against 90 kB.
// In the style of registry-weight.spec.ts: reads the built site (npm run build), needs no browser,
// and follows the static imports of every island of a page (client:idle and client:visible: the
// default state of the whole page). The marks are strings each engine module throws or holds, which
// survive minification; each is checked against the engine's source and found in the worker's bundle,
// so that an absence below means the module is absent.
import { expect, test } from '@playwright/test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { outDirFrom, siteAndBase } from '../../astro.config.mjs';

const SITE_DIR = resolve(import.meta.dirname, '../..');
const ENGINE_SRC = resolve(SITE_DIR, '../packages/engine/src');
const dist = resolve(SITE_DIR, outDirFrom(process.env));
const { base } = siteAndBase(process.env);

/** Strings of each module (error texts and Reason codes of SPEC.md 5.2), the tools that use it. */
const MODULES: Record<string, { marks: string[]; tools: string[] }> = {
  'rep.ts': {
    marks: ['the string through mu at node position', 'left the orbit of omega_', 'a matrix entry needs a non-negative integer row and column'],
    tools: ['rep'],
  },
  'satake.ts': {
    // 'not admissible: ' with its colon: errors.ts, which every route carries, holds 'the pair is not admissible'.
    marks: ['not admissible: ', 'differs-from-minus-wX', 'moves-black-set', 'not-an-involution'],
    tools: ['satake', 'atlas'],
  },
  'satakeCatalogue.ts': {
    marks: ['no catalogue rule for the board', 'matchCatalogue needs a board built by boardFromName', 'restricted board of a C2 record is not B2'],
    tools: ['satake', 'atlas'],
  },
};

/** The marks of a module that its source still holds (a reworded error drops out; at least one must stay). */
function marksOf(module: string): string[] {
  const src = readFileSync(join(ENGINE_SRC, module), 'utf8');
  return MODULES[module]!.marks.filter((m) => src.includes(m));
}

/**
 * The static import closure of every island of a built page: the files (relative to `distDir`) that
 * their component-url and renderer-url name, and every file those import by a relative path. A
 * dynamic import is not followed: it is fetched on demand, not before interaction.
 */
function islandClosure(distDir: string, siteBase: string, html: string): Set<string> {
  const roots: string[] = [];
  for (const m of html.matchAll(/<astro-island\b([^>]*)>/g)) {
    for (const k of ['component-url', 'renderer-url']) {
      const u = (m[1]!.match(new RegExp(`${k}="([^"]+)"`)) || [])[1];
      if (u && u.startsWith(siteBase)) roots.push(u.slice(siteBase.length));
    }
  }
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length) {
    const p = stack.pop()!;
    if (seen.has(p)) continue;
    seen.add(p);
    for (const m of readFileSync(join(distDir, p), 'utf8').matchAll(/(?:import|export)\s*(?:[\w*{}\s,$]*?from\s*)?["'](\.\/[^"']+\.js)["']/g)) {
      const next = join(p.replace(/[^/]+$/, ''), m[1]!);
      if (existsSync(join(distDir, next))) stack.push(next);
    }
  }
  return seen;
}

/** The files of a route's closure that carry a mark of `module`. */
function carriers(route: string, module: string): string[] {
  const html = readFileSync(join(dist, route, 'index.html'), 'utf8');
  const marks = marksOf(module);
  return [...islandClosure(dist, base, html)].filter((f) => marks.some((m) => readFileSync(join(dist, f), 'utf8').includes(m)));
}

test('the marks of rep.ts, satake.ts and satakeCatalogue.ts are in the engine source and survive the build', () => {
  const worker = readdirSync(join(dist, '_astro')).filter((f) => /^engine\.worker.*\.js$/.test(f));
  expect(worker.length).toBe(1);
  const bundle = readFileSync(join(dist, '_astro', worker[0]!), 'utf8');
  for (const module of Object.keys(MODULES)) {
    const marks = marksOf(module);
    expect(marks.length, `${module}: no mark left in packages/engine/src/${module}`).toBeGreaterThan(0);
    // The worker holds the whole engine: every mark is there, so the build keeps the strings.
    for (const m of marks) expect(bundle, `${module}: '${m}' in ${worker[0]}`).toContain(m);
  }
});

test('the first fetch of /, /tools/board/ and M0 carries no engine module of T12 or T13', () => {
  const lines: string[] = [];
  for (const route of ['', 'tools/board/', 'modules/m0-start/']) {
    for (const module of Object.keys(MODULES)) {
      const found = carriers(route, module);
      if (found.length) lines.push(`/${route}: ${module} in ${found.join(', ')}`);
    }
  }
  expect(lines, lines.join('\n')).toEqual([]);
});

test('the first fetch of /tools/rep/ carries rep.ts and no Satake module', () => {
  expect(carriers('tools/rep/', 'rep.ts').length).toBeGreaterThan(0);
  expect(carriers('tools/rep/', 'satake.ts')).toEqual([]);
  expect(carriers('tools/rep/', 'satakeCatalogue.ts')).toEqual([]);
});

test('no route that shows neither T13 nor T14 fetches satake.ts or satakeCatalogue.ts before interaction', () => {
  const lines: string[] = [];
  const walk = (dir: string): string[] =>
    readdirSync(join(dist, dir), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? (e.name === '_astro' || e.name === 'katex' ? [] : walk(join(dir, e.name))) : e.name === 'index.html' ? [dir] : [],
    );
  const routes = walk('');
  expect(routes.length).toBeGreaterThan(10);
  for (const route of routes) {
    const html = readFileSync(join(dist, route, 'index.html'), 'utf8');
    for (const module of ['satake.ts', 'satakeCatalogue.ts']) {
      if (MODULES[module]!.tools.some((t) => html.includes(`data-tool="${t}"`))) continue;
      const found = carriers(route, module);
      if (found.length) lines.push(`/${route}: ${module} in ${found.join(', ')}`);
    }
  }
  expect(lines, lines.join('\n')).toEqual([]);
});
