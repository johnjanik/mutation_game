// P2-A7: the browser tests of the phase-2 additions to T1, T2 and T9 and of the open-problem page
// (SPEC.md 4 T1, T2, T9, 4.0, 2.11, 2.12, 7.3, 7.5, D15). Against the built site (astro preview), and,
// for configurations only properties can set (T1's panels, T9 on an affine board, a prediction), the
// components bundled here with Vite and served by a small local server, as T09.spec.ts does for its
// prediction (no page of the site places them yet; T09.ts offers only the 32 finite names, so the
// codec refuses /tools/kostant?g=D4~ until MERGE adds the affine names). The fixture page gives <main>
// the side padding of the site's Base.astro, which ToolFrame's edge-to-edge figure expects below 400
// pixels. Tests read only the hooks of 4.0 and the live region.
//
// Hooks read (data-out):
//   T1: formValue, level, lengths (li data-label, data-length), fate, limit, gameOver, notice
//   T2: found, total, stopMessage, verdict
//   T9: affineBoard (data-name), limit, verdict, endPanel
//   T4 (P2-A3's names): verdictClass, verdictName
// Hooks read (data-control):
//   T1: playToEnd (data-play "on" or "end"), step, view (its options)
//   T2: grow, showTotal
//   T9: playToEnd (data-play), openLab, predictShow
// Other hooks: data-tool, data-hydrated, data-moves (tool root); data-node, data-board, data-value (node
// buttons); data-golden, data-unverified, data-link (the open-problem page); [data-live] (live region).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { ssrLoader } from '../unit/_svelteSsr';

const GOLDEN = JSON.parse(readFileSync(fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  types: Record<string, { cartan: number[][]; n_roots: number }>;
  kostant: Record<string, { affine_board_from_node: string[] }>;
  one_way_counterexample: { cartan: number[][]; result: number[] };
  pentagon_example: { start: number[]; level: number; moves: number; end: number[] };
  layer_growth_examples: { label: string; cartan: number[][] }[];
};
const TRIANGLE = GOLDEN.layer_growth_examples.find((g) => g.label === 'triangle')!.cartan;
const cLink = (cartan: number[][]): string => `c:${cartan.map((r) => r.join(',')).join(';')}`;
/** E6 renumbered as a custom matrix (the permutation of T09-phase2.test.ts). */
const E6_RENUMBERED = ((): number[][] => {
  const C = GOLDEN.types.E6!.cartan;
  const sigma = [3, 5, 0, 2, 4, 1];
  return sigma.map((i) => sigma.map((j) => C[i]![j]!));
})();
const PENTAGON = GOLDEN.pentagon_example;

const tool = (page: Page, id: string): Locator => page.locator(`[data-tool="${id}"]`);
const out = (scope: Locator, name: string): Locator => scope.locator(`[data-out="${name}"]`);
const control = (scope: Locator, name: string): Locator => scope.locator(`[data-control="${name}"]`);
/** The signed numerals of a text, read from the text alone (true minus sign or hyphen). */
const numerals = (text: string): string[] => (text.match(/[-−]?\d+(?:\/\d+)?/g) ?? []).map((x) => x.replace('−', '-'));

async function openTool(page: Page, id: string, route: string): Promise<Locator> {
  await page.goto(route);
  const root = tool(page, id);
  await expect(root).toHaveAttribute('data-hydrated', 'true');
  return root;
}

async function nodeValues(root: Locator, board: 'numbers' | 'populations'): Promise<string[]> {
  const pairs = await root
    .locator(`button[data-node][data-board="${board}"]`)
    .evaluateAll((els) => els.map((e) => [Number(e.getAttribute('data-node')), e.getAttribute('data-value') ?? ''] as [number, string]));
  return pairs.sort((a, b) => a[0] - b[0]).map((p) => p[1]);
}

// ---------------------------------------------------------------------------------------------
// Fixtures: T1 and T9 bundled with properties, server-rendered, served from a local server
// ---------------------------------------------------------------------------------------------

const SITE = fileURLToPath(new URL('../../', import.meta.url));
const prediction = { question: 'How many moves will the play take?', answer: { type: 'number', value: 4 }, reveal: 'Four raising moves.' };
const FIXTURES: Record<string, { component: 'T01GameBoard' | 'T09Kostant'; props: Record<string, unknown> }> = {
  't1-pentagon': {
    component: 'T01GameBoard',
    props: { id: 'b1', caption: 'The pentagon example.', board: 'pentagon', view: 'numbers', mode: 'legal', coords: 'numbers', start: PENTAGON.start, panels: ['form', 'level', 'lengths'] },
  },
  't1-b3': { component: 'T01GameBoard', props: { id: 'b1', caption: 'B3 with its lengths.', board: 'B3', view: 'linked', coords: 'populations', start: [1, 0, 0], panels: ['form', 'lengths'] } },
  't1-triangle': {
    component: 'T01GameBoard',
    props: { id: 'b1', caption: 'The triangle.', board: { cartan: TRIANGLE }, view: 'linked', mode: 'legal', coords: 'populations', start: [1, 0, 0], panels: ['form', 'level', 'lengths'] },
  },
  't9-d4-affine': { component: 'T09Kostant', props: { id: 'b1', caption: 'The star with four arms.', board: 'D4~', start: [1, 0, 0, 0, 0] } },
  't9-d4-affine-predict': { component: 'T09Kostant', props: { id: 'b1', caption: 'The star with four arms.', board: 'D4~', start: [1, 0, 0, 0, 0], prediction } },
  't9-d4-predict': { component: 'T09Kostant', props: { id: 'b1', caption: 'D4 from city 1.', board: 'D4', start: [1, 0, 0, 0], prediction } },
};

let files = new Map<string, string>();
const entries: Record<string, string> = {};
const serverHtml: Record<string, string> = {};
let fixtureServer: Server | null = null;
let ORIGIN = '';

const escapeAttr = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

test.beforeAll(async () => {
  const components = ['T01GameBoard', 'T09Kostant'] as const;
  const virtual: Plugin = {
    name: 'p2a7-entries',
    resolveId: (id) => (id.startsWith('virtual:p2a7-') ? `\0${id}` : null),
    load: (id) => {
      const m = /^\0virtual:p2a7-(T01GameBoard|T09Kostant)$/.exec(id);
      if (m === null) return null;
      const file = join(SITE, `src/components/tools/${m[1]}.svelte`);
      return `import { hydrate } from 'svelte'; import T from ${JSON.stringify(file)};
        const target = document.getElementById('app');
        hydrate(T, { target, props: JSON.parse(target.dataset.props) });`;
    },
  };
  const result = await build({
    configFile: false,
    root: SITE,
    logLevel: 'silent',
    cacheDir: join(tmpdir(), 'two-games-p2a7-fixtures-cache'),
    plugins: [virtual, svelte({ configFile: false })],
    resolve: { tsconfigPaths: true },
    build: {
      write: false,
      minify: false,
      modulePreload: false,
      rollupOptions: { input: Object.fromEntries(components.map((c) => [c, `virtual:p2a7-${c}`])) },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((o) => ('output' in o ? o.output : []));
  files = new Map();
  for (const o of outputs) {
    const text = o.type === 'chunk' ? o.code : typeof o.source === 'string' ? o.source : Buffer.from(o.source).toString('utf8');
    files.set(o.fileName, text);
    if (o.type === 'chunk' && o.isEntry) entries[o.name] = o.fileName;
  }
  const loader = await ssrLoader();
  try {
    for (const [name, f] of Object.entries(FIXTURES)) {
      const { default: T } = await loader.load<{ default: unknown }>(`/src/components/tools/${f.component}.svelte`);
      serverHtml[name] = loader.render(T, f.props);
    }
  } finally {
    await loader.close();
  }
  const css = [...files.keys()].filter((k) => k.endsWith('.css'));
  fixtureServer = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const m = /^\/fixture\/([\w-]+)\/$/.exec(url.pathname);
    if (m !== null && FIXTURES[m[1]!] !== undefined) {
      const f = FIXTURES[m[1]!]!;
      const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>P2-A7 fixture</title>${css
        .map((c) => `<link rel="stylesheet" href="/${c}">`)
        .join('')}<style>body{margin:0}main{max-width:42rem;margin-inline:auto;padding-inline:16px}</style></head><body><main><div id="app" data-props="${escapeAttr(JSON.stringify(f.props))}">${serverHtml[m[1]!]}</div></main><script type="module" src="/${entries[f.component]}"></script></body></html>`;
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(body);
      return;
    }
    const file = files.get(url.pathname.slice(1));
    if (file === undefined) {
      res.writeHead(404);
      res.end('');
      return;
    }
    res.writeHead(200, { 'content-type': url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
    res.end(file);
  });
  await new Promise<void>((resolve) => fixtureServer!.listen(0, '127.0.0.1', resolve));
  ORIGIN = `http://127.0.0.1:${(fixtureServer.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => (fixtureServer ? fixtureServer.close(() => resolve()) : resolve()));
});

async function openFixture(page: Page, name: string, id: 'board' | 'kostant'): Promise<Locator> {
  return openTool(page, id, `${ORIGIN}/fixture/${name}/`);
}

// ---------------------------------------------------------------------------------------------
// T2 (SPEC 4 T2, G2 part; 4.0 growth bounds from classify)
// ---------------------------------------------------------------------------------------------

async function growAll(root: Locator, limit = 60): Promise<number> {
  let presses = 0;
  const grow = control(root, 'grow');
  while (presses < limit && (await grow.isEnabled())) {
    await grow.click();
    presses++;
  }
  return presses;
}

test('T2 on the triangle stops after 40 layers with the verdict affine', async ({ page }) => {
  const root = await openTool(page, 'garden', `tools/garden/?z=1&g=${cLink(TRIANGLE)}`);
  await expect(out(root, 'verdict')).toHaveCount(0);
  expect(await growAll(root)).toBe(40);
  await expect(out(root, 'stopMessage')).toHaveText('stopped after 40 layers');
  await expect(out(root, 'verdict')).toHaveText('affine');
  expect(await page.locator('body').textContent()).not.toContain('not of finite type');
});

test('T2 on a renumbered E6 custom board grows completely with no stop message', async ({ page }) => {
  const root = await openTool(page, 'garden', `tools/garden/?z=1&g=${cLink(E6_RENUMBERED)}`);
  await growAll(root);
  await expect(control(root, 'grow')).toBeDisabled();
  const n = String(GOLDEN.types.E6!.n_roots);
  await expect(out(root, 'found')).toHaveText(n);
  await expect(out(root, 'stopMessage')).toHaveCount(0);
  await expect(out(root, 'verdict')).toHaveCount(0);
  // The total of a board classify calls finite (phase 1 said "no total" on every custom board).
  await control(root, 'showTotal').click();
  await expect(out(root, 'total')).toHaveText(n);
});

// ---------------------------------------------------------------------------------------------
// T9 (SPEC 4 T9, G2 part)
// ---------------------------------------------------------------------------------------------

test('T9 on D4 names D4~ after play to the end', async ({ page }) => {
  const root = await openTool(page, 'kostant', 'tools/kostant/?z=1&g=D4');
  const play = control(root, 'playToEnd');
  await expect(play).toHaveAttribute('data-play', 'end');
  await expect(play).toHaveText(/^\s*play to the end\s*$/i);
  await expect(out(root, 'affineBoard')).toHaveCount(0);
  await expect(control(root, 'openLab')).toHaveCount(0);
  await play.click();
  const expected = GOLDEN.kostant.D4!.affine_board_from_node[0]!;
  await expect(out(root, 'affineBoard')).toHaveAttribute('data-name', expected);
  await expect(out(root, 'affineBoard')).toHaveText(expected);
  await expect(control(root, 'openLab')).toHaveAttribute('href', new RegExp(`tools/lab\\?g=${expected}$`));
  await expect(control(root, 'openLab')).toHaveText('add the city');
});

test('add the city opens /tools/lab with D4~', async ({ page }) => {
  const root = await openTool(page, 'kostant', 'tools/kostant/?z=1&g=D4');
  await control(root, 'playToEnd').click();
  await control(root, 'openLab').click();
  await expect(page).toHaveURL(/\/tools\/lab\/?\?g=D4~$/);
  // T4 (P2-A3) reads g and shows the verdict of classify for the star with four arms.
  const lab = tool(page, 'lab');
  await expect(lab).toHaveAttribute('data-hydrated', 'true');
  await expect(out(lab, 'verdictClass')).toHaveText('affine');
  const name = out(lab, 'verdictName');
  const named = (await name.getAttribute('data-name')) ?? (await name.textContent()) ?? '';
  expect(named.replace(/\s+/g, '')).toMatch(/^D4~?$/);
});

test('T9 on D4~ shows play on and no play to the end', async ({ page }) => {
  const root = await openFixture(page, 't9-d4-affine', 'kostant');
  const play = control(root, 'playToEnd');
  await expect(play).toHaveCount(1);
  await expect(play).toHaveAttribute('data-play', 'on');
  await expect(play).toHaveText(/^\s*play on\s*$/i);
  await expect(play).toBeEnabled();
  await expect(out(root, 'endPanel')).toHaveCount(0);
  // On D4 the same element offers play to the end.
  const d4 = await openTool(page, 'kostant', 'tools/kostant/?z=1&g=D4');
  await expect(control(d4, 'playToEnd')).toHaveAttribute('data-play', 'end');
  await expect(control(d4, 'playToEnd')).toHaveText(/^\s*play to the end\s*$/i);
});

test('T9 play on D4~ reports still running after 20000 moves with affine', async ({ page }) => {
  const root = await openFixture(page, 't9-d4-affine', 'kostant');
  await control(root, 'playToEnd').click();
  await expect(out(root, 'limit')).toHaveText('still running after 20000 moves', { timeout: 60000 });
  await expect(root).toHaveAttribute('data-moves', '20000');
  await expect(out(root, 'verdict')).toHaveText(/^affine\b/);
  await expect(out(root, 'verdict')).toContainText('D4~');
  await expect(root.locator('[data-live]')).toHaveText('Still running after 20000 moves.');
  // The moves list is at the link maximum: a second "play on" is not offered.
  await expect(control(root, 'playToEnd')).toBeDisabled();
});

test('play on and openLab respect a frozen prediction in the browser', async ({ page }) => {
  const root = await openFixture(page, 't9-d4-affine-predict', 'kostant');
  await expect(control(root, 'playToEnd')).toHaveAttribute('data-play', 'on');
  await expect(control(root, 'playToEnd')).toBeDisabled();
  await control(root, 'predictShow').click();
  await expect(control(root, 'playToEnd')).toBeEnabled();
  const d4 = await openFixture(page, 't9-d4-predict', 'kostant');
  await expect(control(d4, 'playToEnd')).toHaveAttribute('data-play', 'end');
  await expect(control(d4, 'playToEnd')).toBeDisabled();
  await expect(control(d4, 'openLab')).toHaveCount(0);
  await control(d4, 'predictShow').click();
  await expect(control(d4, 'playToEnd')).toBeEnabled();
  await control(d4, 'playToEnd').click();
  await expect(control(d4, 'openLab')).toHaveAttribute('href', /tools\/lab\?g=D4~$/);
});

// ---------------------------------------------------------------------------------------------
// T1 (SPEC 4 T1 panels, the affine rule, "play on")
// ---------------------------------------------------------------------------------------------

test('T1 level panel stays at the pentagon_example level along play', async ({ page }) => {
  const root = await openFixture(page, 't1-pentagon', 'board');
  const level = out(root, 'level');
  for (let k = 0; k <= PENTAGON.moves; k++) {
    await expect(root).toHaveAttribute('data-moves', String(k));
    expect(numerals((await level.textContent()) ?? ''), `after ${k} moves`).toEqual([String(PENTAGON.level)]);
    if (k < PENTAGON.moves) await control(root, 'step').click();
  }
  await expect(out(root, 'gameOver')).toHaveText(new RegExp(`^game over after ${PENTAGON.moves} moves\\.$`, 'i'));
});

test('T1 lengths panel on B3 marks nodes 1 and 2 long and node 3 short', async ({ page }) => {
  const root = await openFixture(page, 't1-b3', 'board');
  const items = out(root, 'lengths').locator('[data-length]');
  const marks = await items.evaluateAll((els) => els.map((e) => [e.getAttribute('data-label'), e.getAttribute('data-length')]));
  expect(marks).toEqual([['1', 'long'], ['2', 'long'], ['3', 'short']]);
  await expect(out(root, 'lengths')).toContainText('Long nodes 1 and 2; short node 3.');
  await expect(out(root, 'formValue')).toBeVisible();
});

test('T1 on D4~ with a numbers start offers only the numbers view', async ({ page }) => {
  const root = await openTool(page, 'board', 'tools/board/?z=1&g=D4~&v=l&c=n&s=1,1,1,1,1');
  await expect(out(root, 'notice')).toHaveCount(0);
  await expect(root.locator('button[data-node][data-board="populations"]')).toHaveCount(0);
  await expect(root.locator('button[data-node][data-board="numbers"]')).toHaveCount(5);
  const options = await control(root, 'view').locator('option').evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value));
  expect(options).toEqual(['numbers']);
  // A population start on the same board keeps all three views.
  const pop = await openTool(page, 'board', 'tools/board/?z=1&g=D4~&v=l&c=p&s=1,0,0,0,0');
  await expect(pop.locator('button[data-node][data-board="populations"]')).toHaveCount(5);
  const all = await control(pop, 'view').locator('option').evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value));
  expect(all).toEqual(['populations', 'numbers', 'linked']);
});

test('T1 play on the pentagon example ends after pentagon_example.moves moves at pentagon_example.end', async ({ page }) => {
  const root = await openTool(page, 'board', `tools/board/?z=1&g=pentagon&v=n&m=l&c=n&s=${PENTAGON.start.join(',')}`);
  const play = control(root, 'playToEnd');
  await expect(play).toHaveAttribute('data-play', 'on');
  await expect(play).toHaveText(/^\s*play on\s*$/i);
  await play.click();
  await expect(root).toHaveAttribute('data-moves', String(PENTAGON.moves), { timeout: 30000 });
  expect(await nodeValues(root, 'numbers')).toEqual(PENTAGON.end.map(String));
  await expect(out(root, 'gameOver')).toHaveText(new RegExp(`^game over after ${PENTAGON.moves} moves\\.$`, 'i'));
  await expect(out(root, 'fate')).toHaveText('');
  await expect(out(root, 'limit')).toHaveText('');
});

test('T1 play to the end on the triangle reports the cap as play on', async ({ page }) => {
  const root = await openTool(page, 'board', `tools/board/?z=1&g=${cLink(TRIANGLE)}&v=n&m=l&c=n&s=1,1,1`);
  await expect(control(root, 'playToEnd')).toHaveAttribute('data-play', 'on');
  await control(root, 'playToEnd').click();
  await expect(out(root, 'limit')).toHaveText('still running after 20000 moves', { timeout: 60000 });
  await expect(control(root, 'playToEnd')).toBeDisabled();
});

// ---------------------------------------------------------------------------------------------
// Small screens (4.0, A-7, A-11)
// ---------------------------------------------------------------------------------------------

test('at 320 pixels play on and add the city are 44 pixel targets and the panels reflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const fits = async (): Promise<void> => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  };
  const target = async (loc: Locator): Promise<void> => {
    await loc.scrollIntoViewIfNeeded();
    const box = await loc.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  };
  const t1 = await openTool(page, 'board', `tools/board/?z=1&g=${cLink(TRIANGLE)}&v=n&m=l&c=n&s=1,1,1`);
  await expect(control(t1, 'playToEnd')).toHaveAttribute('data-play', 'on');
  await target(control(t1, 'playToEnd'));
  await fits();
  const panels = await openFixture(page, 't1-triangle', 'board');
  await expect(out(panels, 'level')).toBeVisible();
  await expect(out(panels, 'lengths')).toBeVisible();
  await target(control(panels, 'playToEnd'));
  await fits();
  const t9a = await openFixture(page, 't9-d4-affine', 'kostant');
  await target(control(t9a, 'playToEnd'));
  await fits();
  const t9 = await openTool(page, 'kostant', 'tools/kostant/?z=1&g=D4');
  await control(t9, 'playToEnd').click();
  await expect(out(t9, 'affineBoard')).toHaveText('D4~');
  await target(control(t9, 'openLab'));
  await fits();
});

// ---------------------------------------------------------------------------------------------
// The open-problem page (SPEC 2.11, 7.3, D15)
// ---------------------------------------------------------------------------------------------

test('open-problem without JavaScript shows the statement, the one-way counterexample and both links', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto('open-problem/');
  await expect(page.locator('h1')).toHaveText('The Mutation Conjecture');
  const main = page.locator('main');
  await expect(main).toContainText('entirely of Martians or entirely of anti-Martians');
  await expect(main).toContainText('The Mutation Problem');
  const result = `(${GOLDEN.one_way_counterexample.result.map((x) => String(x).replace('-', '−')).join(', ')})`;
  await expect(main.locator('[data-golden="one_way_counterexample.result"]')).toHaveText(result);
  // The hunter's two links to T4 (the Lab, and the Lab on the one-way board built from the golden matrix).
  await expect(main.locator('a[data-link="lab"]')).toHaveAttribute('href', /tools\/lab\/?$/);
  await expect(main.locator('a[data-link="lab-one-way"]')).toHaveAttribute('href', new RegExp(`tools/lab/?\\?g=${cLink(GOLDEN.one_way_counterexample.cartan).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  // D15: the repository's issue tracker, no form.
  await expect(main.locator('a[data-link="issues"]')).toHaveAttribute('href', /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues$/);
  await expect(main.locator('form')).toHaveCount(0);
  await context.close();
});

test('open-problem has no serious or critical axe violations', async ({ page }) => {
  await page.goto('open-problem/');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.help}`);
  expect(serious).toEqual([]);
});

test('open-problem marks the Kac reference as open item E4', async ({ page }) => {
  await page.goto('open-problem/');
  const marked = page.locator('main [data-unverified="E4"]');
  expect(await marked.count()).toBeGreaterThanOrEqual(1);
  await expect(marked.first()).toContainText('Kac');
  const mark = marked.first().locator('a.unverified-mark');
  await expect(mark).toHaveAttribute('href', /open-items#E4$/);
  await mark.click();
  await expect(page.locator('#E4')).toHaveCount(1);
});

test('open-problem text has no em-dash', async ({ page }) => {
  await page.goto('open-problem/');
  const text = (await page.locator('main').textContent()) ?? '';
  expect(text.length).toBeGreaterThan(1000);
  expect(text).not.toContain('\u2014');
});
