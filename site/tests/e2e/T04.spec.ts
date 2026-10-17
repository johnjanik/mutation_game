// P2-A3: tool T4, the Classification Lab, against the built site (SPEC 4 T4, 4.0, 2.11, 2.12, 5.5, 5.6,
// 6.1, 6.6, 7.4 to 7.6, E-9). Cases are opened by bare query parameters on /tools/lab/ (6.6: every state
// is a link) or through the editor's controls. Tests read only the hooks of 4.0, the live region and,
// where a criterion is about the address bar, the clipboard or a download, those. Golden values are
// read from reference/golden_data.json at test time, never typed.
//
// Hooks read:
//   root:     data-tool="lab", data-moves, data-hydrated="true"
//   editor:   data-editor, data-road-style ("dynkin" or "roads"), data-nodes (the count), data-selected
//   buttons:  data-node (label), data-board, data-value, data-can-act ("true"), data-selected,
//             data-marked, data-xy (the node's grid point, "x,y"), inside [data-board-group]
//   table:    data-table-node (A-10), data-row
//   live:     [data-live] (ToolFrame's polite live region)
// data-out names (every one T4 renders; the registry's `outs`):
//   nodeCount, kind (data-kind), verdictClass, verdictName (data-name: the plain name), componentNodes,
//   bourbakiOrder, marks, comarks, balanced, weights, spectralRadius, nonfiniteSubboard (data-nodes,
//   data-class), rootCount, layerCounts (data-counts: the complete layers, data-complete-layers),
//   completeCount, stopMessage, counterStatus, counterNotice, hunterResult (data-population, data-word,
//   data-moves, data-start), linkNotice, editorSubject, editorMarked, editorReason; from ToolFrame:
//   caption, notice, noscript, exportNotice
// data-control names: addNode, removeNode, move-left, move-right, move-up, move-down, roadsOther,
//   roadsOut, roadsBack, picker, loadPreset, keepCounting, hunter, undo, redo, reset, copyLink,
//   downloadData
// Editor keys on a focused node: arrows and Home/End move the focus (A-1); Enter or Space selects;
//   Ctrl+arrow moves the node by one grid point; Delete removes it; + adds a node; u and r undo and redo.
//
// Properties of T4 beyond the common ones of 4.0 Configuration (id, board, coords, start, moves,
// linkTo, prediction, preset, caption, layers):
//   boardPresets: EditorPreset[]   the test boards for the picker (testBoardPresets(), build time)
//   hunter: boolean                the conjecture hunter switched on (the preset hunter sets it)
// coords, start, moves, linkTo and prediction are accepted and unused (T4 plays no game).
import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { copiedLink, downloadData, openForExport, safeAsStrings, unsafeNumbers } from './exportIntegers';

const ROUTE = 'tools/lab/';
const ONE_WAY = 'has a one-way road: the theory does not apply';
const NOTICE = 'The link could not be read, so the tool shows its default state.';

interface Golden {
  types: Record<string, { cartan: number[][]; symmetrizer: number[]; n_roots: number }>;
  twisted_affine: { name: string; marks: number[]; comarks: number[]; symmetrizer: number[]; cartan: number[][] }[];
  classification_tests: { label: string; cartan: number[][]; spectral_radius_4_decimals: string | null }[];
  layer_growth_examples: {
    label: string;
    new_per_layer: number[];
    root_populations_found: number;
    stop_at_2000: { positions: number; complete_layers: number; positions_in_complete_layers: number };
    stop_at_100000: { positions: number; complete_layers: number; positions_in_complete_layers: number };
  }[];
  one_way_counterexample: { cartan: number[][]; start: number[]; moves: number[]; result: number[] };
}
const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url)), 'utf8')) as Golden;
const testCartan = (label: string): number[][] => golden.classification_tests.find((t) => t.label === label)!.cartan;
const growth = (label: string) => golden.layer_growth_examples.find((r) => r.label === label)!;
const cartanParam = (C: number[][]): string => `c:${C.map((r) => r.join(',')).join(';')}`;

const root = (page: Page): Locator => page.locator('[data-tool="lab"]');
const editor = (page: Page): Locator => root(page).locator('[data-editor]');
const nodes = (page: Page): Locator => root(page).locator('[data-board-group] button[data-node]');
const node = (page: Page, label: number): Locator => root(page).locator(`[data-board-group] button[data-node="${label}"]`);
const out = (page: Page, name: string): Locator => root(page).locator(`[data-out="${name}"]`);
const control = (page: Page, name: string): Locator => root(page).locator(`[data-control="${name}"]`);

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`${ROUTE}${query ? `?z=1&${query}` : ''}`);
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
  await expect(control(page, 'loadPreset')).toBeEnabled();
}

async function labelsShown(page: Page): Promise<number[]> {
  const list = nodes(page);
  const n = await list.count();
  const out: number[] = [];
  for (let k = 0; k < n; k++) out.push(Number(await list.nth(k).getAttribute('data-node')));
  return out.sort((a, b) => a - b);
}

/** Presses Tab (or Shift+Tab) until the focused element matches the selector; keyboard only. */
async function tabTo(page: Page, selector: string, back = false): Promise<void> {
  for (let k = 0; k < 120; k++) {
    if (await page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector)) return;
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
  }
  throw new Error(`could not reach ${selector} with the Tab key`);
}

/** Loads a picker entry by its id through the select and the Load button. */
async function pick(page: Page, id: string): Promise<void> {
  await control(page, 'picker').selectOption(id);
  await control(page, 'loadPreset').click();
}

async function verdictTexts(page: Page): Promise<string[]> {
  return out(page, 'verdictClass').allTextContents();
}

test('the default state shows balanced with weights 1, 1, 1', async ({ page }) => {
  await open(page);
  await expect(out(page, 'verdictClass')).toHaveText('finite');
  await expect(out(page, 'verdictName')).toHaveAttribute('data-name', 'A3');
  await expect(out(page, 'balanced')).toHaveText('balanced');
  await expect(out(page, 'weights')).toHaveText(golden.types.A3!.symmetrizer.join(', '));
  await expect(out(page, 'rootCount')).toHaveText(String(golden.types.A3!.n_roots));
  await expect(out(page, 'stopMessage')).toHaveCount(0);
  await pick(page, 'G2');
  await expect(out(page, 'verdictName')).toHaveAttribute('data-name', 'G2');
  await expect(out(page, 'weights')).toHaveText(golden.types.G2!.symmetrizer.join(', '));
  // D19: the rank-2 board is shown as B2 = C2 whichever name the picker used.
  await pick(page, 'C2');
  await expect(out(page, 'verdictName')).toHaveAttribute('data-name', 'B2');
  await expect(out(page, 'verdictName')).toHaveText('B2 = C2');
  await expect.poll(() => page.evaluate(() => location.search)).toContain('g=C2');
});

test('the triangle is drawn by keyboard only and the verdict reads affine A2~', async ({ page }) => {
  await open(page);
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  // Into the board (one tab stop), node 1, Enter selects it.
  await tabTo(page, '[data-tool="lab"] [data-board-group] button');
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(editor(page)).toHaveAttribute('data-selected', '1');
  await tabTo(page, '[data-tool="lab"] [data-control="roadsOther"]');
  await page.keyboard.press('3');
  await tabTo(page, '[data-tool="lab"] [data-control="roadsOut"]');
  await page.keyboard.press('1');
  await expect(editor(page)).toHaveAttribute('data-road-style', 'roads');
  await expect(out(page, 'verdictClass')).toHaveText(ONE_WAY);
  await tabTo(page, '[data-tool="lab"] [data-control="roadsBack"]');
  await page.keyboard.press('1');
  await expect(out(page, 'verdictClass')).toHaveText('affine');
  await expect(out(page, 'verdictName')).toHaveAttribute('data-name', 'A2~');
  await expect(out(page, 'marks')).toHaveText('1, 1, 1');
  await expect(out(page, 'comarks')).toHaveText('1, 1, 1');
  await expect(editor(page)).toHaveAttribute('data-road-style', 'dynkin');
  await expect(root(page).locator('[data-live]')).toContainText('affine');
});

test('every editor action has a key or button equivalent', async ({ page }) => {
  await open(page);
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  // Buttons: add a node, move it one grid point, remove it, choose a preset.
  await tabTo(page, '[data-tool="lab"] [data-control="addNode"]');
  await page.keyboard.press('Enter');
  await expect(editor(page)).toHaveAttribute('data-nodes', '4');
  await expect(editor(page)).toHaveAttribute('data-selected', '4');
  const before = (await node(page, 4).getAttribute('data-xy'))!.split(',').map(Number);
  await tabTo(page, '[data-tool="lab"] [data-control="move-up"]');
  await page.keyboard.press('Enter');
  await expect(node(page, 4)).toHaveAttribute('data-xy', `${before[0]},${before[1]! + 1}`);
  await tabTo(page, '[data-tool="lab"] [data-control="removeNode"]', true);
  await page.keyboard.press('Enter');
  await expect(editor(page)).toHaveAttribute('data-nodes', '3');
  await tabTo(page, '[data-tool="lab"] [data-control="picker"]');
  await page.keyboard.press('G');
  await tabTo(page, '[data-tool="lab"] [data-control="loadPreset"]');
  await page.keyboard.press('Enter');
  await expect(out(page, 'verdictName')).toHaveAttribute('data-name', 'G2');
  await expect(editor(page)).toHaveAttribute('data-nodes', '2');
  // Keys on a focused node: + adds, Ctrl+arrow moves, Delete removes, u undoes, r redoes.
  await tabTo(page, '[data-tool="lab"] [data-board-group] button', true);
  await page.keyboard.press('+');
  await expect(editor(page)).toHaveAttribute('data-nodes', '3');
  await page.keyboard.press('End');
  await expect(page.locator(':focus')).toHaveAttribute('data-node', '3');
  const p3 = (await node(page, 3).getAttribute('data-xy'))!.split(',').map(Number);
  await page.keyboard.press('Control+ArrowUp');
  await expect(node(page, 3)).toHaveAttribute('data-xy', `${p3[0]},${p3[1]! + 1}`);
  await page.keyboard.press('Delete');
  await expect(editor(page)).toHaveAttribute('data-nodes', '2');
  await page.keyboard.press('u');
  await expect(editor(page)).toHaveAttribute('data-nodes', '3');
  await page.keyboard.press('r');
  await expect(editor(page)).toHaveAttribute('data-nodes', '2');
  // The bare arrows move the focus between nodes and never move a node.
  const xy = await node(page, 1).getAttribute('data-xy');
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator(':focus')).toHaveAttribute('data-node', '2');
  await expect(node(page, 1)).toHaveAttribute('data-xy', xy!);
});

test('the hunter preset shows roads style, the one-way sentence, no spectral radius and the mixed population', async ({ page }) => {
  const ce = golden.one_way_counterexample;
  // The preset's board is a link (4.0 Configuration); the hunter switch is a view option outside schema 1.
  await open(page, `g=${cartanParam(ce.cartan)}@0,0;1,0`);
  await control(page, 'hunter').check();
  await expect(editor(page)).toHaveAttribute('data-road-style', 'roads');
  await expect(out(page, 'verdictClass')).toHaveText(ONE_WAY);
  await expect(out(page, 'verdictName')).toHaveCount(0);
  await expect(out(page, 'spectralRadius')).toHaveCount(0);
  await expect(out(page, 'nonfiniteSubboard')).toHaveCount(0);
  const h = out(page, 'hunterResult');
  await expect(h).toHaveAttribute('data-population', ce.result.join(','));
  await expect(h).toHaveAttribute('data-word', ce.moves.join(','));
  await expect(h).toHaveAttribute('data-moves', String(ce.moves.length));
  await expect(h).toContainText(`after ${ce.moves.length} moves`);
  await expect(h).toContainText('−1, 1');
  // The counter still runs on a one-way board, cut by the layer bound.
  await expect(out(page, 'stopMessage')).toHaveText('stopped after 40 layers');
});

test('keep counting on the star with five arms reports both stop sentences', async ({ page }) => {
  const rec = growth('star with five arms');
  await open(page, `g=${cartanParam(testCartan('star with five arms'))}`);
  await expect(out(page, 'verdictClass')).toHaveText('indefinite');
  await expect(out(page, 'stopMessage')).toHaveText(`stopped after ${rec.stop_at_2000.positions} positions; layers 0 to ${rec.stop_at_2000.complete_layers} are complete`);
  await expect(out(page, 'completeCount')).toHaveText(String(rec.stop_at_2000.positions_in_complete_layers));
  await expect(out(page, 'layerCounts')).toHaveAttribute('data-counts', rec.new_per_layer.slice(0, rec.stop_at_2000.complete_layers + 1).join(','));
  await expect(out(page, 'spectralRadius')).toHaveText(golden.classification_tests.find((t) => t.label === 'star with five arms')!.spectral_radius_4_decimals!);
  await expect(out(page, 'nonfiniteSubboard')).toHaveAttribute('data-class', 'affine');
  await control(page, 'keepCounting').click();
  await expect(out(page, 'stopMessage')).toHaveText(
    `stopped after ${rec.stop_at_100000.positions} positions; layers 0 to ${rec.stop_at_100000.complete_layers} are complete`,
    { timeout: 60000 },
  );
  await expect(out(page, 'completeCount')).toHaveText(String(rec.stop_at_100000.positions_in_complete_layers));
  await expect(out(page, 'rootCount')).toHaveText(String(rec.stop_at_100000.positions));
  await expect(control(page, 'keepCounting')).toHaveCount(0);
  // The verdict never changed: the cap says nothing about the class (4.0).
  await expect(out(page, 'verdictClass')).toHaveText('indefinite');
});

test('the worker script is requested only after keep counting', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (r) => {
    if (/engine\.worker/.test(r.url())) requested.push(r.url());
  });
  await open(page, `g=${cartanParam(testCartan('star with five arms'))}`);
  await page.waitForLoadState('networkidle');
  await control(page, 'hunter').check();
  await pick(page, 'A2~');
  await pick(page, 'test:star with five arms');
  await page.waitForLoadState('networkidle');
  expect(requested).toEqual([]);
  await control(page, 'keepCounting').click();
  await expect.poll(() => requested.length, { timeout: 30000 }).toBe(1);
  await expect(control(page, 'keepCounting')).toHaveCount(0, { timeout: 60000 });
});

test('the triangle preset reports stopped after 40 layers with 243 root populations and 6 new per layer', async ({ page }) => {
  const tri = growth('triangle');
  await open(page);
  await pick(page, 'A2~');
  await expect(out(page, 'verdictName')).toHaveAttribute('data-name', 'A2~');
  await expect(out(page, 'stopMessage')).toHaveText('stopped after 40 layers');
  await expect(out(page, 'rootCount')).toHaveText(String(tri.root_populations_found));
  await expect(out(page, 'layerCounts')).toHaveAttribute('data-counts', tri.new_per_layer.join(','));
  const counts = (await out(page, 'layerCounts').getAttribute('data-counts'))!.split(',').map(Number);
  expect(counts.length).toBe(41);
  expect(counts[0]).toBe(3);
  expect(counts.slice(1).every((c) => c === 6)).toBe(true);
  await expect(control(page, 'keepCounting')).toHaveCount(0);
  await control(page, 'hunter').check();
  await expect(out(page, 'hunterResult')).toHaveText(`none among the ${tri.root_populations_found} root populations of the first 40 layers`);
});

test('a twisted affine preset from the picker shows affine, its name, marks and comarks, and labels from 0', async ({ page }) => {
  await open(page);
  for (const name of ['A2^(2)', 'D4^(3)']) {
    const rec = golden.twisted_affine.find((t) => t.name === name)!;
    const n = rec.cartan.length;
    await pick(page, name);
    await expect(out(page, 'nodeCount')).toHaveText(String(n));
    expect(await labelsShown(page)).toEqual(Array.from({ length: n }, (_, k) => k));
    await expect(out(page, 'verdictClass')).toHaveText('affine');
    await expect(out(page, 'verdictName')).toHaveAttribute('data-name', name);
    await expect(out(page, 'verdictName')).toHaveText(name.replace('^', ''));
    await expect(out(page, 'marks')).toHaveText(rec.marks.join(', '));
    await expect(out(page, 'comarks')).toHaveText(rec.comarks.join(', '));
    await expect(out(page, 'weights')).toHaveText(rec.symmetrizer.join(', '));
  }
});

test('a custom board round-trips through the link as g=c:rows@xy', async ({ page }) => {
  await open(page);
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  await tabTo(page, '[data-tool="lab"] [data-control="addNode"]');
  await page.keyboard.press('Enter');
  await tabTo(page, '[data-tool="lab"] [data-control="roadsOut"]');
  await page.keyboard.press('2');
  await expect(editor(page)).toHaveAttribute('data-nodes', '4');
  await expect.poll(() => page.evaluate(() => location.search), { timeout: 3000 }).toMatch(/g=c:[-0-9,;]+@[0-9,;]+/);
  const url = page.url();
  const search = new URL(url).searchParams.get('g')!;
  expect(search.startsWith('c:')).toBe(true);
  const labels = await labelsShown(page);
  const verdict = await verdictTexts(page);
  const xy = await nodes(page).evaluateAll((bs) => bs.map((b) => b.getAttribute('data-xy')));
  const fresh = await page.context().newPage();
  await fresh.goto(url);
  await expect(root(fresh)).toHaveAttribute('data-hydrated', 'true');
  await expect(out(fresh, 'nodeCount')).toHaveText('4');
  expect(await labelsShown(fresh)).toEqual(labels);
  expect(await verdictTexts(fresh)).toEqual(verdict);
  expect(await nodes(fresh).evaluateAll((bs) => bs.map((b) => b.getAttribute('data-xy')))).toEqual(xy);
  await expect(out(fresh, 'notice')).toHaveCount(0);
});

test('an unreadable link shows the notice and the default state', async ({ page }) => {
  const thirteen = Array.from({ length: 13 }, (_, i) => Array.from({ length: 13 }, (_, j) => (i === j ? 2 : Math.abs(i - j) === 1 ? -1 : 0)));
  for (const g of ['c:2,-1;-1', cartanParam(thirteen)]) {
    await open(page, `g=${g}`);
    await expect(out(page, 'notice')).toHaveText(NOTICE);
    await expect(out(page, 'nodeCount')).toHaveText('3');
    await expect(out(page, 'verdictName')).toHaveAttribute('data-name', 'A3');
  }
});

test('copy link on the densest twelve-node board writes a g that opens the same board', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (t: string) => {
          (window as unknown as { __copied: string }).__copied = t;
        },
      },
    });
  });
  const n = 12;
  const C = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 2 : -4)));
  const xy = [[10, 10], [10, 11], [11, 10], [11, 11], [10, 9], [11, 9], [9, 10], [9, 11], [10, 8], [11, 8], [8, 10], [8, 11]];
  await open(page, `g=${cartanParam(C)}@${xy.map((p) => p.join(',')).join(';')}`);
  await expect(out(page, 'nodeCount')).toHaveText('12');
  await control(page, 'copyLink').click();
  const copied = await page.evaluate(() => (window as unknown as { __copied?: string }).__copied ?? '');
  const g = new URL(copied).searchParams.get('g')!;
  expect(g.length).toBeLessThanOrEqual(512);
  expect(g.startsWith('c:')).toBe(true);
  const labels = await labelsShown(page);
  const verdict = await verdictTexts(page);
  const fresh = await page.context().newPage();
  await fresh.goto(copied);
  await expect(root(fresh)).toHaveAttribute('data-hydrated', 'true');
  await expect(out(fresh, 'nodeCount')).toHaveText('12');
  expect(await labelsShown(fresh)).toEqual(labels);
  expect(await verdictTexts(fresh)).toEqual(verdict);
  await expect(out(fresh, 'notice')).toHaveCount(0);
  await expect(out(fresh, 'linkNotice')).toHaveCount(0);
});

test('undo, redo and reset act on the edit history', async ({ page }) => {
  await open(page);
  await control(page, 'addNode').click();
  await expect(out(page, 'nodeCount')).toHaveText('4');
  const afterAdd = await verdictTexts(page);
  // The new node 4 is the subject; join it to node 1 one way, then both ways (the path A4).
  await control(page, 'roadsOther').selectOption({ label: '1' });
  await control(page, 'roadsOut').selectOption('1');
  await expect(out(page, 'verdictClass')).toHaveText(ONE_WAY);
  await control(page, 'roadsBack').selectOption('1');
  await expect(out(page, 'verdictName')).toHaveAttribute('data-name', 'A4');
  await control(page, 'undo').click();
  await expect(out(page, 'verdictClass')).toHaveText(ONE_WAY);
  await control(page, 'undo').click();
  expect(await verdictTexts(page)).toEqual(afterAdd);
  await expect(out(page, 'nodeCount')).toHaveText('4');
  await control(page, 'redo').click();
  await expect(out(page, 'verdictClass')).toHaveText(ONE_WAY);
  await control(page, 'redo').click();
  await expect(out(page, 'verdictName')).toHaveAttribute('data-name', 'A4');
  await control(page, 'reset').click();
  await expect(out(page, 'nodeCount')).toHaveText('3');
  await expect(out(page, 'verdictName')).toHaveAttribute('data-name', 'A3');
});

test('download data gives JSON with the state, the verdict records in labels, the weights, the spectral radius, the layer counts, the stop sentence and the hunter result', async ({ page }) => {
  const ce = golden.one_way_counterexample;
  await open(page, `g=${cartanParam(ce.cartan)}@0,0;1,0`);
  await control(page, 'hunter').check();
  const [d1] = await Promise.all([page.waitForEvent('download'), control(page, 'downloadData').click()]);
  const one = JSON.parse(readFileSync((await d1.path())!, 'utf8'));
  expect(one.tool).toBe('lab');
  expect(one.state.board).toEqual({ cartan: ce.cartan, xy: [[0, 0], [1, 0]] });
  expect(typeof one.engineVersion).toBe('string');
  expect(typeof one.commit).toBe('string');
  expect(one.derived.verdict).toHaveLength(1);
  expect(one.derived.verdict[0].nodes).toEqual([1, 2]);
  expect(one.derived.verdict[0].kind).toBe('one-way');
  expect(one.derived.weights).toBeNull();
  expect(one.derived.spectralRadius).toBeNull();
  expect(one.derived.rootCounter.stopMessage).toBe('stopped after 40 layers');
  expect(one.derived.rootCounter.layerCounts.length).toBe(41);
  expect(one.derived.hunter.population).toEqual(ce.result);
  expect(one.derived.hunter.word).toEqual(ce.moves);

  const rec = growth('star with five arms');
  await open(page, `g=${cartanParam(testCartan('star with five arms'))}`);
  const [d2] = await Promise.all([page.waitForEvent('download'), control(page, 'downloadData').click()]);
  const star = JSON.parse(readFileSync((await d2.path())!, 'utf8'));
  expect(star.derived.verdict[0].nodes).toEqual(testCartan('star with five arms').map((_, k) => k + 1));
  expect(star.derived.verdict[0].class).toBe('indefinite');
  expect(star.derived.spectralRadius).toBe(golden.classification_tests.find((t) => t.label === 'star with five arms')!.spectral_radius_4_decimals);
  expect(star.derived.weights).toEqual(testCartan('star with five arms').map(() => 1)); // safe integers are JSON numbers (6.6; P3-RT-04-05)
  expect(star.derived.rootCounter.stopMessage).toBe(`stopped after ${rec.stop_at_2000.positions} positions; layers 0 to ${rec.stop_at_2000.complete_layers} are complete`);
  expect(star.derived.rootCounter.positionsInCompleteLayers).toBe(rec.stop_at_2000.positions_in_complete_layers);
  expect(star.derived.hunter).toBeNull();
});

test('every node button carries data-node, data-board, data-value and data-can-act; the root carries data-tool="lab" and data-moves', async ({ page }) => {
  for (const q of ['', 'g=D4~', `g=${cartanParam(testCartan('one-way road'))}`]) {
    await open(page, q);
    await expect(root(page)).toHaveAttribute('data-moves', '0');
    const list = nodes(page);
    const n = await list.count();
    expect(n).toBeGreaterThan(0);
    for (let k = 0; k < n; k++) {
      const b = list.nth(k);
      await expect(b).toHaveAttribute('data-node', /^\d+$/);
      await expect(b).toHaveAttribute('data-board', 'populations');
      await expect(b).toHaveAttribute('data-value', '');
      await expect(b).toHaveAttribute('data-can-act', 'true');
    }
    await expect(editor(page)).toHaveAttribute('data-nodes', String(n));
  }
});

test('/tools/lab has no serious or critical axe violations', async ({ page }) => {
  for (const q of ['', `g=${cartanParam(testCartan('star with five arms'))}`]) {
    await open(page, q);
    await control(page, 'hunter').check();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    const serious = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => ({ id: v.id, nodes: v.nodes.map((x) => x.target.join(' ')) }));
    expect(serious).toEqual([]);
  }
});

test('at 320 pixels the page does not scroll sideways, every control is reachable and node targets are at least 24 pixels', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  // Twelve nodes in a row spanning all 12 grid columns: u = floor((320 - 16) / 12) = 25.
  const n = 12;
  const C = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 2 : Math.abs(i - j) === 1 ? -1 : 0)));
  const xy = Array.from({ length: n }, (_, k) => `${k},0`).join(';');
  for (const q of ['', `g=${cartanParam(C)}@${xy}`, `g=${cartanParam(testCartan('E10: the E8 path extended by two nodes'))}`]) {
    await open(page, q);
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(scroll, q).toBeLessThanOrEqual(0);
    const sizes = await nodes(page).evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect()).map((r) => Math.min(r.width, r.height)));
    for (const s of sizes) expect(s, q).toBeGreaterThanOrEqual(24);
    if (q.includes('@')) expect(Math.min(...sizes)).toBeLessThan(44);
    else if (q !== '') expect(Math.min(...sizes)).toBeGreaterThanOrEqual(44);
    for (const name of ['addNode', 'removeNode', 'move-up', 'roadsOther', 'roadsOut', 'roadsBack', 'picker', 'loadPreset', 'hunter', 'copyLink']) {
      const c = control(page, name);
      await c.scrollIntoViewIfNeeded();
      const box = (await c.boundingBox())!;
      expect(box.x, `${name} ${q}`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${name} ${q}`).toBeLessThanOrEqual(320);
      expect(Math.min(box.width, box.height), name).toBeGreaterThanOrEqual(24);
    }
  }
});

test('show as table lists one row per node with a button each', async ({ page }) => {
  await open(page, 'g=D4~');
  await root(page).locator('details summary').click();
  const rows = root(page).locator('tr[data-row]');
  await expect(rows).toHaveCount(5);
  for (const l of [0, 1, 2, 3, 4]) await expect(root(page).locator(`button[data-table-node="${l}"]`)).toHaveCount(1);
  await root(page).locator('button[data-table-node="2"]').click();
  await expect(editor(page)).toHaveAttribute('data-selected', '2');
  await expect(page.locator(':focus')).toHaveAttribute('data-node', '2');
});

// ---------------------------------------------------------------------------------------------
// Regressions
// ---------------------------------------------------------------------------------------------

test.describe('regressions', () => {
  // regression: P3-RT-04-05
  test('export of the default state: integer rule, engine version, commit, state agrees with Copy link', async ({ page }) => {
    await openForExport(page, 'tools/lab/');
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
});
