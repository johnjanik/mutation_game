// RT-FIX P3-RT-07-04 (adopted from the RT-07 lens script redteam/redteam-RT-07-registry-weight.mjs):
// every tool route and every lesson must not fetch, before interaction, the presets of every OTHER
// tool. The cause was that ToolFrame imports lib/urlCodec.ts, which imports the tool registry
// (site/src/tools/index.ts), which loaded every registry entry eagerly
// (import.meta.glob(..., { eager: true })), and the entries import their tools' presets modules, whose
// top-level code calls the engine to compose captions while the first tool hydrates (t02/presets.ts:
// roots of A3 and A2, positive roots of A3, a 40-layer orbit of the triangle; t05/presets.ts: plays;
// t08/presets.ts: weylOrder, legalLayers, countCompleteGames). SPEC 7.6: a tool route carries "the
// tool's own code with the engine functions only it uses"; RT-07 attacks 12 and 20.
// Checks the static import closure of the client:idle island of each route for caption text of T2's
// and T8's presets; fails when a route that does not show those tools carries them. Reads the built
// site (npm run build) and needs no browser.
import { expect, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
const routes = ['/tools/board/', '/tools/lab/', '/tools/numbers/', '/modules/m0-start/', '/modules/m3-classification/'];
const MARKS = {
  'T2 presets (t02/presets.ts)': 'the root poset',
  'T8 presets (t08/presets.ts)': 'one for each element of the group',
};

// regression: P3-RT-07-04
test('every tool route and lesson fetches no other tool presets before interaction', () => {
  let bad = 0;
  const lines: string[] = [];
  for (const route of routes) {
    const html = readFileSync(join(dist, route, 'index.html'), 'utf8');
    const roots: string[] = [];
    for (const m of html.matchAll(/<astro-island\b([^>]*)>/g)) {
      if (!/client="idle"/.test(m[1]!)) continue;
      for (const k of ['component-url', 'renderer-url']) {
        const u = (m[1]!.match(new RegExp(`${k}="([^"]+)"`)) || [])[1];
        if (u) roots.push(u.replace(/^\//, ''));
      }
    }
    const tool = (html.match(/data-tool="([^"]+)"/) || [])[1];
    const seen = new Set<string>();
    const stack = [...roots];
    while (stack.length) {
      const p = stack.pop()!;
      if (seen.has(p)) continue;
      seen.add(p);
      for (const m of readFileSync(join(dist, p), 'utf8').matchAll(/(?:import|export)\s*(?:[\w*{}\s,$]*?from\s*)?["'](\.\/[^"']+\.js)["']/g)) {
        const next = join(p.replace(/[^/]+$/, ''), m[1]!);
        if (existsSync(join(dist, next))) stack.push(next);
      }
    }
    const found: string[] = [];
    for (const [label, s] of Object.entries(MARKS)) {
      const where = [...seen].filter((p) => readFileSync(join(dist, p), 'utf8').includes(s));
      if (where.length) found.push(`${label} in ${where.join(', ')}`);
    }
    lines.push(`${route} (first tool: ${tool}): ${found.length ? found.join('; ') : 'no other tool presets'}`);
    if (found.length && tool !== 'garden' && tool !== 'weyl') bad++;
  }
  expect(bad, lines.join('\n')).toBe(0);
});

/**
 * The files of the static import closure (what the browser fetches before the module runs) of the
 * client:idle island of a built route, and whether the route shows the tool `toolId`. The rule of the
 * RT-07 lens script redteam/redteam-RT-07-shared-config.mjs (phase 4 round).
 */
function idleClosure(route: string, toolId: string): { files: string[]; shows: boolean } {
  const html = readFileSync(join(dist, route, 'index.html'), 'utf8');
  const roots: string[] = [];
  for (const m of html.matchAll(/<astro-island\b([^>]*)>/g)) {
    if (!/client="idle"/.test(m[1]!)) continue;
    for (const k of ['component-url', 'renderer-url']) {
      const u = (m[1]!.match(new RegExp(`${k}="([^"]+)"`)) || [])[1];
      if (u) roots.push(u.replace(/^\//, ''));
    }
  }
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const p = join(dist, f);
    if (!existsSync(p)) continue;
    const code = readFileSync(p, 'utf8');
    for (const m of code.matchAll(/(?:^|[;\n}])\s*import\s*(?:[^'"()]*?from\s*)?["']([^"']+)["']/g)) {
      const spec = m[1]!;
      if (!spec.startsWith('.') && !spec.startsWith('/')) continue;
      const base = f.split('/').slice(0, -1).join('/');
      stack.push(spec.startsWith('/') ? spec.replace(/^\//, '') : join(base, spec).replace(/\\/g, '/'));
    }
  }
  return { files: [...seen].filter((f) => existsSync(join(dist, f))), shows: new RegExp(`data-tool="${toolId}"`).test(html) };
}

/** Routes that do not show the tool but fetch, before interaction, a file carrying one of its marks. */
function carriersOf(routes: readonly string[], toolId: string, marks: readonly string[]): string[] {
  const lines: string[] = [];
  for (const route of routes) {
    const { files, shows } = idleClosure(route, toolId);
    const carriers = files.filter((f) => marks.some((s) => readFileSync(join(dist, f), 'utf8').includes(s)));
    if (!shows && carriers.length) lines.push(`${route} (shows ${toolId}: ${shows}): captions in ${carriers.join(', ')}`);
  }
  return lines;
}

const SHARED_CONFIG_ROUTES = ['/tools/board/', '/modules/m0-start/', '/tools/garden/', '/tools/weyl/', '/modules/m6-multiple-edges/'];

// regression: P4-RT-07-05
test('offered.ts pulls no T10 preset captions into the shared code of routes that do not show T10', () => {
  const MARKS = ['The roots of E8 in its Coxeter plane', 'The hexagon of A2 carries two graphs', 'B3 with equal numbers on its last two nodes'];
  const bad = carriersOf(SHARED_CONFIG_ROUTES, 'geometry', MARKS);
  expect(bad, bad.join('\n')).toEqual([]);
});

// The same cause for T11 (offered.ts read T11_BOARDS from t11/config.ts, with T11's captions).
test('offered.ts pulls no T11 preset captions into the shared code of routes that do not show T11', () => {
  const MARKS = ['Folding A3 by its flip gives the board B2', 'Averaging the roots of A5 over its flip'];
  const bad = carriersOf(SHARED_CONFIG_ROUTES, 'fold', MARKS);
  expect(bad, bad.join('\n')).toEqual([]);
});
