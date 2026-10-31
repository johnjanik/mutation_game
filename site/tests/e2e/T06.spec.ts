// P3-A4: tool T6, the Kaleidoscope, against the built site (SPEC.md 4 T6, 4.0, 2.4, 2.14, 6.6, 7.4,
// 7.5). Cases are opened by bare query parameters on /tools/mirror/ (6.6: every state is a link) or
// through the tool's controls. Tests read only the hooks of 4.0 and the live region (and, where a
// criterion is about the address bar, the clipboard or a download, those). Expected values are computed
// here in Node from the engine or read from reference/golden_data.json, never typed.
//
// Hooks read:
//   root:     data-tool="mirror", data-moves, data-hydrated="true"
//   buttons:  data-node, data-board ("numbers"), data-value, data-can-act; the button's title is the
//             tooltip holding the exact digits of a long value
//   drawing:  data-numeral (the numeral drawn on a node, Board.svelte)
//   table:    data-table-node (the A-10 table's buttons), data-row, data-table-value
//   strip:    data-step (a strip button of History.svelte)
//   live:     [data-live] (ToolFrame's polite live region)
// data-out names (every one T6 renders; the registry's `outs`):
//   caption, notice, noscript, exportNotice (ToolFrame); moveCounter, historyStrip, historyCounter
//   (History.svelte); predictResult, predictReveal (Predict.svelte);
//   boardName (data-name), numbers (data-value "a1,a2"), population (data-value "p1,p2", each "p/q" or
//   "p"), equation (the line a = Cp, its words in aria-label), bridge (the sentence of 2.4(a)),
//   point (data-x, data-y: plane coordinates to 3 decimals), distance (data-node, data-value: the signed
//   distance to mirror i), parallelogram, simpleRoot (data-node), mirror (data-mirror: index of its
//   positive root; data-simple: 1 or 2 on the two simple mirrors), chamber (data-dominant="true" on the
//   dominant one only), root (data-value: the root in label order; data-marked when highlighted),
//   orbitPoint (data-value: its numbers), latticeDot (data-lattice "root" | "weight", data-x, data-y),
//   offView
// data-control names: picker, plane, a1-minus, a1-plus, a2-minus, a2-plus, overlay-roots, overlay-orbit,
//   overlay-lattices; undo, redo, reset, historySlider (History.svelte); copyLink, downloadData
//   (ToolFrame); data-export="svg" | "png" (ToolFrame); predictAnswer, predictCheck, predictShow
//   (Predict.svelte)
//
// Properties of T6 beyond the common ones of 4.0 Configuration (id, board, coords, start, moves,
// linkTo, prediction, preset, caption, layers):
//   overlays: ('roots' | 'orbit' | 'lattices')[]   default []   the overlays switched on at first
//   boardChoices: string[]                           default ['A2', 'B2', 'C2', 'G2']   limits the picker
// linkTo and layers are accepted and ignored (no placement links T6; it grows no set); preset knows
// only 'default'.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CAPS, boardFromName, choleskyBasis, fire, orbit, ratToString, toNumbers, toPopulation } from '../../../packages/engine/src/index';
import type { Board } from '../../../packages/engine/src/index';
import { copiedLink, downloadData, openForExport, safeAsStrings, unsafeNumbers } from './exportIntegers';

const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  types: Record<string, { n_roots: number }>;
};

const ROUTE = 'tools/mirror/';
const NOTICE = 'The link could not be read, so the tool shows its default state.';
const BRIDGE = 'The number on node i is the amount by which a mutation would lower city i.';

const root = (page: Page): Locator => page.locator('[data-tool="mirror"]');
const node = (page: Page, label: number): Locator => root(page).locator(`button[data-board="numbers"][data-node="${label}"]`);
const nodes = (page: Page): Locator => root(page).locator('button[data-board="numbers"][data-node]');
const out = (page: Page, name: string): Locator => root(page).locator(`[data-out="${name}"]`);
const control = (page: Page, name: string): Locator => root(page).locator(`[data-control="${name}"]`);
const live = (page: Page): Locator => root(page).locator('[data-live]');

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`${ROUTE}${query ? `?${query}` : ''}`);
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
}

async function values(page: Page): Promise<string[]> {
  return [await node(page, 1).getAttribute('data-value'), await node(page, 2).getAttribute('data-value')].map((v) => v ?? '');
}

// The engine in Node: the expected values of each case.
const B = (name: string): Board<number> => boardFromName(name) as Board<number>;
const popText = (name: string, a: number[]): string => toPopulation(B(name), a)!.map(ratToString).join(',');
const fired = (name: string, a: number[], label: number): number[] => fire(B(name), a, label - 1);
/** The point U C^{-1} a in the plane, to 3 decimals (column j of U is alpha_(j+1)). */
function pointText(name: string, a: number[]): [string, string] {
  const U = choleskyBasis(B(name));
  const p = toPopulation(B(name), a)!.map((r) => Number(r.num) / Number(r.den));
  const f = (x: number): string => {
    const t = x.toFixed(3);
    return /^-0\.0+$/.test(t) ? t.slice(1) : t;
  };
  return [f(U[0]![0]! * p[0]! + U[0]![1]! * p[1]!), f(U[1]![0]! * p[0]! + U[1]![1]! * p[1]!)];
}

// ---------------------------------------------------------------------------------------------
// The roster's named examples
// ---------------------------------------------------------------------------------------------

test('the M4 figure: A2 at a = (1,1), firing is reflecting', async ({ page }) => {
  await open(page);
  await expect(nodes(page)).toHaveCount(2);
  expect(await values(page)).toEqual(['1', '1']);
  await expect(out(page, 'population')).toHaveAttribute('data-value', popText('A2', [1, 1]));
  await expect(out(page, 'bridge')).toHaveText(BRIDGE);
  await expect(out(page, 'equation')).toHaveAttribute('aria-label', /a equals C times p/);
  await expect(out(page, 'boardName')).toHaveAttribute('data-name', 'A2');
  const before = await out(page, 'point').getAttribute('data-x');
  await node(page, 1).click();
  const after = fired('A2', [1, 1], 1);
  expect(await values(page)).toEqual(after.map(String));
  await expect(out(page, 'population')).toHaveAttribute('data-value', popText('A2', after));
  await expect(out(page, 'equation')).toHaveAttribute('aria-label', new RegExp(`numbers ${after[0]! < 0 ? 'minus ' : ''}${Math.abs(after[0]!)}, ${after[1]}`));
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  const [x, y] = pointText('A2', after);
  await expect(out(page, 'point')).toHaveAttribute('data-x', x);
  await expect(out(page, 'point')).toHaveAttribute('data-y', y);
  expect(x).not.toBe(before);
  await expect(live(page)).toHaveText(`Fired node 1. Numbers now minus ${-after[0]!}, ${after[1]}. Move 1.`);
  await control(page, 'undo').click();
  expect(await values(page)).toEqual(['1', '1']);
  await expect(out(page, 'population')).toHaveAttribute('data-value', popText('A2', [1, 1]));
});

test('one case per board', async ({ page }) => {
  for (const name of ['B2', 'C2', 'G2']) {
    await open(page, `g=${name}&c=n&s=1,1`);
    await expect(out(page, 'boardName')).toHaveAttribute('data-name', name);
    await expect(out(page, 'population')).toHaveAttribute('data-value', popText(name, [1, 1]));
    await node(page, 1).click();
    const a = fired(name, [1, 1], 1);
    expect(await values(page)).toEqual(a.map(String));
    await expect(out(page, 'population')).toHaveAttribute('data-value', popText(name, a));
    const [x, y] = pointText(name, a);
    await expect(out(page, 'point')).toHaveAttribute('data-x', x);
    await expect(out(page, 'point')).toHaveAttribute('data-y', y);
  }
  // G2: every population is integral (det C = 1).
  expect((await out(page, 'population').getAttribute('data-value'))!).not.toContain('/');
});

test('fractions on A2 at (1,0)', async ({ page }) => {
  await open(page, 'g=A2&c=n&s=1,0');
  const expected = popText('A2', [1, 0]);
  expect(expected).toContain('/');
  await expect(out(page, 'population')).toHaveAttribute('data-value', expected);
  // Stacked fractions on screen (Frac.svelte), the exact text in data-value.
  await expect(out(page, 'population').locator('[data-frac]')).toHaveCount(2);
  await expect(out(page, 'orbitPoint')).toHaveCount(0);
  await control(page, 'overlay-orbit').check();
  await expect(out(page, 'orbitPoint')).toHaveCount(orbit(B('A2'), [[1, 0]], 'firing', CAPS.mainThreadItems).items.length);
  await expect(out(page, 'orbitPoint')).toHaveCount(3);
});

test('keyboard placement', async ({ page }) => {
  await open(page);
  // Tab to the plane (one tab stop with an accessible name).
  let found = false;
  for (let k = 0; k < 40 && !found; k++) {
    await page.keyboard.press('Tab');
    found = await page.evaluate(() => document.activeElement?.getAttribute('data-control') === 'plane');
  }
  expect(found).toBe(true);
  await expect(control(page, 'plane')).toHaveAttribute('aria-label', /Kaleidoscope on A2/);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  expect(await values(page)).toEqual(['2', '0']);
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await expect.poll(() => page.evaluate(() => location.search), { timeout: 3000 }).toContain('s=2,0');
  await expect(live(page)).toHaveText('Point placed at numbers 2, 0.');
  const keyed = await out(page, 'point').getAttribute('data-x');

  // The same with the four buttons.
  await open(page);
  await control(page, 'a1-plus').click();
  await control(page, 'a2-minus').click();
  expect(await values(page)).toEqual(['2', '0']);
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await expect(out(page, 'point')).toHaveAttribute('data-x', keyed!);
  await control(page, 'a1-minus').click();
  await control(page, 'a2-plus').click();
  expect(await values(page)).toEqual(['1', '1']);
  // Placement after a move sets the start and empties the moves.
  await node(page, 2).click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await control(page, 'a1-plus').click();
  await expect(root(page)).toHaveAttribute('data-moves', '0');
});

test('the drag snaps to the lattice', async ({ page }) => {
  await open(page);
  const box = (await out(page, 'point').locator('circle').first().boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 23, cy + 31, { steps: 5 });
  await page.mouse.move(cx + 47, cy + 61, { steps: 5 });
  await page.mouse.up();
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await expect.poll(async () => (await values(page)).join(',')).not.toBe('1,1');
  const v = await values(page);
  for (const x of v) expect(x).toMatch(/^-?\d+$/);
  const a = v.map(Number);
  const [x, y] = pointText('A2', a);
  await expect(out(page, 'point')).toHaveAttribute('data-x', x);
  await expect(out(page, 'point')).toHaveAttribute('data-y', y);
  await expect(live(page)).toHaveText(`Point placed at numbers ${a.map((n) => (n < 0 ? `minus ${-n}` : String(n))).join(', ')}.`);
});

test('reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await node(page, 2).click();
  const a = fired('A2', [1, 1], 2);
  const [x, y] = pointText('A2', a);
  await expect(out(page, 'point')).toHaveAttribute('data-x', x);
  await expect(out(page, 'point')).toHaveAttribute('data-y', y);
  expect(await out(page, 'point').evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
  // Nothing moves by itself on load.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page);
  expect(await out(page, 'point').evaluate((el) => getComputedStyle(el).transitionDuration)).not.toBe('0s');
});

test('the picker resets start and moves; a board not offered is refused', async ({ page }) => {
  await open(page, 'g=A2&c=n&s=2,1');
  await node(page, 1).click();
  await node(page, 2).click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await expect(control(page, 'picker').locator('option')).toHaveCount(4);
  await control(page, 'picker').selectOption('G2');
  expect(await values(page)).toEqual(['1', '1']);
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await expect(out(page, 'boardName')).toHaveAttribute('data-name', 'G2');
  await control(page, 'picker').selectOption('C2');
  await expect(out(page, 'boardName')).toHaveAttribute('data-name', 'C2');
  await expect(out(page, 'population')).toHaveAttribute('data-value', popText('C2', [1, 1]));

  await open(page, 'g=A3');
  await expect(out(page, 'notice')).toHaveText(NOTICE);
  expect(await values(page)).toEqual(['1', '1']);
  await expect(out(page, 'boardName')).toHaveAttribute('data-name', 'A2');
});

test('overlays', async ({ page }) => {
  await open(page);
  await expect(out(page, 'root')).toHaveCount(0);
  await control(page, 'overlay-roots').check();
  await expect(out(page, 'root')).toHaveCount(golden.types.A2!.n_roots);
  await expect(live(page)).toHaveText('All roots shown.');
  await control(page, 'picker').selectOption('G2');
  await expect(out(page, 'root')).toHaveCount(golden.types.G2!.n_roots);
  await control(page, 'overlay-lattices').check();
  const dots = await root(page).evaluate((el) =>
    [...el.querySelectorAll('[data-out="latticeDot"]')].map((d) => ({ l: d.getAttribute('data-lattice'), k: `${d.getAttribute('data-x')},${d.getAttribute('data-y')}` })),
  );
  const rootKeys = new Set(dots.filter((d) => d.l === 'root').map((d) => d.k));
  const weight = dots.filter((d) => d.l === 'weight');
  expect(weight.length).toBeGreaterThan(0);
  for (const d of weight) expect(rootKeys.has(d.k)).toBe(true);
  // On A2 the weight lattice is finer than the root lattice.
  await control(page, 'picker').selectOption('A2');
  const counts = await root(page).evaluate((el) => ({
    root: el.querySelectorAll('[data-out="latticeDot"][data-lattice="root"]').length,
    weight: el.querySelectorAll('[data-out="latticeDot"][data-lattice="weight"]').length,
  }));
  expect(counts.weight).toBeGreaterThan(counts.root);
  await control(page, 'overlay-roots').uncheck();
  await expect(out(page, 'root')).toHaveCount(0);
});

test('hooks, no JavaScript, 320 pixels, axe', async ({ page, browser, baseURL }) => {
  await open(page);
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  for (const b of await nodes(page).all()) {
    await expect(b).toHaveAttribute('data-node', /^[12]$/);
    await expect(b).toHaveAttribute('data-board', 'numbers');
    await expect(b).toHaveAttribute('data-value', /^-?\d+$/);
    await expect(b).toHaveAttribute('data-can-act', 'true');
  }
  await expect(node(page, 1)).toHaveAttribute('aria-label', 'Node 1, value 1, can be fired');
  const axe = await new AxeBuilder({ page }).include('[data-tool="mirror"]').analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);

  // 320 pixels: no sideways scroll; node and placement buttons at least 24 by 24.
  await page.setViewportSize({ width: 320, height: 800 });
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  for (const b of [...(await nodes(page).all()), ...['a1-minus', 'a1-plus', 'a2-minus', 'a2-plus'].map((c) => control(page, c))]) {
    const r = (await b.boundingBox())!;
    expect(r.width).toBeGreaterThanOrEqual(24);
    expect(r.height).toBeGreaterThanOrEqual(24);
  }

  // No JavaScript: the static figure, the values, the caption, the bridge sentence and the table.
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const nojs = await context.newPage();
  await nojs.goto(ROUTE);
  await expect(root(nojs).locator('svg[data-control="plane"]')).toHaveCount(1);
  await expect(out(nojs, 'mirror').and(nojs.locator('[data-simple]'))).toHaveCount(2);
  await expect(out(nojs, 'simpleRoot')).toHaveCount(2);
  await expect(out(nojs, 'chamber')).toHaveCount(golden.types.A2!.n_roots);
  await expect(root(nojs).locator('[data-out="chamber"][data-dominant="true"]')).toHaveCount(1);
  await expect(out(nojs, 'point')).toHaveCount(1);
  expect(await values(nojs)).toEqual(['1', '1']);
  await expect(out(nojs, 'population')).toHaveAttribute('data-value', popText('A2', [1, 1]));
  await expect(out(nojs, 'caption')).toContainText('reflects the point');
  await expect(out(nojs, 'bridge')).toHaveText(BRIDGE);
  await expect(root(nojs).locator('details table')).toHaveCount(1);
  for (const el of await root(nojs).locator('button, select, input').all()) await expect(el).toBeDisabled();
  await context.close();
});

test('a link restores board and moves', async ({ page }) => {
  await open(page, 'g=B2&c=n&s=1,1');
  for (const l of [1, 2, 1]) await node(page, l).click();
  await expect(root(page)).toHaveAttribute('data-moves', '3');
  const v = await values(page);
  await expect.poll(() => page.evaluate(() => location.search), { timeout: 3000 }).toContain('w=1.2.1');
  await page.reload();
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
  await expect(out(page, 'boardName')).toHaveAttribute('data-name', 'B2');
  await expect(root(page)).toHaveAttribute('data-moves', '3');
  expect(await values(page)).toEqual(v);
  // A populations link places the point at a = Cp.
  await open(page, 'g=B2&c=p&s=1,1');
  expect(await values(page)).toEqual(toNumbers(B('B2'), [1, 1]).map(String));
  await expect(out(page, 'population')).toHaveAttribute('data-value', '1,1');
});

test('history: undo, redo, reset, scrub, slider', async ({ page }) => {
  await open(page);
  for (const l of [1, 2, 1]) await node(page, l).click();
  const third = await values(page);
  await control(page, 'undo').click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await control(page, 'redo').click();
  await expect(root(page)).toHaveAttribute('data-moves', '3');
  expect(await values(page)).toEqual(third);
  // Scrub to the position after move 1 and act from there: the later moves are discarded.
  await root(page).locator('[data-step="1"]').click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await node(page, 1).click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await expect(root(page).locator('[data-step]')).toHaveCount(3);
  // Reset returns to the current start (the last placement).
  await control(page, 'reset').click();
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  expect(await values(page)).toEqual(['1', '1']);
  // More than 50 positions: a slider with a counter.
  for (let k = 0; k < 51; k++) await node(page, (k % 2) + 1).click();
  await expect(root(page)).toHaveAttribute('data-moves', '51');
  await expect(control(page, 'historySlider')).toHaveCount(1);
  await expect(out(page, 'historyCounter')).toHaveText('51 of 51');
});

test('copy link, download data, SVG and PNG', async ({ page, browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await context.newPage();
  await open(p, 'g=B2&c=n&s=1,1');
  await node(p, 1).click();
  await node(p, 2).click();
  const v = await values(p);
  await control(p, 'copyLink').click();
  await expect(live(p)).toHaveText('Link copied.');
  const link = await p.evaluate(() => navigator.clipboard.readText());
  expect(link).toContain('g=B2');
  await p.goto(link);
  await expect(root(p)).toHaveAttribute('data-hydrated', 'true');
  await expect(root(p)).toHaveAttribute('data-moves', '2');
  expect(await values(p)).toEqual(v);

  await control(p, 'overlay-roots').check();
  const [download] = await Promise.all([p.waitForEvent('download'), control(p, 'downloadData').click()]);
  const doc = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(doc.tool).toBe('mirror');
  expect(doc.state).toEqual({ schema: 1, tool: 'mirror', board: 'B2', coords: 'numbers', start: [1, 1], moves: [1, 2] });
  expect(doc.derived.position).toEqual(v.map(Number));
  expect(doc.derived.population.join(',')).toBe(await out(p, 'population').getAttribute('data-value'));
  expect(doc.derived.cartan).toEqual(B('B2').cartan.map((r) => [...r]));
  expect(doc.derived.history).toHaveLength(3);
  expect(doc.derived.roots).toHaveLength(golden.types.B2!.n_roots);

  const [svg] = await Promise.all([p.waitForEvent('download'), root(p).locator('[data-export="svg"]').click()]);
  const text = readFileSync((await svg.path())!, 'utf8');
  expect(text.startsWith('<svg') || text.startsWith('<?xml')).toBe(true);
  expect(text).toContain('data-out="mirror"');
  expect(text).toContain('data-out="point"');
  const [png] = await Promise.all([p.waitForEvent('download'), root(p).locator('[data-export="png"]').click()]);
  const bytes = readFileSync((await png.path())!);
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  await context.close();
});

test('show as table fires a node, and the text alternative follows the state', async ({ page }) => {
  await open(page);
  await root(page).locator('summary').click();
  await expect(root(page).locator('[data-table-node]')).toHaveCount(2);
  await expect(root(page).locator('[data-row="equation"]')).toHaveCount(1);
  await root(page).locator('[data-table-node="1"]').click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  const a = fired('A2', [1, 1], 1);
  expect(await values(page)).toEqual(a.map(String));
  await expect(root(page).locator('[data-row="1"] [data-table-value="number"]')).toHaveText(String(a[0]).replace('-', '−'));
  await expect(root(page).locator('[data-row="2"] [data-table-value="number"]')).toHaveText(String(a[1]));
  const pop = popText('A2', a).split(',');
  await expect(root(page).locator('[data-row="1"] [data-table-value="population"]')).toHaveText(pop[0]!.replace('-', '−'));
  const alt = (await control(page, 'plane').getAttribute('aria-label'))!;
  expect(alt).toContain('A2');
  expect(alt).toContain(`Numbers minus ${-a[0]!}, ${a[1]}`);
  expect(alt).toContain(`Population ${pop.map((x) => x.replace('-', 'minus ')).join(', ')}`);
});

test('a 40-digit link: shortened, off view, no crash', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const d40 = `1${'2'.repeat(38)}7`;
  expect(d40).toHaveLength(40);
  await open(page, `g=A2&c=n&s=${d40},1`);
  await expect(node(page, 1)).toHaveAttribute('data-value', d40);
  await expect(root(page).locator('[data-numeral="1"]')).toContainText('(40 digits)');
  await expect(node(page, 1)).toHaveAttribute('title', d40);
  await expect(out(page, 'numbers')).toContainText('(40 digits)');
  await root(page).locator('summary').click();
  await expect(root(page).locator('[data-row="1"] [data-table-value="number"]')).toHaveText(d40);
  await expect(out(page, 'offView')).toHaveCount(1);
  await expect(out(page, 'point')).toHaveCount(0);
  await node(page, 1).click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  // Firing node 1 by hand with bigint and the board's C: a_j - C_j1 a_1.
  const Cb = B('A2').cartan.map((row) => row.map(BigInt));
  const start = [BigInt(d40), 1n];
  const a = start.map((x, j) => (j === 0 ? -x : x - Cb[j]![0]! * start[0]!));
  await expect(node(page, 1)).toHaveAttribute('data-value', String(a[0]));
  await expect(node(page, 2)).toHaveAttribute('data-value', String(a[1]));
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------------------------
// Regressions
// ---------------------------------------------------------------------------------------------

test.describe('regressions', () => {
  // regression: P3-RT-04-02
  test('export of the default state: integer rule, engine version, commit, state agrees with Copy link', async ({ page }) => {
    await openForExport(page, 'tools/mirror/');
    const { raw, doc } = await downloadData(page);
    expect(typeof doc.engineVersion).toBe('string');
    expect(doc.commit).toMatch(/^[0-9a-f]{7,40}$/);
    expect(unsafeNumbers(raw)).toEqual([]);
    expect(safeAsStrings(doc.derived, 'derived')).toEqual([]);
    expect(Object.keys(doc.derived ?? {}).length).toBeGreaterThan(0);
    const q = await copiedLink(page);
    if (doc.state.board !== undefined && typeof doc.state.board === 'string' && q.has('g')) expect(q.get('g')).toBe(doc.state.board);
    if (doc.state.moves !== undefined && q.has('w')) expect(q.get('w')).toBe(doc.state.moves.join('.'));
    if (doc.state.start !== undefined && q.has('s')) expect(q.get('s')).toBe(doc.state.start.join(','));
  });

  // regression: P3-RT-04-02
  test('default point a = (1,1) on A2: population (1,1) exported as numbers', async ({ page }) => {
    await openForExport(page, 'tools/mirror/');
    const { doc } = await downloadData(page);
    expect(doc.derived.population).toEqual([1, 1]);
  });

  // Adopted from the RT-05 phase 4 reproducer (SPEC 7.5 target WCAG 2.2 AA; 2.5.3 Label in Name): the four
  // placement buttons showed "a1 − 1" and so on but were named "Move the point: number at node 1 minus 1", so
  // a speech-input user who says what a button shows reached nothing. The reproducer's T10 case belongs to
  // the T10 fixer of the round. Reads data-tool, data-hydrated, data-control and the aria-label.
  // regression: P4-RT-05-07
  test('every labelled control of tools/mirror/ has its visible text in its name (WCAG 2.5.3)', async ({ page }) => {
    await page.goto('tools/mirror/');
    await page.locator('[data-tool="mirror"][data-hydrated="true"]').waitFor();
    await page.waitForTimeout(500);
    const rows = await page.evaluate((t) => {
      const norm = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase();
      return [...document.querySelectorAll(`[data-tool="${t}"] button[aria-label][data-control]`)].map((b) => ({
        control: (b as HTMLElement).dataset.control!,
        visible: norm((b as HTMLElement).innerText),
        name: norm(b.getAttribute('aria-label')!),
      }));
    }, 'mirror');
    expect(rows.length, 'controls with an aria-label found').toBeGreaterThan(0);
    const bad = rows.filter((r) => r.visible !== '' && !r.name.includes(r.visible)).map((r) => `${r.control}: shows "${r.visible}", named "${r.name}"`);
    expect(bad, 'tools/mirror/: accessible names that do not contain the visible label').toEqual([]);
  });
});
