// P5-A2: tool T12, the Representation Builder, against the built site (SPEC.md 4 T12, 2.18, 2.7 F11, 4.0,
// 5.6, 6.6, 7.4 to 7.6, E-9). Cases are opened by bare query parameters on /tools/rep/ (6.6: every state
// is a link) or through the tool's controls. Tests read only the hooks of 4.0 and the live region (and,
// where a criterion is about the address bar, the clipboard or a download, those). Expected values are
// read from reference/golden_data.json or computed here in Node from the engine; the only values typed
// are the worked values of the instruction (A2 node 1, A2 through (2, 0), D4 node 2), each checked
// against the engine or the golden file first.
//
// Hooks read:
//   root:      data-tool="rep", data-moves, data-hydrated="true"
//   buttons:   data-node, data-board ("numbers"), data-value, data-can-act (the string viewer's board)
//   panels:    data-panel ("orbit" | "matrices" | "relations" | "signed" | "string")
//   orbit:     data-drawn, data-positions on data-out="orbit-graph"; data-vertex, data-layer, data-value;
//              data-edge with data-edge-node, data-edge-from, data-edge-to, data-step; data-edge-label;
//              data-layer-count (the layer sizes above 300 positions)
//   matrices:  data-format ("grid" | "list"), data-rows, data-cols on a MatrixView root; data-row,
//              data-col, data-value on its cells (1-based)
//   relation:  data-holds on data-out="relation-verdict"; data-minuscule on data-out="minuscule"
//   string:    data-value (comma-joined), data-in-orbit, data-step on data-out="string-position";
//              data-flips on the line
//   table:     data-table ("orbit" | "board"), data-table-row, data-table-board="numbers", data-table-node
//   live:      [data-live] (ToolFrame's polite live region)
// data-out names (every one T12 renders; the registry's `outs`):
//   caption, notice, noscript, exportNotice (ToolFrame); moveCounter, historyStrip, historyCounter
//   (History.svelte); predictResult, predictReveal (Predict.svelte);
//   dimension, minuscule, explanation, no-minuscule, limit, orbit-graph, matrix-e, matrix-f, matrix-h,
//   relation-formula, relation-verdict, relation-left, relation-right, all-relations, move-matrix,
//   signed-move, string-position, string-length, string-note, start-message
// data-control names: picker, node, matrix-node, relation, relation-i, relation-j, start-entry (with
//   data-entry), set-start; undo, redo, reset, historySlider (History.svelte); copyLink, downloadData
//   (ToolFrame); data-export="svg" | "png" (ToolFrame)
//
// Properties of T12 beyond the common ones of 4.0 Configuration (id, board, coords, start, moves,
// prediction, preset, caption): node (a label, 6.6 `k`) and relation (a code with labels, 6.6 `q`).
// linkTo and layers are accepted and ignored. preset: 'default' | 'string-viewer' | 'relation-checker' |
// 'signed-move'.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boardFromName, fire, toPositions } from '../../../packages/engine/src/index';
import type { Board } from '../../../packages/engine/src/index';
import { copiedLink, downloadData, openForExport, unsafeNumbers } from './exportIntegers';

interface MinusculeRecord {
  type: string;
  node: number;
  dimension: number;
}
const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  minuscule_representations: MinusculeRecord[];
  types: Record<string, { fundamental_orbit_sizes: number[]; minuscule_nodes: number[] }>;
};

const ROUTE = 'tools/rep/';
const NOTICE = 'The link could not be read, so the tool shows its default state.';

const root = (page: Page): Locator => page.locator('[data-tool="rep"]');
const out = (page: Page, name: string): Locator => root(page).locator(`[data-out="${name}"]`);
const control = (page: Page, name: string): Locator => root(page).locator(`[data-control="${name}"]`);
const live = (page: Page): Locator => root(page).locator('[data-live]');
const nodes = (page: Page): Locator => root(page).locator('[data-panel="string"] button[data-node]');
const node = (page: Page, label: number): Locator => root(page).locator(`[data-panel="string"] button[data-node="${label}"]`);
const line = (page: Page): Locator => out(page, 'string-position');

/**
 * Waits until every piece of the figure is drawn: after a load or a pick the tool draws the panels one piece
 * per task (SPEC 7.6), each waiting piece with a line of class "waiting", and the board's table last.
 */
async function settled(page: Page): Promise<void> {
  await expect(root(page).locator('[data-table="board"]')).toBeAttached({ timeout: 20000 });
  await expect(root(page).locator('.waiting')).toHaveCount(0);
}

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`${ROUTE}${query ? `?${query}` : ''}`);
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
  await settled(page);
}

/** The values of the string viewer's board in label order (data-node increasing). */
async function valuesOf(page: Page): Promise<string[]> {
  const pairs: [number, string][] = [];
  for (const b of await nodes(page).all()) pairs.push([Number(await b.getAttribute('data-node')), (await b.getAttribute('data-value')) ?? '']);
  return pairs.sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

/** The keys of the positions listed on the string line, in order. */
const lineKeys = (page: Page): Promise<string[]> => line(page).evaluateAll((lis) => lis.map((li) => li.getAttribute('data-value') ?? ''));

/** The number of Chevalley-Serre relation instances on a board of rank n: 6n^2 - 2n (SPEC 2.18; the engine's list). */
const relationCount = (n: number): number => 6 * n * n - 2 * n;
const B = (name: string): Board<number> => boardFromName(name) as Board<number>;
/** A position given in label order, fired at a label, back in label order (E-7: toPositions only). */
function fired(name: string, values: number[], label: number): string[] {
  const board = B(name);
  const order = toPositions(board, [...board.labels].sort((a, b) => a - b));
  const v: number[] = new Array<number>(board.n);
  order.forEach((p, k) => (v[p] = values[k]!));
  const after = fire(board, v, toPositions(board, [label])[0]!);
  return order.map((p) => String(after[p]));
}

// ---------------------------------------------------------------------------------------------
// SPEC 4 T12 acceptance
// ---------------------------------------------------------------------------------------------

test('acceptance: every listed representation shows its golden dimension, is minuscule, and every relation holds', async ({ page }) => {
  test.setTimeout(240000);
  expect(golden.minuscule_representations).toHaveLength(18);
  for (const rec of golden.minuscule_representations) {
    const what = `${rec.type} node ${rec.node}`;
    await open(page, `g=${rec.type}&k=${rec.node}`);
    await expect(out(page, 'notice'), what).toHaveCount(0);
    await expect(out(page, 'dimension'), what).toHaveText(String(rec.dimension));
    await expect(out(page, 'minuscule'), what).toHaveAttribute('data-minuscule', 'true');
    // Above 27 positions the list comes from the worker (decisions/P5-A2.md); the sentence is the same.
    await expect(out(page, 'all-relations'), what).toHaveText(`All ${relationCount(B(rec.type).n)} relations hold.`, { timeout: 20000 });
    await expect(out(page, 'relation-verdict'), what).toHaveAttribute('data-holds', 'true');
    await expect(out(page, 'explanation'), what).toHaveText(`Node ${rec.node} is minuscule: every number in the orbit of ω${rec.node} is −1, 0 or 1, and all the relations hold.`);
    await expect(out(page, 'orbit-graph'), what).toHaveAttribute('data-positions', String(rec.dimension));
  }
});

test('acceptance: choosing node 2 of D4 shows a failing relation and the explanation that some number in the orbit is 2', async ({ page }) => {
  expect(golden.types.D4!.fundamental_orbit_sizes[1]).toBe(24);
  expect(golden.types.D4!.minuscule_nodes).not.toContain(2);
  await open(page, 'g=D4');
  await expect(out(page, 'dimension')).toHaveText('8');
  await control(page, 'node').selectOption('2');
  await expect(out(page, 'dimension')).toHaveText('24');
  await settled(page);
  await expect(out(page, 'minuscule')).toHaveAttribute('data-minuscule', 'false');
  await expect(out(page, 'minuscule')).toHaveText('no');
  await expect(out(page, 'explanation')).toContainText('some number in the orbit is 2');
  // The default relation of a node that is not minuscule is its first failing one (plan): ef:1,1.
  await expect(out(page, 'relation-verdict')).toHaveAttribute('data-holds', 'false');
  await expect(out(page, 'relation-verdict')).toHaveText('not equal');
  await expect(control(page, 'relation')).toHaveValue('ef');
  await expect(control(page, 'relation-i')).toHaveValue('1');
  await expect(control(page, 'relation-j')).toHaveValue('1');
  await expect(out(page, 'all-relations')).toHaveText(`10 of ${relationCount(4)} relations fail.`);
  // The edges of a number 2 are no entry of E or F: dashed, with data-step="false".
  await expect(out(page, 'orbit-graph').locator('[data-edge][data-step="false"]').first()).toBeAttached();
  await expect(live(page)).toContainText('D4, node 2: the orbit of ω2 has 24 positions. Node 2 is not minuscule: some number in the orbit is 2');
  // The link of the state names the node; the matrices are 24 by 24 grids.
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).get('k'))).toBe('2');
  await expect(out(page, 'matrix-e')).toHaveAttribute('data-format', 'grid');
  await expect(out(page, 'matrix-e')).toHaveAttribute('data-rows', '24');
});

// ---------------------------------------------------------------------------------------------
// The five parts of the tool (SPEC 4 T12 bullets)
// ---------------------------------------------------------------------------------------------

test('the orbit of ω1 on A2 is drawn in layers with edges coloured and labelled by node', async ({ page }) => {
  await open(page);
  const graph = out(page, 'orbit-graph');
  await expect(graph).toHaveAttribute('data-drawn', 'true');
  await expect(graph.locator('[data-vertex]')).toHaveCount(3);
  expect(await graph.locator('[data-vertex]').evaluateAll((vs) => vs.map((v) => [v.getAttribute('data-layer'), v.getAttribute('data-value')]))).toEqual([
    ['0', '1,0'],
    ['1', '-1,1'],
    ['2', '0,-1'],
  ]);
  const edges = graph.locator('[data-edge]');
  await expect(edges).toHaveCount(2);
  expect(await edges.evaluateAll((es) => es.map((e) => e.getAttribute('data-edge-node')).sort())).toEqual(['1', '2']);
  // Each edge has its own colour (the node's), and its label is the node's label as text (6.3, A-5).
  const colours = await edges.evaluateAll((es) => es.map((e) => getComputedStyle(e.querySelector('line')!).stroke));
  expect(new Set(colours).size).toBe(2);
  expect(await graph.locator('[data-edge-label]').allTextContents()).toEqual(expect.arrayContaining(['1', '2']));
  await expect(graph.getByRole('img')).toHaveCount(1);
});

test('above 300 positions the orbit is given as layer counts: E7 nodes 2 and 6', async ({ page }) => {
  for (const label of [2, 6]) {
    const size = golden.types.E7!.fundamental_orbit_sizes[label - 1]!;
    expect(size).toBeGreaterThan(300);
    expect(size).toBeLessThanOrEqual(2000);
    await open(page, `g=E7&k=${label}`);
    const graph = out(page, 'orbit-graph');
    await expect(graph).toHaveAttribute('data-drawn', 'false');
    await expect(graph).toContainText('more than 300');
    const counts = (await graph.locator('[data-layer-count]').evaluateAll((li) => li.map((l) => Number(l.getAttribute('data-layer-count'))))) as number[];
    expect(counts[0]).toBe(1);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(size);
    await expect(out(page, 'dimension')).toHaveText(String(size));
    await expect(out(page, 'matrix-e')).toHaveAttribute('data-format', 'list');
    await expect(out(page, 'all-relations')).toHaveText(/^\d+ of 280 relations fails?\.$/, { timeout: 20000 });
  }
});

test('E, F and H on A2 are 3 by 3 tables with caption, headers and 1-based cells', async ({ page }) => {
  await open(page);
  for (const name of ['matrix-e', 'matrix-f', 'matrix-h']) {
    await expect(out(page, name)).toHaveAttribute('data-format', 'grid');
    await expect(out(page, name).locator('caption')).toHaveText(`${name.slice(-1).toUpperCase()}1, 3 by 3`);
    await expect(out(page, name).locator('thead th[scope="col"]')).toHaveCount(4);
    await expect(out(page, name).locator('tbody th[scope="row"]')).toHaveCount(3);
  }
  // The worked values (row the image, column the source): E1 has a 1 in row 1, column 3; H1 is diag(1, 0, -1).
  await expect(out(page, 'matrix-e').locator('[data-row="1"][data-col="3"]')).toHaveAttribute('data-value', '1');
  await expect(out(page, 'matrix-f').locator('[data-row="3"][data-col="1"]')).toHaveAttribute('data-value', '1');
  expect(await out(page, 'matrix-h').locator('td[data-row]').evaluateAll((tds) => tds.filter((td) => td.getAttribute('data-row') === td.getAttribute('data-col')).map((td) => td.getAttribute('data-value')))).toEqual(['1', '0', '-1']);
  // The node of the matrices is chosen apart from the node of the representation.
  await control(page, 'matrix-node').selectOption('2');
  await expect(out(page, 'matrix-e').locator('caption')).toHaveText('E2, 3 by 3');
  await expect(out(page, 'matrix-e').locator('[data-row="3"][data-col="2"]')).toHaveAttribute('data-value', '1');
});

test('grids up to dimension 27 and lists above: E6 node 1 and E7 node 7', async ({ page }) => {
  await open(page, 'g=E6&k=1');
  await expect(out(page, 'matrix-e')).toHaveAttribute('data-format', 'grid');
  await expect(out(page, 'matrix-e')).toHaveAttribute('data-rows', '27');
  await expect(out(page, 'matrix-e').locator('tbody tr')).toHaveCount(27);
  await open(page, 'g=E7');
  await expect(out(page, 'dimension')).toHaveText('56');
  for (const name of ['matrix-e', 'matrix-f', 'matrix-h', 'move-matrix', 'signed-move']) {
    await expect(out(page, name)).toHaveAttribute('data-format', 'list');
    await expect(out(page, name)).toHaveAttribute('data-rows', '56');
    await expect(out(page, name).locator('caption')).toContainText('nonzero entries of a 56 by 56 matrix');
  }
  await expect(out(page, 'relation-left')).toHaveAttribute('data-format', 'list', { timeout: 20000 });
});

test('the relation checker: picking ef:1,2 on A2 shows both sides equal and writes q', async ({ page }) => {
  await open(page);
  await expect(out(page, 'relation-verdict')).toHaveAttribute('data-holds', 'true');
  expect(await page.evaluate(() => location.search)).toBe('');
  await control(page, 'relation-j').selectOption('2');
  await expect(live(page)).toHaveText('[E1, F2] = 0: the two sides are equal.');
  await expect(out(page, 'relation-verdict')).toHaveAttribute('data-holds', 'true');
  await expect(out(page, 'relation-formula').locator('math')).toHaveAttribute('aria-label', 'E 1 F 2 commutator equals 0');
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).get('q'))).toBe('ef:1,2');
  // Both sides are the zero matrix: every cell 0.
  for (const side of ['relation-left', 'relation-right']) expect(new Set(await out(page, side).locator('td[data-value]').evaluateAll((tds) => tds.map((t) => t.getAttribute('data-value'))))).toEqual(new Set(['0']));
  // A Serre relation takes two different nodes: picking it with i = j moves j.
  await control(page, 'relation-j').selectOption('1');
  await control(page, 'relation').selectOption('serre-e');
  await expect(control(page, 'relation-j')).toHaveValue('2');
  await expect(live(page)).toHaveText('ad(E1)^2 E2 = 0: the two sides are equal.');
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).get('q'))).toBe('serre-e:1,2');
});

test('the move matrix beside its signed version: the same matrix with one sign changed in each pair', async ({ page }) => {
  await open(page);
  const cells = async (name: string): Promise<string[]> => out(page, name).locator('td[data-row]').evaluateAll((tds) => tds.map((t) => t.getAttribute('data-value') ?? ''));
  const move = await cells('move-matrix');
  const signed = await cells('signed-move');
  expect(move).toEqual(['0', '0', '1', '0', '1', '0', '1', '0', '0']);
  expect(signed).toEqual(['0', '0', '1', '0', '1', '0', '-1', '0', '0']);
});

test('the string viewer on A2 through (2, 0) at node 1: three positions, the middle outside the orbit, and firing turns the line', async ({ page }) => {
  await open(page, 'g=A2&k=1&c=n&s=2,0');
  await expect(out(page, 'notice')).toHaveCount(0);
  expect(await lineKeys(page)).toEqual(['2,0', '0,1', '-2,2']);
  expect(await line(page).evaluateAll((lis) => lis.map((li) => li.getAttribute('data-in-orbit')))).toEqual(['true', 'false', 'true']);
  await expect(out(page, 'string-length')).toHaveText('3');
  await expect(line(page).nth(1)).toContainText('outside the orbit');
  const after = fired('A2', [2, 0], 1);
  expect(after).toEqual(['-2', '2']);
  await node(page, 1).click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  expect(await valuesOf(page)).toEqual(after);
  expect(await lineKeys(page)).toEqual(['-2,2', '0,1', '2,0']);
  await expect(root(page).locator('.string-line')).toHaveAttribute('data-flips', '1');
  await expect(live(page)).toHaveText('Fired node 1. Numbers now minus 2, 2. Move 1.');
  // Typing a start: (0, 3) lies on a line of one position at node 1.
  await control(page, 'start-entry').nth(0).fill('0');
  await control(page, 'start-entry').nth(1).fill('3');
  await control(page, 'set-start').click();
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  expect(await lineKeys(page)).toEqual(['0,3']);
  await expect(live(page)).toHaveText('Start set. Numbers now 0, 3.');
  await control(page, 'start-entry').nth(0).fill('x');
  await control(page, 'set-start').click();
  await expect(out(page, 'start-message')).toHaveText('Type a whole number for node 1.');
});

test('B3 node 3 and C3 node 1 build 8 and 6 positions with every relation holding', async ({ page }) => {
  for (const [type, label, dim] of [['B3', 3, 8], ['C3', 1, 6]] as const) {
    expect(golden.minuscule_representations.find((r) => r.type === type && r.node === label)!.dimension).toBe(dim);
    await open(page, `g=${type}&k=${label}`);
    await expect(out(page, 'dimension')).toHaveText(String(dim));
    await expect(out(page, 'all-relations')).toHaveText(`All ${relationCount(3)} relations hold.`);
  }
});

test('G2 node 2 fails with some number in the orbit is 3, and F4 and G2, without a minuscule node, say so', async ({ page }) => {
  expect(golden.types.G2!.minuscule_nodes).toEqual([]);
  await open(page, 'g=G2&k=2');
  await expect(out(page, 'explanation')).toContainText('some number in the orbit is 3');
  await expect(out(page, 'no-minuscule')).toHaveText('This board has no minuscule node; its representations need more than the game.');
  await expect(out(page, 'relation-verdict')).toHaveAttribute('data-holds', 'false');
  // F4: the default node is 1 (no minuscule node), its orbit is built, and some relation fails.
  expect(golden.types.F4!.minuscule_nodes).toEqual([]);
  await open(page, 'g=F4');
  await expect(control(page, 'node')).toHaveValue('1');
  await expect(out(page, 'dimension')).toHaveText(String(golden.types.F4!.fundamental_orbit_sizes[0]));
  await expect(out(page, 'no-minuscule')).toHaveCount(1);
  await expect(out(page, 'minuscule')).toHaveAttribute('data-minuscule', 'false');
  await expect(out(page, 'all-relations')).toHaveText(/^\d+ of 88 relations fails?\.$/);
});

test('above 2000 positions the tool shows the explanation alone: E8 node 1', async ({ page }) => {
  const size = golden.types.E8!.fundamental_orbit_sizes[0]!;
  expect(size).toBeGreaterThan(2000);
  await open(page, 'g=E8');
  await expect(out(page, 'dimension')).toHaveText(String(size));
  await expect(out(page, 'limit')).toHaveText(`The orbit of ω1 has ${size} positions, more than 2000, so the matrices are not built here.`);
  await expect(out(page, 'explanation')).toContainText('some number in the orbit is');
  await expect(out(page, 'orbit-graph')).toHaveCount(0);
  await expect(root(page).locator('[data-format]')).toHaveCount(0);
  await expect(root(page).locator('[data-panel="relations"]')).toHaveCount(0);
  // The string viewer still works on E8.
  await expect(nodes(page)).toHaveCount(8);
});

// ---------------------------------------------------------------------------------------------
// Links, pickers and history (4.0, 6.6)
// ---------------------------------------------------------------------------------------------

test('unreadable links load the default state with the notice', async ({ page }) => {
  for (const query of ['g=A2&k=1&q=serre-e:1,1', 'g=A2&k=5', 'g=A2~', 'g=A2&q=xx:1,1', 'c=p&s=1,0']) {
    await open(page, query);
    await expect(out(page, 'notice'), query).toHaveText(NOTICE);
    await expect(out(page, 'dimension'), query).toHaveText('3');
    expect(await valuesOf(page), query).toEqual(['1', '0']);
    await expect(control(page, 'relation'), query).toHaveValue('ef');
  }
});

test('nothing is written to the address bar before the reader acts, and changing the board resets node, relation, start and moves', async ({ page }) => {
  await open(page);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => location.search)).toBe('');
  await node(page, 1).click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).get('w'))).toBe('1');
  await control(page, 'picker').selectOption('A3');
  await expect(out(page, 'dimension')).toHaveText('4');
  await settled(page);
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  expect(await valuesOf(page)).toEqual(['1', '0', '0']);
  await expect(control(page, 'node')).toHaveValue('1');
  await expect(control(page, 'relation')).toHaveValue('ef');
  await expect(live(page)).toHaveText('A3, node 1: the orbit of ω1 has 4 positions. Node 1 is minuscule: every number in the orbit of ω1 is −1, 0 or 1, and all the relations hold.');
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).get('g'))).toBe('A3');
  // The picker marks the minuscule nodes in text (A-5).
  expect(await control(page, 'node').locator('option').allTextContents()).toEqual(['1 (minuscule)', '2 (minuscule)', '3 (minuscule)']);
  await expect(control(page, 'picker')).toHaveValue('A3');
});

test('keyboard: Enter on a node fires it, u undoes and r redoes', async ({ page }) => {
  await open(page);
  await node(page, 1).focus();
  await page.keyboard.press('ArrowRight');
  await expect(node(page, 2)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(node(page, 1)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  expect(await valuesOf(page)).toEqual(fired('A2', [1, 0], 1));
  await expect(live(page)).toHaveText('Fired node 1. Numbers now minus 1, 1. Move 1.');
  await page.keyboard.press('u');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await expect(live(page)).toHaveText('Undid move 1. Numbers now 1, 0.');
  await page.keyboard.press('r');
  await expect(root(page)).toHaveAttribute('data-moves', '1');
});

test('redo, reset and the strip of past positions', async ({ page }) => {
  await open(page);
  await node(page, 1).click();
  await node(page, 2).click();
  await node(page, 1).click();
  await expect(root(page)).toHaveAttribute('data-moves', '3');
  const third = await valuesOf(page);
  await root(page).locator('[data-step="1"]').click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  expect(await valuesOf(page)).toEqual(fired('A2', [1, 0], 1));
  await control(page, 'redo').click();
  await control(page, 'redo').click();
  await expect(root(page)).toHaveAttribute('data-moves', '3');
  expect(await valuesOf(page)).toEqual(third);
  await control(page, 'reset').click();
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  expect(await valuesOf(page)).toEqual(['1', '0']);
});

test('a link with 51 moves shows the slider, and the slider scrubs', async ({ page }) => {
  const moves = Array.from({ length: 51 }, () => '1').join('.');
  await open(page, `g=A2&k=1&w=${moves}`);
  await expect(root(page)).toHaveAttribute('data-moves', '51');
  await expect(out(page, 'historyCounter')).toHaveText('51 of 51');
  expect(await valuesOf(page)).toEqual(['-1', '1']);
  await control(page, 'historySlider').fill('10');
  await expect(root(page)).toHaveAttribute('data-moves', '10');
  expect(await valuesOf(page)).toEqual(['1', '0']);
});

test('a link with 2001 moves is replayed in the worker and shows the end of the play', async ({ page }) => {
  const workers: string[] = [];
  page.on('worker', (w) => workers.push(w.url()));
  const moves = Array.from({ length: 2001 }, () => '1').join('.');
  await page.goto(`${ROUTE}?g=A2&k=1&w=${moves}`);
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
  await expect(node(page, 1)).toHaveAttribute('data-can-act', 'true', { timeout: 20000 });
  await expect(root(page)).toHaveAttribute('data-moves', '2001');
  expect(await valuesOf(page)).toEqual(['-1', '1']);
  expect(workers.length).toBeGreaterThan(0);
});

test('no default state needs the worker, and E7 computes its relation list there', async ({ page }) => {
  const workers: string[] = [];
  page.on('worker', (w) => workers.push(w.url()));
  await open(page);
  await page.waitForTimeout(1000);
  expect(workers).toEqual([]);
  await control(page, 'picker').selectOption('E7');
  await expect(out(page, 'all-relations')).toHaveText('All 280 relations hold.', { timeout: 20000 });
  await settled(page);
  expect(workers.length).toBe(1);
});

test('the table view lists the orbit and has a button per node that fires it', async ({ page }) => {
  await open(page);
  await root(page).locator('summary').click();
  const orbit = root(page).locator('[data-table="orbit"]');
  await expect(orbit.locator('[data-table-row]')).toHaveCount(3);
  await expect(orbit.locator('[data-table-row="2"] td').first()).toHaveText('(0, −1)');
  const button = root(page).locator('[data-table-board="numbers"][data-table-node="1"]');
  await expect(button).toHaveAttribute('aria-label', 'Node 1, value 1: fire it');
  await button.click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await expect(button).toHaveText('-1');
  expect(await valuesOf(page)).toEqual(['-1', '1']);
});

// ---------------------------------------------------------------------------------------------
// Share and export (4.0, 6.6)
// ---------------------------------------------------------------------------------------------

test('Copy link gives the link of the current state, and opening it restores it', async ({ page }) => {
  await openForExport(page, `${ROUTE}?g=D4&k=2`);
  await control(page, 'relation-j').selectOption('2');
  await node(page, 2).click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  const values = await valuesOf(page);
  const params = await copiedLink(page);
  expect(params.get('g')).toBe('D4');
  expect(params.get('k')).toBe('2');
  expect(params.get('q')).toBe('ef:1,2');
  expect(params.get('w')).toBe('2');
  await open(page, params.toString());
  await expect(out(page, 'notice')).toHaveCount(0);
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  expect(await valuesOf(page)).toEqual(values);
  await expect(control(page, 'relation-j')).toHaveValue('2');
  await expect(out(page, 'dimension')).toHaveText('24');
});

test('Download data gives the basis, the matrices, the relations and the string, integers as numbers when safe', async ({ page }) => {
  await openForExport(page, ROUTE);
  await node(page, 1).click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  const { raw, doc } = await downloadData(page);
  expect(doc.tool).toBe('rep');
  expect(doc.state).toEqual({ schema: 1, tool: 'rep', board: 'A2', node: 1, relation: 'ef:1,1', coords: 'numbers', start: [1, 0], moves: [1] });
  expect(doc.derived.dimension).toBe(3);
  expect(doc.derived.basis).toEqual([[1, 0], [0, -1], [-1, 1]]);
  expect(doc.derived.E[0]).toEqual([[1, 3, 1]]);
  expect(doc.derived.relations).toHaveLength(relationCount(2));
  expect(doc.derived.positions).toEqual([[1, 0], [-1, 1]]);
  expect(unsafeNumbers(raw)).toEqual([]);
  // A start beyond the safe integers keeps its digits as text (6.6), in the state and the derived tables.
  const big = '12345678901234567890';
  await openForExport(page, `${ROUTE}?g=A2&k=1&c=n&s=${big},0`);
  const long = await downloadData(page);
  expect(long.doc.state.start).toEqual([big, 0]);
  expect(long.doc.derived.string.through).toEqual([big, 0]);
  expect(unsafeNumbers(long.raw)).toEqual([]);
});

test('Export SVG and Export PNG save the figure', async ({ page }) => {
  await open(page);
  const [svg] = await Promise.all([page.waitForEvent('download'), root(page).locator('[data-export="svg"]').click()]);
  const text = readFileSync((await svg.path())!, 'utf8');
  expect(text).toContain('<svg');
  expect(text).toContain('(1, 0) #1');
  const [png] = await Promise.all([page.waitForEvent('download'), root(page).locator('[data-export="png"]').click()]);
  const bytes = readFileSync((await png.path())!);
  expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
});

test('a long number is shown shortened with its digits in the tooltip and the hook', async ({ page }) => {
  const big = '12345678901234567890';
  await open(page, `g=A2&k=1&c=n&s=${big},0`);
  await expect(node(page, 1)).toHaveAttribute('data-value', big);
  await expect(node(page, 1)).toHaveAttribute('title', big);
  await expect(line(page).first()).toHaveAttribute('data-value', `${big},0`);
  await expect(line(page).first()).toContainText('x 10^19 (20 digits)');
  await expect(line(page).first()).toHaveAttribute('title', `(${big}, 0)`);
  await expect(out(page, 'string-length')).toHaveText(String(BigInt(big) + 1n));
});

// ---------------------------------------------------------------------------------------------
// Hooks, names, motion, focus, mathematics (4.0, 7.5 A-2 to A-9)
// ---------------------------------------------------------------------------------------------

test('every node button carries data-node, data-board, data-value and data-can-act, with the A-3 names', async ({ page }) => {
  await open(page);
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await expect(nodes(page)).toHaveCount(2);
  for (const b of await nodes(page).all()) {
    await expect(b).toHaveAttribute('data-node', /^[12]$/);
    await expect(b).toHaveAttribute('data-board', 'numbers');
    await expect(b).toHaveAttribute('data-value', /^-?\d+$/);
    await expect(b).toHaveAttribute('data-can-act', 'true');
  }
  await expect(node(page, 1)).toHaveAttribute('aria-label', 'Node 1, value 1, can be fired');
  await expect(node(page, 2)).toHaveAttribute('aria-label', 'Node 2, value 0, can be fired');
  await expect(root(page).getByRole('group', { name: 'String viewer board A2' })).toHaveCount(1);
});

test('the line turns with a flip, and with none under reduced motion', async ({ page }) => {
  await open(page);
  await node(page, 1).click();
  await expect(root(page).locator('.string-line')).toHaveAttribute('data-flips', '1');
  expect(await root(page).locator('.string-line').evaluate((el) => getComputedStyle(el).animationName)).toContain('flip-a');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await node(page, 1).click();
  await expect(root(page).locator('.string-line')).toHaveAttribute('data-flips', '1');
  expect(await root(page).locator('.string-line').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test('a matrix box is reached by Tab and shows a focus ring', async ({ page }) => {
  await open(page);
  let reached = false;
  for (let k = 0; k < 80 && !reached; k++) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate(() => document.activeElement?.closest('[data-out="matrix-e"]') !== null && document.activeElement?.classList.contains('box') === true);
  }
  expect(reached).toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).not.toBe('none');
  expect(await page.evaluate(() => document.activeElement!.getAttribute('role'))).toBe('group');
});

test('the relation is written in MathML outside KaTeX, and no KaTeX script loads', async ({ page }) => {
  const scripts: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'script') scripts.push(r.url());
  });
  await open(page);
  const math = out(page, 'relation-formula').locator('math');
  await expect(math).toHaveCount(1);
  await expect(math).toHaveAttribute('aria-label', 'E 1 F 1 commutator equals H 1');
  expect(await math.evaluate((m) => m.closest('.katex') === null)).toBe(true);
  expect(scripts.filter((u) => /katex/i.test(u))).toEqual([]);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('without JavaScript the default orbit, matrices, relation, signed move, string, caption and tables are present and the controls are disabled', async ({ page }) => {
    await page.goto(ROUTE);
    await expect(out(page, 'noscript')).toHaveCount(1);
    await expect(out(page, 'dimension')).toHaveText('3');
    await expect(out(page, 'orbit-graph').locator('[data-vertex]')).toHaveCount(3);
    for (const name of ['matrix-e', 'matrix-f', 'matrix-h', 'relation-left', 'relation-right', 'move-matrix', 'signed-move']) await expect(out(page, name)).toHaveAttribute('data-format', 'grid');
    await expect(out(page, 'all-relations')).toHaveText(`All ${relationCount(2)} relations hold.`);
    await expect(out(page, 'relation-formula').locator('math')).toHaveCount(1);
    expect(await lineKeys(page)).toEqual(['1,0', '-1,1']);
    await expect(out(page, 'caption')).toContainText('Chevalley-Serre relations');
    await expect(root(page).locator('details [data-table="orbit"]')).toHaveCount(1);
    for (const el of await root(page).locator('button, select, input').all()) await expect(el).toBeDisabled();
    await expect(live(page)).toHaveText('');
  });
});

test('no serious or critical axe violations on /tools/rep', async ({ page }) => {
  test.setTimeout(240000);
  const serious = async (): Promise<{ id: string; nodes: string[] }[]> => {
    const axe = await new AxeBuilder({ page }).include('[data-tool="rep"]').analyze();
    return axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) }));
  };
  for (const query of ['', 'g=D4&k=2', 'g=E7', 'g=E8', 'g=E7&k=2']) {
    await open(page, query);
    await expect(out(page, 'all-relations').or(out(page, 'limit'))).toHaveText(/hold|fail|not built/, { timeout: 20000 });
    await page.waitForTimeout(500);
    expect(await serious(), query).toEqual([]);
  }
});

test('at 320 pixels the page has no horizontal scroll and the targets are large enough', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const query of ['', 'g=E6&k=1', 'g=E7', 'g=D8&k=8']) {
    await open(page, query);
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), query).toBeLessThanOrEqual(0);
    for (const b of await root(page).locator('[data-panel="string"] button[data-node], [data-control]:is(button, select, input), [data-export]').all()) {
      const r = await b.boundingBox();
      if (r === null || r.width === 0) continue;
      expect(r.width, query).toBeGreaterThanOrEqual(24);
      expect(r.height, query).toBeGreaterThanOrEqual(24);
    }
    // Undo, redo and reset reach 44 by 44 (A-7).
    for (const name of ['undo', 'redo', 'reset']) {
      const r = (await control(page, name).boundingBox())!;
      expect(Math.min(r.width, r.height), `${query} ${name}`).toBeGreaterThanOrEqual(44);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Main-thread work (SPEC 7.6; E-9; decisions/P5-A2.md): the processor slowed four times, as the lab
// profile of 7.6. The relation list is computed on the main thread up to 27 positions (E6 node 1 is the
// largest) and in the worker above (E7 node 7, the largest listed representation); a pick builds the
// representation one engine call per task and draws the panels one piece per task.
// ---------------------------------------------------------------------------------------------

async function recordLongTasks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __longtasks: { start: number; duration: number }[] };
    w.__longtasks = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__longtasks.push({ start: Math.round(e.startTime), duration: Math.round(e.duration) });
    }).observe({ type: 'longtask', buffered: true });
  });
}
const longTasksSince = async (page: Page, t0: number): Promise<{ start: number; duration: number }[]> =>
  page.evaluate((from) => (window as unknown as { __longtasks: { start: number; duration: number }[] }).__longtasks.filter((t) => t.start + t.duration > from), t0);

for (const [board, label, size] of [['E6', 1, 27], ['E7', 7, 56]] as const) {
  test(`no long task when ${board} is picked and node ${label} (${size} positions) is built, with the processor slowed four times`, async ({ page }) => {
    test.setTimeout(120000);
    await recordLongTasks(page);
    await open(page);
    await page.waitForTimeout(500);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    try {
      const t0 = await page.evaluate(() => performance.now());
      await control(page, 'picker').selectOption(board);
      // Waited for without expect (an expect that retries takes accessibility snapshots on the main thread).
      await page.waitForFunction(
        (n) => {
          const tool = document.querySelector('[data-tool="rep"]');
          const text = (name: string): string => tool?.querySelector(`[data-out="${name}"]`)?.textContent ?? '';
          return text('dimension') === n && /relations hold\./.test(text('all-relations')) && tool?.querySelector('[data-table="board"]') !== null && tool?.querySelector('[data-out="relation-right"][data-format]') !== null;
        },
        String(size),
        { polling: 100, timeout: 60000 },
      );
      await page.waitForTimeout(1500);
      const tasks = await longTasksSince(page, t0);
      console.info(`T12 long tasks after picking ${board} at 4x: ${JSON.stringify(tasks)}`);
      expect(tasks).toEqual([]);
    } finally {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    }
    await expect(control(page, 'node')).toHaveValue(String(label));
  });
}
