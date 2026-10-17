// P3-A6: tool T8, the Weyl Explorer, against the built site (SPEC.md 4 T8, 4.0, 2.6, 2.7 F5, F12, 6.6,
// 7.4, 7.5). Cases open /tools/weyl/ (the `default` preset, A3) and use its board, its picker and bare
// query parameters (6.6: every state is a link). Tests read only the hooks of 4.0 and the live region
// (and, where a criterion is about the address bar, a download or a timing, those). Golden values are
// read from reference/golden_data.json and engine values computed here in Node; none is typed.
//
// Hooks read:
//   root:     data-tool="weyl", data-moves, data-hydrated="true"
//   buttons:  data-node, data-board ("numbers"), data-value, data-can-act (Board.svelte)
//   graph:    data-graph-box (the scrolling box of the graph)
//   table:    data-table="layers" | "vertices" | "heap", data-table-node, data-table-count
//   strip:    data-step (History.svelte)
//   live:     [data-live] (ToolFrame's polite live region)
//   site bar: data-theme-switch (the theme switch; the canvas regression reads the canvas pixels)
// data-out names (every one T8 renders; the registry's `outs`):
//   layerSizes (children data-layer, data-count), vertex (data-position, data-layer, data-on-path; SVG
//   mode, at most 192 elements), edge (data-from, data-to, data-label, data-on-path; inside the SVG,
//   and above 192 elements inside the snapshot that mirrors the canvas), vertexDetails (data-layer,
//   data-pointed), vertexPosition (data-position), vertexWord (data-word), separatingRoots (children
//   data-root), gameCount, pathCount, brick (data-node, data-level, data-move), heapCount, edgeMode,
//   snapshot, canvas (data-hit, data-col, data-row, data-scale; above 192 elements after hydration),
//   linkStatus (only with linkTo), limit (only when a search is cut off), groupOrder; and the shared
//   caption, notice, noscript, exportNotice (ToolFrame), moveCounter, historyStrip, historyCounter
//   (History), predictResult, predictReveal (Predict).
// data-control names: step, playToEnd, picker, loadPlay (data-play), panel, graphFocus (above 192
//   elements: the one focusable button that walks the canvas), jumpRow (data-position; a table row's
//   jump), undo, redo, reset, historySlider (History), copyLink, downloadData (ToolFrame),
//   predictAnswer, predictCheck, predictShow (Predict). data-export="svg" | "png" (ToolFrame).
//
// Properties of T8 beyond the common ones of 4.0 Configuration (id, board, coords, start, moves,
// linkTo, prediction, preset, caption, layers):
//   boardChoices: string[]   the boards the picker offers (plan; the `counter` preset passes
//                            ['A2', 'A3', 'B3', 'D4'], M5 row 3). A presentation option outside the
//                            state: a reader cannot limit the picker by hand (reported as a deviation
//                            from the 4.0 rule "A preset fixes only things the reader could have set by
//                            hand"), and it is never written in a link.
//   plays: number[][]        plays (labels) offered as buttons that load them with pushState (plan;
//                            the `heap` preset passes [[1, 3, 2], [3, 1, 2]], M5 row 4)
//   panel: 'graph' | 'counter' | 'heap'   the panel shown first (plan; the reader can change it)
// `layers` is accepted and ignored (every board T8 offers is finite); `coords` must be numbers and
// `start` all ones when given (the graph is the one from all ones).
//
// Not here, and why: the `counter` and `heap` placements and a page placing a Game Board with a T8
// linked to it do not exist on the integration branch (lesson M5 comes in stage 3.3), so the counter
// is exercised through the picker of /tools/weyl, the heap through plays fired on the board, the
// loadPlay buttons and the link in T08.test.ts (server render; "a linked T1's state drives the path"),
// and the F4 snapshot without JavaScript in T08.test.ts (server render), there being no F4 route.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { boardFromName, fire, toPositions } from '../../../packages/engine/src/index';
import type { Board } from '../../../packages/engine/src/index';
import { announceTemplates, nodeName, speak } from '../../src/lib/a11y';
import { buildGraph, inLabelOrder, pathOfMoves, vertexDetails } from '../../src/components/tools/t08/graph';

const ROUTE = 'tools/weyl/';
const NOTICE = 'The link could not be read, so the tool shows its default state.';

interface GoldenType {
  weyl_order: number;
  length_distribution: number[];
  n_reduced_words_w0: number;
}
const golden = JSON.parse(readFileSync(new URL('../../../reference/golden_data.json', import.meta.url), 'utf8')) as {
  types: Record<string, GoldenType>;
};

const root = (page: Page): Locator => page.locator('[data-tool="weyl"]');
const node = (page: Page, label: number): Locator => root(page).locator(`button[data-board="numbers"][data-node="${label}"]`);
const nodes = (page: Page): Locator => root(page).locator('button[data-board="numbers"][data-node]');
const out = (page: Page, name: string): Locator => root(page).locator(`[data-out="${name}"]`);
const control = (page: Page, name: string): Locator => root(page).locator(`[data-control="${name}"]`);
const live = (page: Page): Locator => root(page).locator('[data-live]');
const vertices = (page: Page): Locator => out(page, 'vertex');
const pathVertices = (page: Page): Locator => root(page).locator('[data-out="vertex"][data-on-path="true"]');

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`${ROUTE}${query ? `?${query}` : ''}`);
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
}

/** The board's numbers in label order, as the hooks carry them. */
async function values(page: Page): Promise<string[]> {
  const list = nodes(page);
  const n = await list.count();
  const pairs: [number, string][] = [];
  for (let k = 0; k < n; k++) {
    const b = list.nth(k);
    pairs.push([Number(await b.getAttribute('data-node')), (await b.getAttribute('data-value')) ?? '']);
  }
  return pairs.sort((x, y) => x[0] - y[0]).map((p) => p[1]);
}

/** Records every non-empty text written to the live region from now on. */
async function recordLive(page: Page): Promise<() => Promise<string[]>> {
  await root(page).evaluate((el) => {
    const region = el.querySelector('[data-live]')!;
    const w = window as unknown as { __live: string[] };
    w.__live = [];
    new MutationObserver(() => {
      const t = region.textContent ?? '';
      if (t !== '') w.__live.push(t);
    }).observe(region, { childList: true, characterData: true, subtree: true });
  });
  return () => page.evaluate(() => (window as unknown as { __live: string[] }).__live);
}

async function pick(page: Page, name: string): Promise<void> {
  await control(page, 'picker').selectOption(name);
  await expect(out(page, 'groupOrder')).toHaveText(String(golden.types[name]!.weyl_order));
}

async function pathPositions(page: Page): Promise<string[]> {
  const list = pathVertices(page);
  const n = await list.count();
  const outList: string[] = [];
  for (let k = 0; k < n; k++) outList.push((await list.nth(k).getAttribute('data-position')) ?? '');
  return outList.sort();
}

async function lowestCanAct(page: Page): Promise<number> {
  const list = root(page).locator('button[data-board="numbers"][data-can-act="true"]');
  const n = await list.count();
  const labels: number[] = [];
  for (let k = 0; k < n; k++) labels.push(Number(await list.nth(k).getAttribute('data-node')));
  return Math.min(...labels);
}

const A3 = boardFromName('A3') as Board<number>;
const onesA3 = [1, 1, 1];

// ---------------------------------------------------------------------------------------------
// The named examples (SPEC 4 T8; SPEC 3 M5 rows 1 to 4)
// ---------------------------------------------------------------------------------------------

test('A3 graph: 24 vertices in 7 layers, the game is a path', async ({ page }) => {
  await open(page);
  const t = golden.types.A3!;
  await expect(vertices(page)).toHaveCount(t.weyl_order);
  const sizes = out(page, 'layerSizes').locator('[data-layer]');
  await expect(sizes).toHaveCount(t.length_distribution.length);
  for (let k = 0; k < t.length_distribution.length; k++) await expect(sizes.nth(k)).toHaveAttribute('data-count', String(t.length_distribution[k]));
  await expect(out(page, 'edge')).toHaveCount((t.weyl_order * 3) / 2);
  await expect(pathVertices(page)).toHaveCount(1);
  const seen = [(await values(page)).join(',')];
  for (const l of [1, 3, 2]) {
    await node(page, l).click();
    seen.push((await values(page)).join(','));
  }
  await expect(root(page)).toHaveAttribute('data-moves', '3');
  await expect(pathVertices(page)).toHaveCount(4);
  expect(await pathPositions(page)).toEqual([...seen].sort());
  await expect(root(page).locator('[data-out="edge"][data-on-path="true"]')).toHaveCount(3);
  // Play to the end reaches the bottom vertex, with one announcement for the whole play.
  const read = await recordLive(page);
  await control(page, 'playToEnd').click();
  const bottom = String(t.length_distribution.length - 1);
  await expect(root(page)).toHaveAttribute('data-moves', bottom);
  await expect(root(page).locator(`[data-out="vertex"][data-layer="${bottom}"]`)).toHaveAttribute('data-on-path', 'true');
  await expect(pathVertices(page)).toHaveCount(t.length_distribution.length);
  await page.waitForTimeout(900);
  const said = (await read()).filter((s) => s.startsWith('Played'));
  expect(said).toHaveLength(1);
  const end = (await values(page)).map((v) => speak(v));
  expect(said[0]).toBe(announceTemplates.playedToEnd(Number(bottom) - 3, end));
});

test('hovering a vertex shows the word and separating mirrors', async ({ page }) => {
  await open(page);
  const model = buildGraph(A3, undefined, 'A3');
  const k = pathOfMoves(model, [1, 3, 2])[3]!;
  const want = vertexDetails(model, k);
  const text = want.position.join(',');
  const check = async (): Promise<void> => {
    await expect(out(page, 'vertexPosition')).toHaveAttribute('data-position', text);
    await expect(out(page, 'vertexWord')).toHaveAttribute('data-word', want.word.join(','));
    const roots = out(page, 'separatingRoots').locator('[data-root]');
    await expect(roots).toHaveCount(want.layer);
    for (let j = 0; j < want.roots.length; j++) await expect(roots.nth(j)).toHaveAttribute('data-root', want.roots[j]!.join(','));
    await expect(out(page, 'vertexDetails')).toHaveAttribute('data-layer', String(want.layer));
  };
  // Before: the details are those of the current position, the start.
  await expect(out(page, 'vertexPosition')).toHaveAttribute('data-position', onesA3.join(','));
  const target = root(page).locator(`[data-out="vertex"][data-position="${text}"]`);
  await target.hover();
  await check();
  await expect(target).toHaveAttribute('data-layer', String(want.roots.length));
  // The engine's own reading: replaying the word from all ones gives the position.
  let a = [...onesA3];
  for (const i of toPositions(A3, want.word)) a = fire(A3, a, i);
  expect(inLabelOrder(A3, a).join(',')).toBe(text);
  // Separately by keyboard: Tab-stop vertex, then the arrows to the target.
  await page.mouse.move(1, 1);
  await expect(out(page, 'vertexPosition')).toHaveAttribute('data-position', onesA3.join(','));
  await root(page).locator('[data-out="vertex"][tabindex="0"]').focus();
  for (let s = 0; s < 3; s++) await page.keyboard.press('ArrowDown');
  for (let s = 0; s < 8; s++) await page.keyboard.press('ArrowLeft');
  for (let s = 0; s < 8; s++) {
    const at = await page.evaluate(() => document.activeElement?.getAttribute('data-position'));
    if (at === text) break;
    await page.keyboard.press('ArrowRight');
  }
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-position'))).toBe(text);
  await check();
});

test('counter on A2, A3, B3, D4', async ({ page }) => {
  await open(page);
  for (const name of ['A2', 'A3', 'B3', 'D4']) {
    await pick(page, name);
    await expect(out(page, 'gameCount')).toHaveText(String(golden.types[name]!.n_reduced_words_w0));
    await expect(out(page, 'pathCount')).toHaveText(String(golden.types[name]!.n_reduced_words_w0));
    await expect(root(page)).toHaveAttribute('data-moves', '0');
  }
  // D4: exactly 192 elements, every edge drawn (the boundary is strict).
  await expect(out(page, 'edgeMode')).toHaveText('all');
  await expect(vertices(page)).toHaveCount(192);
  await expect(out(page, 'edge')).toHaveCount(384);
});

test('heap view: 1,3,2 and 3,1,2 give the same stack', async ({ page }) => {
  await open(page);
  const bricks = async (): Promise<string[]> => {
    const list = out(page, 'brick');
    const n = await list.count();
    const res: string[] = [];
    for (let k = 0; k < n; k++) res.push(`${await list.nth(k).getAttribute('data-node')}:${await list.nth(k).getAttribute('data-level')}`);
    return res.sort();
  };
  await expect(out(page, 'heapCount')).toHaveText('1');
  for (const l of [1, 3, 2]) await node(page, l).click();
  await expect(out(page, 'brick')).toHaveCount(3);
  const first = await bricks();
  await expect(out(page, 'heapCount')).toHaveText('2');
  await control(page, 'reset').click();
  await expect(out(page, 'brick')).toHaveCount(0);
  for (const l of [3, 1, 2]) await node(page, l).click();
  await expect(out(page, 'brick')).toHaveCount(3);
  expect(await bricks()).toEqual(first);
  await expect(out(page, 'heapCount')).toHaveText('2');
  // A play with joined neighbours (1, 2) stacks its second brick on the first.
  await control(page, 'reset').click();
  for (const l of [1, 2]) await node(page, l).click();
  expect(await bricks()).toEqual(['1:1', '2:2']);
});

test('picking F4 draws 1152 elements without a long task and without the worker', async ({ page, context }) => {
  const requested: string[] = [];
  await context.route(/engine\.worker/, async (r) => {
    requested.push(r.request().url());
    await r.abort();
  });
  page.on('worker', (w) => requested.push(w.url()));
  await open(page);
  await page.evaluate(() => {
    const w = window as unknown as { __long: number[] };
    w.__long = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__long.push(e.duration);
    }).observe({ type: 'longtask', buffered: false });
  });
  await control(page, 'picker').selectOption('F4');
  await expect(out(page, 'groupOrder')).toHaveText(String(golden.types.F4!.weyl_order));
  await expect(out(page, 'edgeMode')).toHaveText('game-and-focus');
  await expect(out(page, 'canvas')).toHaveAttribute('data-scale', /.+/);
  await expect(out(page, 'snapshot')).toHaveCount(1);
  await expect(out(page, 'gameCount')).toHaveText(String(golden.types.F4!.n_reduced_words_w0));
  await page.waitForTimeout(500);
  const long = await page.evaluate(() => (window as unknown as { __long: number[] }).__long);
  test.info().annotations.push({ type: 'f4-longest-task-ms', description: long.length === 0 ? 'none over 50' : String(Math.max(...long)) });
  expect(long).toEqual([]);
  // Edges only along the game and at the focus: none at the start, then one per move of a play.
  await expect(out(page, 'edge')).toHaveCount(0);
  await control(page, 'playToEnd').click();
  const moves = golden.types.F4!.length_distribution.length - 1;
  await expect(root(page)).toHaveAttribute('data-moves', String(moves));
  await expect(root(page).locator('[data-out="edge"][data-on-path="true"]')).toHaveCount(moves);
  expect(requested).toEqual([]);
});

test('hooks, no JavaScript, 320 pixels, keyboard', async ({ page, browser }) => {
  await open(page);
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  const n = await nodes(page).count();
  expect(n).toBe(3);
  for (let k = 0; k < n; k++) {
    const b = nodes(page).nth(k);
    for (const attr of ['data-node', 'data-board', 'data-value', 'data-can-act']) expect(await b.getAttribute(attr)).not.toBeNull();
  }
  // Without JavaScript: the graph SVG, the caption, the counter and the table are present, every control disabled.
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 800 } });
  const off = await ctx.newPage();
  await off.goto(ROUTE);
  const r = off.locator('[data-tool="weyl"]');
  await expect(r.locator('svg.weyl-svg[role="img"]')).toHaveCount(1);
  await expect(r.locator('[data-out="vertex"]')).toHaveCount(golden.types.A3!.weyl_order);
  await expect(r.locator('[data-out="caption"]')).toContainText(String(golden.types.A3!.weyl_order));
  await expect(r.locator('[data-out="gameCount"]')).toHaveText(String(golden.types.A3!.n_reduced_words_w0));
  await expect(r.locator('table[data-table="vertices"] tbody tr')).toHaveCount(golden.types.A3!.weyl_order);
  const enabled = await r.locator('button[data-control]:not([disabled]), select[data-control]:not([disabled])').evaluateAll((els) =>
    els.filter((e) => !(e as HTMLButtonElement).matches(':disabled')).length,
  );
  expect(enabled).toBe(0);
  expect(await r.locator('button[data-control], select[data-control]').count()).toBeGreaterThan(5);
  await ctx.close();
  // 320 pixels: the page never scrolls sideways; the A5 graph box does.
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  // Keyboard: Tab reaches the graph and the arrows visit every vertex of A3.
  await page.locator('body').focus();
  let reached = false;
  for (let s = 0; s < 80 && !reached; s++) {
    await page.keyboard.press('Tab');
    reached = (await page.evaluate(() => document.activeElement?.getAttribute('data-out'))) === 'vertex';
  }
  expect(reached).toBe(true);
  const visited = new Set<string>();
  const here = async (): Promise<string> => (await page.evaluate(() => document.activeElement?.getAttribute('data-position'))) ?? '';
  await page.keyboard.press('Home');
  for (let layer = 0; layer < golden.types.A3!.length_distribution.length; layer++) {
    for (let s = 0; s < 8; s++) await page.keyboard.press('ArrowLeft');
    let last = '';
    for (let s = 0; s < 8; s++) {
      const at = await here();
      visited.add(at);
      if (at === last) break;
      last = at;
      await page.keyboard.press('ArrowRight');
    }
    await page.keyboard.press('ArrowDown');
  }
  expect(visited.size).toBe(golden.types.A3!.weyl_order);
  await pick(page, 'A5');
  const box = root(page).locator('[data-graph-box]');
  expect(await box.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('a link restores board and moves; a refused board shows the notice', async ({ page }) => {
  await open(page);
  await pick(page, 'B3');
  await control(page, 'step').click();
  await control(page, 'step').click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await page.waitForTimeout(800);
  expect(page.url()).toContain('g=B3');
  await page.reload();
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
  await expect(control(page, 'picker')).toHaveValue('B3');
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await expect(pathVertices(page)).toHaveCount(3);
  for (const q of ['g=E6', 'g=D5', 'g=A3&c=n&s=1,0,1']) {
    await open(page, q);
    await expect(out(page, 'notice')).toHaveText(NOTICE);
    await expect(control(page, 'picker')).toHaveValue('A3');
    await expect(vertices(page)).toHaveCount(golden.types.A3!.weyl_order);
  }
});

test('undo, redo, reset, history, step, export and table', async ({ page }) => {
  await open(page);
  for (let s = 1; s <= 3; s++) {
    const before = await values(page);
    const l = await lowestCanAct(page);
    await control(page, 'step').click();
    await expect(root(page)).toHaveAttribute('data-moves', String(s));
    await expect(pathVertices(page)).toHaveCount(s + 1);
    const after = await values(page);
    expect(after[l - 1]).toBe(String(-Number(before[l - 1])));
  }
  await control(page, 'undo').click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await expect(pathVertices(page)).toHaveCount(3);
  await control(page, 'redo').click();
  await expect(root(page)).toHaveAttribute('data-moves', '3');
  await control(page, 'reset').click();
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await expect(pathVertices(page)).toHaveCount(1);
  for (const l of [1, 3, 2]) await node(page, l).click();
  await root(page).locator('[data-step="1"]').click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await node(page, await lowestCanAct(page)).click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await expect(root(page).locator('[data-step]')).toHaveCount(3);
  // Download data: the state and the derived tables.
  const [download] = await Promise.all([page.waitForEvent('download'), control(page, 'downloadData').click()]);
  const doc = JSON.parse(readFileSync((await download.path())!, 'utf8')) as {
    tool: string;
    state: { board: string; moves: number[] };
    derived: { layerSizes: number[]; path: { word: number[]; positions: number[][] }; gameCount: number; heap: { node: number; level: number }[]; heapCount: number };
  };
  expect(doc.tool).toBe('weyl');
  expect(doc.state.board).toBe('A3');
  expect(doc.state.moves).toHaveLength(2);
  expect(doc.derived.layerSizes).toEqual(golden.types.A3!.length_distribution);
  expect(doc.derived.path.word).toEqual(doc.state.moves);
  expect(doc.derived.path.positions).toHaveLength(3);
  expect(doc.derived.gameCount).toBe(golden.types.A3!.n_reduced_words_w0);
  expect(doc.derived.heap).toHaveLength(2);
  expect(typeof doc.derived.heapCount).toBe('number');
  // SVG export: the downloaded SVG holds the drawn dots.
  const [svgDownload] = await Promise.all([page.waitForEvent('download'), root(page).locator('[data-export="svg"]').click()]);
  const svgText = readFileSync((await svgDownload.path())!, 'utf8');
  expect((svgText.match(/<circle /g) ?? []).length).toBeGreaterThanOrEqual(golden.types.A3!.weyl_order);
  // Show as table: one row per vertex, the layer sizes, a button per node, and a jump per row.
  await root(page).locator('summary', { hasText: 'Show as table' }).click();
  const rows = root(page).locator('table[data-table="vertices"] tbody tr');
  await expect(rows).toHaveCount(golden.types.A3!.weyl_order);
  const counts = root(page).locator('table[data-table="layers"] [data-table-count]');
  await expect(counts).toHaveCount(golden.types.A3!.length_distribution.length);
  for (let k = 0; k < golden.types.A3!.length_distribution.length; k++) await expect(counts.nth(k)).toHaveText(String(golden.types.A3!.length_distribution[k]));
  await expect(root(page).locator('[data-table-node]')).toHaveCount(3);
  const row = rows.nth(10);
  const layer = await row.getAttribute('data-layer');
  await row.locator('[data-control="jumpRow"]').click();
  await expect(root(page)).toHaveAttribute('data-moves', layer!);
});

test('accessibility: names, announcements, hit areas, reduced motion, text alternatives', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  // A-3
  for (const l of [1, 2, 3]) await expect(node(page, l)).toHaveAttribute('aria-label', nodeName('node', l, '1', 'can be fired'));
  // A-4: the region exists and is empty before the first move.
  await expect(live(page)).toHaveCount(1);
  await expect(live(page)).toHaveText('');
  const after = fire(A3, onesA3, 0);
  await node(page, 1).click();
  await expect(live(page)).toHaveText(announceTemplates.fired(1, inLabelOrder(A3, after).map((v) => speak(v)), 1));
  await expect(node(page, 1)).toHaveAttribute('aria-label', nodeName('node', 1, speak(after[0]!), 'cannot be fired'));
  await expect(node(page, 1)).toHaveAttribute('data-can-act', 'false');
  await page.waitForTimeout(700);
  await node(page, 1).click();
  await expect(live(page)).toHaveText(announceTemplates.cannotFire(1, speak(after[0]!)));
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  // A-9: the path changes at once, with no transition.
  await expect(pathVertices(page)).toHaveCount(2);
  const durations = await pathVertices(page).evaluateAll((els) => els.map((e) => getComputedStyle(e).transitionDuration));
  expect(durations.every((d) => d === '0s')).toBe(true);
  // A-10: the A3 graph has a text alternative.
  const svg = root(page).locator('svg.weyl-svg');
  await expect(svg).toHaveAttribute('role', 'img');
  const t3 = golden.types.A3!;
  await expect(svg).toHaveAttribute('aria-label', new RegExp(`A3.*${t3.weyl_order} positions in ${t3.length_distribution.length} layers`));
  // A-7 at 320 pixels on A3: node buttons and graph vertices, at least 24 by 24, no overlap.
  await page.setViewportSize({ width: 320, height: 800 });
  const boxesOf = async (loc: Locator): Promise<{ x: number; y: number; width: number; height: number }[]> =>
    loc.evaluateAll((els) => els.map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }));
  const noOverlap = (boxes: { x: number; y: number; width: number; height: number }[]): boolean => {
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (ox > 0.5 && oy > 0.5) return false;
      }
    }
    return true;
  };
  for (const loc of [nodes(page), vertices(page)]) {
    const boxes = await boxesOf(loc);
    expect(boxes.every((b) => b.width >= 24 && b.height >= 24)).toBe(true);
    expect(noOverlap(boxes)).toBe(true);
  }
  // A5 (canvas): the node buttons, the hit area the canvas tests against, and the focus button.
  await pick(page, 'A5');
  const nb = await boxesOf(nodes(page));
  expect(nb.every((b) => b.width >= 24 && b.height >= 24)).toBe(true);
  expect(noOverlap(nb)).toBe(true);
  const canvas = out(page, 'canvas');
  await expect(canvas).toHaveAttribute('data-scale', /.+/);
  const hit = Number(await canvas.getAttribute('data-hit'));
  expect(hit).toBeGreaterThanOrEqual(24);
  expect(Number(await canvas.getAttribute('data-col'))).toBeGreaterThanOrEqual(hit);
  expect(Number(await canvas.getAttribute('data-row'))).toBeGreaterThanOrEqual(hit);
  const fb = await boxesOf(control(page, 'graphFocus'));
  expect(fb[0]!.width).toBeGreaterThanOrEqual(24);
  // A-10 for the canvas figure.
  const t5 = golden.types.A5!;
  await expect(canvas).toHaveAttribute('role', 'img');
  await expect(canvas).toHaveAttribute('aria-label', new RegExp(`A5.*${t5.weyl_order} positions in ${t5.length_distribution.length} layers`));
  // A-1 on the canvas: the focus button walks the vertices with the arrows (focus is never in the canvas).
  await control(page, 'graphFocus').focus();
  const start = await control(page, 'graphFocus').getAttribute('data-position');
  await page.keyboard.press('ArrowDown');
  await expect(control(page, 'graphFocus')).toHaveAttribute('data-layer', '1');
  expect(await control(page, 'graphFocus').getAttribute('data-position')).not.toBe(start);
  await expect(out(page, 'vertexDetails')).toHaveAttribute('data-pointed', 'true');
  // Focus edges are drawn around the focused vertex (in and out); here it is in layer 1.
  await expect(out(page, 'edge')).toHaveCount(5);
});

test('axe finds no violation on /tools/weyl', async ({ page }) => {
  await open(page);
  const result = await new AxeBuilder({ page }).include('[data-tool="weyl"]').analyze();
  expect(result.violations.map((v) => v.id)).toEqual([]);
});

test.describe('regressions', () => {
  // Above 192 elements T8 draws on a Canvas 2D with the colour tokens read when it draws. After the
  // theme switch of the site bar (light to dark) the dots and the edge labels must be drawn again in
  // the dark theme's text colour, not left in the light theme's #1A1A1A on the dark page #121212
  // (A-6: at least 3 to 1 for graphics and 4.5 to 1 for text, in both themes; 6.3; CONTRACTS 8).
  // Adopted from the red team's reproducer (RT-05 attacks 29, 44, 10).
  // regression: P3-RT-05-03
  test('T8 canvas follows the theme switch (F4, 1152 elements)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('tools/weyl/');
    await page.locator('[data-tool][data-hydrated="true"]').waitFor();
    await page.locator('[data-control="picker"]').selectOption('F4');
    await page.locator('[data-out="canvas"][data-scale]').waitFor();
    await page.waitForTimeout(800);
    // The theme switch of the site bar, by keyboard.
    await page.locator('[data-theme-switch]').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const c = document.querySelector('[data-out="canvas"] canvas') as HTMLCanvasElement;
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let lightThemeInk = 0;
      let darkThemeInk = 0;
      const near = (i: number, v: number) => Math.abs(d[i]! - v) < 6 && Math.abs(d[i + 1]! - v) < 6 && Math.abs(d[i + 2]! - v) < 6;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3]! < 250) continue;
        if (near(i, 0x1a)) lightThemeInk++;
        if (near(i, 0xe8)) darkThemeInk++;
      }
      return { page: getComputedStyle(document.documentElement).getPropertyValue('--page').trim(), text: getComputedStyle(document.documentElement).getPropertyValue('--text').trim(), lightThemeInk, darkThemeInk };
    });
    expect(r.page, 'page colour after the switch').toBe('#121212');
    expect(r.lightThemeInk, `/tools/weyl/ F4, light to dark by the theme switch: opaque canvas pixels still in #1A1A1A (the light --text) on the ${r.page} page`).toBe(0);
    expect(r.darkThemeInk, 'opaque canvas pixels in the dark --text #E8E8E8').toBeGreaterThan(0);
  });

  // The same cause by the other route: with no choice stored, the system setting decides the theme
  // (CONTRACTS 8), and a change of it must draw the canvas again too.
  // regression: P3-RT-05-03
  test('T8 canvas follows a change of the system colour scheme (F4, 1152 elements)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await open(page);
    await pick(page, 'F4');
    await root(page).locator('[data-out="canvas"][data-scale]').waitFor();
    await page.waitForTimeout(800);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const c = document.querySelector('[data-out="canvas"] canvas') as HTMLCanvasElement;
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let lightThemeInk = 0;
      let darkThemeInk = 0;
      const near = (i: number, v: number) => Math.abs(d[i]! - v) < 6 && Math.abs(d[i + 1]! - v) < 6 && Math.abs(d[i + 2]! - v) < 6;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3]! < 250) continue;
        if (near(i, 0x1a)) lightThemeInk++;
        if (near(i, 0xe8)) darkThemeInk++;
      }
      return { page: getComputedStyle(document.documentElement).getPropertyValue('--page').trim(), lightThemeInk, darkThemeInk };
    });
    expect(r.page, 'page colour after the system change').toBe('#121212');
    expect(r.lightThemeInk, `opaque canvas pixels still in #1A1A1A (the light --text) on the ${r.page} page`).toBe(0);
    expect(r.darkThemeInk, 'opaque canvas pixels in the dark --text #E8E8E8').toBeGreaterThan(0);
  });
});
