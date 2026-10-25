// P5-A2: tool T12, the Representation Builder, against the built site (SPEC.md 4 T12, 2.18, 2.7 F11, 4.0,
// 5.6, 6.6, 7.4 to 7.6, E-9). Cases are opened by bare query parameters on /tools/rep/ (6.6: every state
// is a link) or through the tool's controls. Tests read only the hooks of 4.0 and the live region (and,
// where a criterion is about the address bar, the clipboard or a download, those). Expected values are
// read from reference/golden_data.json or computed here in Node from the engine; the only values typed
// are the worked values of the instruction (A2 node 1, A2 through (2, 0), D4 node 2), each checked
// against the engine or the golden file first.
//
// Hooks read:
//   root:      data-tool="rep", data-moves, data-hydrated="true"; on the figure (.t12) data-drawn ("true"
//              when no panel is being drawn: after hydration the panels are drawn from the state, one
//              task each, the server's markup standing for them meanwhile)
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
//   state-board, state-node (the board and the node of the state shown, labels), dimension (the dimension
//   of the representation, weylDimension), orbit-size (the positions of the orbit: the size of the
//   matrices), minuscule,
//   explanation, no-minuscule, limit, orbit-graph, matrix-e, matrix-f, matrix-h, relation-formula,
//   relation-verdict, relation-left, relation-right, all-relations (with data-total, data-failing),
//   move-matrix, signed-move, string-position, string-length (data-value: the exact length), string-gap
//   (the count of positions not listed; data-value: the exact count), string-note, start-message
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
import { boardFromName, chevalleySerre, fire, minusculeMatrices, play, stringThrough, toLabels, toPositions } from '../../../packages/engine/src/index';
import type { AnyBoard, Board } from '../../../packages/engine/src/index';
import { bigBoard } from '../../src/lib/state';
import { copiedLink, downloadData, openForExport, unsafeNumbers } from './exportIntegers';

interface MinusculeRecord {
  type: string;
  node: number;
  dimension: number;
  weights_dynkin_labels: number[][] | null;
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
  // After hydration the panels are drawn from the state one task each (data-drawn="false" meanwhile).
  await expect(root(page).locator('.t12')).toHaveAttribute('data-drawn', 'true', { timeout: 20000 });
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
    await expect(out(page, 'explanation'), what).toHaveText(`Node ${rec.node} is minuscule: every number in the orbit of e${rec.node} is −1, 0 or 1, and all the relations hold.`);
    await expect(out(page, 'orbit-graph'), what).toHaveAttribute('data-positions', String(rec.dimension));
  }
});

test('acceptance: choosing node 2 of D4 shows a failing relation and the explanation that some number in the orbit is 2', async ({ page }) => {
  expect(golden.types.D4!.fundamental_orbit_sizes[1]).toBe(24);
  expect(golden.types.D4!.minuscule_nodes).not.toContain(2);
  await open(page, 'g=D4');
  await expect(out(page, 'dimension')).toHaveText('8');
  await control(page, 'node').selectOption('2');
  await expect(out(page, 'orbit-size')).toHaveText('24');
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
  await expect(live(page)).toContainText('D4, node 2: the orbit of e2 has 24 positions. Node 2 is not minuscule: some number in the orbit is 2');
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
    await expect(out(page, 'orbit-size')).toHaveText(String(size));
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
  await expect(out(page, 'no-minuscule')).toHaveText('This board has no minuscule node, so the recipe of this tool builds none of its representations.');
  await expect(out(page, 'relation-verdict')).toHaveAttribute('data-holds', 'false');
  // F4: the default node is 1 (no minuscule node), its orbit is built, and some relation fails.
  expect(golden.types.F4!.minuscule_nodes).toEqual([]);
  await open(page, 'g=F4');
  await expect(control(page, 'node')).toHaveValue('1');
  await expect(out(page, 'orbit-size')).toHaveText(String(golden.types.F4!.fundamental_orbit_sizes[0]));
  await expect(out(page, 'no-minuscule')).toHaveCount(1);
  await expect(out(page, 'minuscule')).toHaveAttribute('data-minuscule', 'false');
  await expect(out(page, 'all-relations')).toHaveText(/^\d+ of 88 relations fails?\.$/);
});

test('above 2000 positions the tool shows the explanation alone: E8 node 1', async ({ page }) => {
  const size = golden.types.E8!.fundamental_orbit_sizes[0]!;
  expect(size).toBeGreaterThan(2000);
  await open(page, 'g=E8');
  await expect(out(page, 'orbit-size')).toHaveText(String(size));
  await expect(out(page, 'limit')).toHaveText(`The orbit of e1 has ${size} positions, more than 2000, so the matrices are not built here.`);
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
  await expect(live(page)).toHaveText('A3, node 1: the orbit of e1 has 4 positions. Node 1 is minuscule: every number in the orbit of e1 is −1, 0 or 1, and all the relations hold.');
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
  // A true minus sign (SPEC 6.3; review P5-A2, finding 7).
  await expect(button).toHaveText('−1');
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
  const verdict = await out(page, 'relation-verdict').getAttribute('data-holds');
  expect(verdict).not.toBeNull();
  const lineBefore = await lineKeys(page);
  const inOrbitBefore = await line(page).evaluateAll((lis) => lis.map((li) => li.getAttribute('data-in-orbit')));
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
  await expect(out(page, 'orbit-size')).toHaveText('24');
  // The verdict and the string viewer's line come back with the link (review P5-A2, finding 5).
  await expect(out(page, 'relation-verdict')).toHaveAttribute('data-holds', verdict!);
  expect(await lineKeys(page)).toEqual(lineBefore);
  expect(await line(page).evaluateAll((lis) => lis.map((li) => li.getAttribute('data-in-orbit')))).toEqual(inOrbitBefore);
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
  // Every record is the engine's, in its order, its positions mapped through toLabels (E-7; review finding 5).
  const A2 = B('A2');
  const m = minusculeMatrices(A2, 0)!;
  expect(doc.derived.relations).toEqual(chevalleySerre(A2, m.E, m.F, m.H).map((c) => ({ relation: c.relation, i: toLabels(A2, [c.i])[0], j: toLabels(A2, [c.j])[0], holds: c.holds })));
  // The orbit with its layers, its edges and the two sides of the relation shown (6.6; review finding 8).
  expect(doc.derived.orbit).toEqual([
    { row: 1, position: [1, 0], layer: 0 },
    { row: 2, position: [0, -1], layer: 2 },
    { row: 3, position: [-1, 1], layer: 1 },
  ]);
  expect(doc.derived.edges).toHaveLength(2);
  expect(doc.derived.edges).toContainEqual([1, 3, 1]);
  expect(doc.derived.relationSides).toEqual({ relation: 'ef:1,1', holds: true, left: [[1, 1, 1], [3, 3, -1]], right: [[1, 1, 1], [3, 3, -1]] });
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
  // The length, a value of 20 digits, is shown shortened, its digits in the hook (RT-FIX P5-RT-03-01).
  await expect(out(page, 'string-length')).toHaveAttribute('data-value', String(BigInt(big) + 1n));
  await expect(out(page, 'string-length')).toHaveText('1.2345... x 10^19 (20 digits)');
  // The line of more than 2000 positions is given by its ends, with the stated limit (5.9; review finding 5).
  await expect(line(page)).toHaveCount(2);
  await expect(out(page, 'string-note')).toContainText('more than 2000');
  // The table view holds the exact digits.
  await root(page).locator('summary').click();
  await expect(root(page).locator('[data-table-board="numbers"][data-table-node="1"]')).toHaveText(big);
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
    // No two node hit boxes of the string viewer overlap (A-7; review P5-A2, finding 5).
    const boxes = (await Promise.all((await nodes(page).all()).map((b) => b.boundingBox()))).filter((r) => r !== null);
    expect(boxes.length, query).toBeGreaterThan(0);
    for (let a = 0; a < boxes.length; a++) {
      for (let b = a + 1; b < boxes.length; b++) {
        const p = boxes[a]!;
        const q = boxes[b]!;
        const w = Math.min(p.x + p.width, q.x + q.width) - Math.max(p.x, q.x);
        const h = Math.min(p.y + p.height, q.y + q.height) - Math.max(p.y, q.y);
        expect(w > 0.5 && h > 0.5, `${query}: node hit boxes ${a + 1} and ${b + 1} overlap`).toBe(false);
      }
    }
    // Undo, redo and reset reach 44 by 44 (A-7).
    for (const name of ['undo', 'redo', 'reset']) {
      const r = (await control(page, name).boundingBox())!;
      expect(Math.min(r.width, r.height), `${query} ${name}`).toBeGreaterThanOrEqual(44);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// The repair after review (P5-A2-review.json): numbers near 2^53, hooks, keyboard, links
// ---------------------------------------------------------------------------------------------

/** A position given in label order on the Big copy of a board (exact), and back as decimal text in label order. */
function bigInLabels(name: string): { board: AnyBoard; byPos: (v: readonly bigint[]) => bigint[]; key: (v: readonly bigint[]) => string } {
  const board = B(name);
  const order = toPositions(board, [...board.labels].sort((a, b) => a - b));
  const byPos = (v: readonly bigint[]): bigint[] => {
    const out: bigint[] = new Array<bigint>(board.n);
    order.forEach((p, k) => (out[p] = v[k]!));
    return out;
  };
  return { board, byPos, key: (v) => order.map((p) => String(v[p])).join(',') };
}

test('a safe start whose line, ends or legal play pass 2^53 hydrates and shows its line exactly, and can be played (review finding 1)', async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cases: { name: string; label: number; start: bigint[] }[] = [
    { name: 'A2', label: 1, start: [5n, 9007199254740990n] },
    { name: 'A2', label: 1, start: [1n, 9007199254740991n] },
    { name: 'G2', label: 1, start: [3n, 3002399751580330n] },
    { name: 'A2', label: 2, start: [9007199254740991n, 1n] },
  ];
  for (const c of cases) {
    const q = `g=${c.name}&k=${c.label}&c=n&s=${c.start.join(',')}`;
    const { board, byPos, key } = bigInLabels(c.name);
    const big = bigBoard(board);
    const mu = byPos(c.start);
    const i = toPositions(board, [c.label])[0]!;
    // The expected line: stringThrough on numbers when every entry of it is safe, else its two ends (fire).
    let expected: bigint[][];
    try {
      expected = stringThrough(board, mu.map(Number), i).map((v) => v.map(BigInt));
    } catch {
      expected = [mu, fire(big, mu, i)];
    }
    const end = (v: readonly bigint[]): string => play(big, v).position.join(',');
    await open(page, q);
    await expect(out(page, 'notice'), q).toHaveCount(0);
    expect(await lineKeys(page), q).toEqual(expected.map(key));
    expect(await line(page).evaluateAll((lis) => lis.map((li) => li.getAttribute('data-in-orbit'))), q).toEqual(expected.map((v) => String(end(v) === end(mu))));
    await expect(node(page, 1), q).toBeEnabled();
    const other = c.label === 1 ? 2 : 1;
    await node(page, other).click();
    await expect(root(page), q).toHaveAttribute('data-moves', '1');
    const after = fire(big, mu, toPositions(board, [other])[0]!);
    expect(await valuesOf(page), q).toEqual(key(after).split(','));
  }
  // A start typed into the fields takes the same path.
  await open(page);
  await control(page, 'start-entry').nth(0).fill('5');
  await control(page, 'start-entry').nth(1).fill('9007199254740990');
  await control(page, 'set-start').click();
  await expect.poll(() => lineKeys(page)).toEqual(['5,9007199254740990', '-5,9007199254740995']);
  await expect(out(page, 'string-note')).toContainText('2^53');
  await node(page, 2).click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  expect(await valuesOf(page)).toEqual(['9007199254740995', '-9007199254740990']);
  expect(errors).toEqual([]);
});

test('the row headers of a matrix are the golden weights_dynkin_labels in order (review finding 5)', async ({ page }) => {
  await open(page);
  const weights = golden.minuscule_representations.find((r) => r.type === 'A2' && r.node === 1)!.weights_dynkin_labels!;
  const text = (w: number[]): string => `(${w.map((x) => (x < 0 ? `−${-x}` : String(x))).join(', ')})`;
  for (const name of ['matrix-e', 'matrix-h', 'relation-left', 'move-matrix']) {
    expect(await out(page, name).locator('tbody th[scope="row"]').allTextContents(), name).toEqual(weights.map((w, r) => `${r + 1}: ${text(w)}`));
  }
});

test('the focused control shows the focus ring and no sticky element hides it (A-2)', async ({ page }) => {
  await open(page);
  const ring = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.color = 'var(--focus-ring)';
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  });
  // In the order of the page: the picker, the relation checker, the string viewer's board, then History.
  const targets: [string, string][] = [
    ['the board picker', '[data-control="picker"]'],
    ['a relation control', '[data-control="relation"]'],
    ['a node of the string viewer', '[data-panel="string"] button[data-node]'],
    ['a History button', '[data-control="undo"], [data-control="redo"], [data-control="reset"]'],
  ];
  for (const [what, selector] of targets) {
    let reached = false;
    for (let k = 0; k < 300 && !reached; k++) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate((sel) => document.activeElement?.matches(`[data-tool="rep"] :is(${sel})`) === true, selector);
    }
    expect(reached, what).toBe(true);
    const seen = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { style: s.outlineStyle, colour: s.outlineColor, width: s.outlineWidth, hit: hit !== null && (hit === el || el.contains(hit)) };
    });
    expect(seen.style, what).not.toBe('none');
    expect(seen.colour, what).toBe(ring);
    expect(seen.hit, what).toBe(true);
  }
});

test('every action works without a drag: pickers, relations, firing, the strip by buttons and the slider by keys (A-8)', async ({ page }) => {
  await open(page);
  expect(await root(page).locator('[draggable="true"]').count()).toBe(0);
  await control(page, 'relation-j').selectOption('2');
  await expect(out(page, 'relation-verdict')).toHaveAttribute('data-holds', 'true');
  await node(page, 1).click();
  await node(page, 2).click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await root(page).locator('[data-step="1"]').click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  // A position of the strip is also reached with the keyboard (a button: Enter).
  await root(page).locator('[data-step="2"]').focus();
  await page.keyboard.press('Enter');
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  // A strip of more than 50 positions is a slider, scrubbed by its keys.
  const moves = Array.from({ length: 51 }, () => '1').join('.');
  await open(page, `g=A2&k=1&w=${moves}`);
  const slider = control(page, 'historySlider');
  await slider.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(root(page)).toHaveAttribute('data-moves', '50');
  await page.keyboard.press('Home');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  expect(await valuesOf(page)).toEqual(['1', '0']);
  await page.keyboard.press('End');
  await expect(root(page)).toHaveAttribute('data-moves', '51');
  expect(await root(page).locator('[draggable="true"]').count()).toBe(0);
});

test('acting from a scrubbed position discards the later moves (4.0 History)', async ({ page }) => {
  await open(page, 'g=A2&k=1&c=n&s=2,0');
  for (const l of [1, 2, 1]) await node(page, l).click();
  await expect(root(page)).toHaveAttribute('data-moves', '3');
  await root(page).locator('[data-step="1"]').click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await node(page, 2).click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  expect(await valuesOf(page)).toEqual(fired('A2', fired('A2', [2, 0], 1).map(Number), 2));
  await control(page, 'redo').click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).get('w'))).toBe('1.2');
});

test('the Serre relation is MathML with msub and msup, outside any .katex element', async ({ page }) => {
  await open(page, 'g=A2&k=1&q=serre-e:1,2');
  const math = out(page, 'relation-formula').locator('math');
  await expect(math).toHaveCount(1);
  expect(await math.locator('msub').count()).toBeGreaterThanOrEqual(2);
  await expect(math.locator('msup')).toHaveCount(1);
  await expect(math).toHaveAttribute('aria-label', 'ad E 1 to the power 2 applied to E 2 equals 0');
  expect(await math.evaluate((m) => m.closest('.katex') === null)).toBe(true);
  await expect(out(page, 'relation-verdict')).toHaveAttribute('data-holds', 'true');
});

test('a node that is not minuscule moves to its first failing relation when the list arrives from the worker, unless the link chose one (review finding 6)', async ({ page }) => {
  // C5 node 5: 32 positions and 140 records, a list of the worker; [E5, F5] = H5 holds there.
  const C5 = B('C5');
  const m = minusculeMatrices(C5, toPositions(C5, [5])[0]!)!;
  const list = chevalleySerre(C5, m.E, m.F, m.H);
  const own = list.find((c) => c.relation === 'ef' && c.i === toPositions(C5, [5])[0] && c.j === c.i)!;
  expect(own.holds).toBe(true);
  const first = list.find((c) => !c.holds)!;
  const [fi, fj] = toLabels(C5, [first.i, first.j]);
  await open(page, 'g=C5&k=5');
  await expect(out(page, 'relation-verdict')).toHaveAttribute('data-holds', 'false', { timeout: 20000 });
  await expect(control(page, 'relation')).toHaveValue(first.relation);
  await expect(control(page, 'relation-i')).toHaveValue(String(fi));
  await expect(control(page, 'relation-j')).toHaveValue(String(fj));
  await expect(out(page, 'all-relations')).toHaveText(new RegExp(`^${list.filter((c) => !c.holds).length} of ${list.length} relations fail\\.$`));
  // A link that names the relation keeps it.
  await open(page, 'g=C5&k=5&q=ef:5,5');
  await expect(out(page, 'all-relations')).toHaveText(/relations fail\./, { timeout: 20000 });
  await expect(out(page, 'relation-verdict')).toHaveAttribute('data-holds', 'true');
  await expect(control(page, 'relation-i')).toHaveValue('5');
});

test('data-out="state-board" and "state-node" name the board and the node of the state shown (request of P5-A3)', async ({ page }) => {
  await open(page);
  await expect(out(page, 'state-board')).toHaveText('A2');
  await expect(out(page, 'state-node')).toHaveText('1');
  await control(page, 'picker').selectOption('E6');
  await expect(out(page, 'state-board')).toHaveText('E6');
  await expect(out(page, 'state-node')).toHaveText('1');
  await settled(page);
  await control(page, 'node').selectOption('6');
  await expect(out(page, 'state-node')).toHaveText('6');
  await expect(out(page, 'state-board')).toHaveText('E6');
});

test('the tables of the server stay in place when the reader acts on the string viewer or picks a relation', async ({ page }) => {
  await open(page);
  await settled(page);
  // Each drawn MatrixView took over the table of the server's markup; mark those elements.
  const marked = await page.evaluate(() => {
    const tool = document.querySelector('[data-tool="rep"]')!;
    const tables = [...tool.querySelectorAll('[data-out^="matrix-"] .box table, [data-out^="relation-"] .box table')];
    tables.forEach((t) => t.setAttribute('data-test-kept', 'true'));
    return tables.length;
  });
  expect(marked).toBe(5);
  expect(await valuesOf(page)).toEqual(['1', '0']);
  await node(page, 1).click();
  await expect.poll(() => valuesOf(page)).toEqual(fired('A2', [1, 0], 1));
  await page.waitForTimeout(300);
  // Firing changes the state (and the tool's version): the five tables are still the server's elements.
  await expect(root(page).locator('[data-test-kept="true"]')).toHaveCount(5);
  await control(page, 'relation').selectOption('he');
  await expect(root(page).locator('[data-out="relation-verdict"]')).toHaveText('equal');
  // A new relation draws its two sides; the matrices E, F and H keep the server's tables.
  await expect(root(page).locator('[data-out^="matrix-"] [data-test-kept="true"]')).toHaveCount(3);
});

// ---------------------------------------------------------------------------------------------
// Main-thread work (SPEC 7.6; E-9; decisions/P5-A2.md): the processor slowed four times, as the lab
// profile of 7.6. The relation list is computed on the main thread up to RELATIONS_MAIN_WORK (positions
// times records, 2500: D6 node 1 is the largest) and in the worker above (E6 node 1 and E7 node 7 among
// them); a pick builds the representation one engine call per task and draws the panels one piece per task.
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

// ---------------------------------------------------------------------------------------------
// Regressions of the phase 5 red-team round (build-plan/red-team/RT-FIX.md 5.3)
// ---------------------------------------------------------------------------------------------

test.describe('regressions', () => {
  // Adopted from site/tests/e2e/redteam-RT-13-p5-dimension.spec.ts (RT-13, phase 5 round, attack 9); the
  // same cause as P5-RT-09-02 (site/tests/unit/tools/T12.test.ts). On a node that is not minuscule T12
  // printed the orbit size under the label "Dimension", which is the size of the representation only on a
  // minuscule node. M8 beat 6 gives 248 for E8 and 26 for F4, beat 7 the 7 of G2. Oracle
  // (lie_games.weyl_dimension and orbit_size): E8 node 8 orbit 240, representation 248; F4 node 4 orbit
  // 24, representation 26; G2 node 1 orbit 6, representation 7; D4 node 2 orbit 24, representation 28.
  const CASES: [string, number, number, number][] = [
    // board, node, orbit size, dimension of the representation (oracle)
    ['E8', 8, 240, 248], ['F4', 4, 24, 26], ['G2', 1, 6, 7], ['D4', 2, 24, 28],
  ];
  for (const [g, k, orbit, dim] of CASES) {
    // regression: P5-RT-13-03
    test(`attack 9: T12 on ${g} node ${k} does not print "Dimension: ${orbit}" for the ${dim}-dimensional representation`, async ({ page }) => {
      await page.goto(`tools/rep/?g=${g}&k=${k}`);
      const t = page.locator('[data-tool="rep"]').first();
      await expect(t).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
      await expect(t.locator('[data-out="state-node"]').first()).toHaveText(String(k), { timeout: 30000 });
      const shown = (await t.locator('[data-out="dimension"]').first().textContent())?.trim();
      const minuscule = (await t.locator('[data-out="minuscule"]').first().textContent())?.trim();
      expect(minuscule).toBe('no');
      expect(shown, `${g} node ${k}: the tool labels the orbit size ${shown} "Dimension", the representation has dimension ${dim}`).not.toBe(String(orbit));
      // The fix: the representation's dimension under "Dimension", the orbit's positions under their own name.
      expect(shown).toBe(String(dim));
      expect(golden.types[g]!.fundamental_orbit_sizes[k - 1]).toBe(orbit);
      await expect(t.locator('[data-out="orbit-size"]').first()).toHaveText(String(orbit));
    });
  }

  // Adopted from site/tests/e2e/redteam-RT-03-t12.spec.ts (RT-03, phase 5 round, attack 12, SPEC 4.0 Long
  // numbers: "A value of more than 12 digits is shown shortened"). The string viewer shortened the positions
  // it lists but printed the length of the line and the count of positions not listed in full. The gap item
  // is read through its hook data-out="string-gap" (the reproducer read its class); the exact digits are in
  // the hooks' data-value and in the tooltip.
  // regression: P5-RT-03-01
  test('the length of a line of 12345678901234567891 positions, and the count of positions not listed', async ({ page }) => {
    await page.goto(`${ROUTE}?g=A2&k=1&c=n&s=12345678901234567890,0`);
    await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
    await settled(page);
    // The positions on the line are shortened (the tool's own test checks this) ...
    await expect(out(page, 'string-position').first()).toContainText('x 10^19 (20 digits)');
    // ... and so must be the length and the count of positions between the two ends, each a value of 20 digits.
    const length = (await out(page, 'string-length').innerText()).trim();
    const gap = (await out(page, 'string-gap').innerText()).trim();
    expect({ length, gap }).toEqual({ length: '1.2345... x 10^19 (20 digits)', gap: expect.stringContaining('x 10^19 (20 digits)') });
    // The exact digits stay in the hook and the tooltip (4.0).
    await expect(out(page, 'string-length')).toHaveAttribute('data-value', '12345678901234567891');
    await expect(out(page, 'string-length')).toHaveAttribute('title', '12345678901234567891');
    await expect(out(page, 'string-gap')).toHaveAttribute('data-value', '12345678901234567889');
    await expect(out(page, 'string-gap')).toHaveAttribute('title', '12345678901234567889');
  });
});
