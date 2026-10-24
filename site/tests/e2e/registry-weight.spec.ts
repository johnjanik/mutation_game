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
// site (npm run build) and needs no browser. The built directory and the base are those of the build
// and of playwright.config.ts: outDirFrom(process.env) and siteAndBase(process.env).base, as
// basepath.spec.ts reads them. An island's URL carries the base, which is not a directory of the
// build: in CI the base is /<repo>/ (SPEC 7.2 item 10), and reading the URL with only its leading
// slash dropped opened site/dist/<repo>/_astro/..., which does not exist (RT-FIX P4-RT-12-02).
import { expect, test } from '@playwright/test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { outDirFrom, siteAndBase } from '../../astro.config.mjs';

const SITE_DIR = resolve(import.meta.dirname, '../..');
const dist = resolve(SITE_DIR, outDirFrom(process.env));
const { base } = siteAndBase(process.env);
const routes = ['/tools/board/', '/tools/lab/', '/tools/numbers/', '/modules/m0-start/', '/modules/m3-classification/'];
const MARKS = {
  'T2 presets (t02/presets.ts)': 'the root poset',
  'T8 presets (t08/presets.ts)': 'one for each element of the group',
};

/**
 * The static import closure of the client:idle islands of a built page: the files of the build
 * (paths relative to `distDir`) that their component-url and renderer-url name, and every file
 * those import by a relative path. A URL is the path of a file under `siteBase`; one outside it is
 * reported in `problems`.
 */
function idleClosure(distDir: string, siteBase: string, html: string): { files: Set<string>; problems: string[] } {
  const roots: string[] = [];
  const problems: string[] = [];
  for (const m of html.matchAll(/<astro-island\b([^>]*)>/g)) {
    if (!/client="idle"/.test(m[1]!)) continue;
    for (const k of ['component-url', 'renderer-url']) {
      const u = (m[1]!.match(new RegExp(`${k}="([^"]+)"`)) || [])[1];
      if (!u) continue;
      if (u.startsWith(siteBase)) roots.push(u.slice(siteBase.length));
      else problems.push(`${k}="${u}" lies outside the base ${siteBase}`);
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
  return { files: seen, problems };
}

// regression: P3-RT-07-04
// regression: P4-RT-12-02
test('every tool route and lesson fetches no other tool presets before interaction', () => {
  let bad = 0;
  const lines: string[] = [];
  for (const route of routes) {
    const html = readFileSync(join(dist, route, 'index.html'), 'utf8');
    const { files: seen, problems } = idleClosure(dist, base, html);
    expect(problems, route).toEqual([]);
    const tool = (html.match(/data-tool="([^"]+)"/) || [])[1];
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

// regression: P4-RT-12-02
test('registry-weight.spec.ts reads the built files of island URLs without the /<repo>/ base in the path', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'registry-weight-'));
  try {
    mkdirSync(join(tmp, '_astro'));
    writeFileSync(join(tmp, '_astro', 'island.js'), 'import { a } from "./shared.js";\nexport { b } from "./absent.js";\n');
    writeFileSync(join(tmp, '_astro', 'shared.js'), 'export const a = 1;\n');
    writeFileSync(join(tmp, '_astro', 'client.js'), 'export default 1;\n');
    const island = (prefix: string) => `<astro-island uid="u" component-url="${prefix}_astro/island.js" renderer-url="${prefix}_astro/client.js" client="idle"></astro-island>`;
    for (const siteBase of ['/', '/mutation_game/', '/sub/path/']) {
      const { files, problems } = idleClosure(tmp, siteBase, island(siteBase));
      expect(problems, siteBase).toEqual([]);
      expect([...files].sort(), siteBase).toEqual(['_astro/client.js', '_astro/island.js', '_astro/shared.js']);
    }
    // A URL outside the base is a problem of the build, not a file to read.
    expect(idleClosure(tmp, '/mutation_game/', island('/')).problems).toHaveLength(2);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
