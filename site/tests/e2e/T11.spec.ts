// P4-A4: tool T11, the Folding Bench, against the built site (SPEC.md 4 T11, 2.13, 4.0, 6.6, 7.4, 7.5).
// Cases are opened by bare query parameters on /tools/fold/ (6.6: every state is a link) or through the
// tool's controls. Tests read only the hooks of 4.0 and the live region (and, where a criterion is about
// the address bar, the clipboard or a download, those). Expected values are computed here in Node from
// the engine or read from reference/golden_data.json; the only values typed are the worked values of the
// instruction (section 5.6), each checked against the engine first.
//
// Hooks read:
//   root:     data-tool="fold", data-moves, data-hydrated="true"
//   buttons:  data-node, data-board ("numbers" | "populations"), data-value, data-can-act
//   tabs:     data-tab ("fold" | "average"), aria-selected
//   table:    data-table-board ("big" | "folded"), data-table-node (the A-10 table's buttons)
//   legend:   data-orbit (labels joined by commas), data-folded-label (inside data-out="orbits")
//   classes:  data-class (rows of data-out="averaged-classes")
//   live:     [data-live] (ToolFrame's polite live region)
// data-out names (every one T11 renders; the registry's `outs`):
//   caption, notice, noscript, exportNotice (ToolFrame); moveCounter, historyStrip, historyCounter
//   (History.svelte); predictResult, predictReveal (Predict.svelte);
//   symmetry (the symmetry as orbits with its order), construction (the construction each tab shows),
//   big-board, folded-board (the containers of the two boards), folded-name (data-name), folded-name-note
//   (B2 = C2, D19), fold-message (the board does not fold), orbits (the legend), averaged-name
//   (data-name), averaged-name-note (B2 = C2, D19), averaged-classes (the table of length classes)
// data-control names: picker, symmetry, view, tab; undo, redo, reset, historySlider (History.svelte);
//   copyLink, downloadData (ToolFrame); data-export="svg" | "png" (ToolFrame); predictAnswer,
//   predictCheck, predictShow (Predict.svelte)
//
// Properties of T11 beyond the common ones of 4.0 Configuration (id, board, coords, start, moves,
// prediction, preset, caption): symmetry (images of all nodes in label order), view ('populations' |
// 'numbers'). linkTo and layers are accepted and ignored. preset: 'default' | 'fold' | 'average'.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyWord, boardFromName, fold, toPositions } from '../../../packages/engine/src/index';
import type { Board, Game } from '../../../packages/engine/src/index';
import { ssrLoader } from '../unit/_svelteSsr';

interface FoldingRow {
  type: string;
  symmetry: number[];
  folds_to: string | null;
  folded_orbits_in_bourbaki_order: number[][] | null;
  averaged_roots_type: string;
  averaged_root_classes: { class: string; roots: number; form_value: string }[];
}
const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url)), 'utf8')) as { folding: FoldingRow[] };
const row = (type: string, symmetry: number[]): FoldingRow => {
  const hits = golden.folding.filter((r) => r.type === type && r.symmetry.join('.') === symmetry.join('.'));
  if (hits.length !== 1) throw new Error(`${hits.length} folding rows for ${type} ${symmetry.join('.')}`);
  return hits[0]!;
};

const ROUTE = 'tools/fold/';
const NOTICE = 'The link could not be read, so the tool shows its default state.';
const PHRASE = 'an orbit contains an edge';

const root = (page: Page): Locator => page.locator('[data-tool="fold"]');
const out = (page: Page, name: string): Locator => root(page).locator(`[data-out="${name}"]`);
const control = (page: Page, name: string): Locator => root(page).locator(`[data-control="${name}"]`);
const live = (page: Page): Locator => root(page).locator('[data-live]');
const bigNodes = (page: Page): Locator => out(page, 'big-board').locator('button[data-node]');
const foldedNodes = (page: Page): Locator => out(page, 'folded-board').locator('button[data-node]');
const bigNode = (page: Page, label: number): Locator => out(page, 'big-board').locator(`button[data-node="${label}"]`);
const foldedNode = (page: Page, label: number): Locator => out(page, 'folded-board').locator(`button[data-node="${label}"]`);

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`${ROUTE}${query ? `?${query}` : ''}`);
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
}

/** The values of a board's buttons in label order (data-node increasing). */
async function valuesOf(nodes: Locator): Promise<string[]> {
  const pairs: [number, string][] = [];
  for (const b of await nodes.all()) pairs.push([Number(await b.getAttribute('data-node')), (await b.getAttribute('data-value')) ?? '']);
  return pairs.sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

// The engine in Node: the expected values of each case. Labels and positions are converted only by
// toPositions on the board concerned (E-7), never by adding or subtracting 1.
const B = (name: string): Board<number> => boardFromName(name) as Board<number>;
/** The positions of a board's nodes in label order (the order of `s`, `y` and of valuesOf). */
const labelOrderPositions = (board: Board<number>): number[] => toPositions(board, [...board.labels].sort((a, b) => a - b));
/** A symmetry given as the images of all nodes in label order (6.6 `y`), as positions. */
function symmetryInPositions(board: Board<number>, images: number[]): number[] {
  const to = toPositions(board, images);
  const sigma: number[] = new Array<number>(board.n);
  labelOrderPositions(board).forEach((p, k) => (sigma[p] = to[k]!));
  return sigma;
}
/** Both boards after symmetric moves on the orbits containing the given labels, from a symmetric start (label order). */
function expected(name: string, images: number[], start: number[], labels: number[], game: Game): { big: string[]; folded: string[]; foldedName: string | null } {
  const board = B(name);
  const r = fold(board, symmetryInPositions(board, images));
  const orbitOf = (l: number): number => r.orbits.findIndex((o) => o.includes(toPositions(board, [l])[0]!));
  const word = labels.flatMap((l) => r.orbits[orbitOf(l)]!);
  const v0: number[] = new Array<number>(board.n);
  labelOrderPositions(board).forEach((p, k) => (v0[p] = start[k]!));
  const after = applyWord(board, v0, word, game);
  const big = labelOrderPositions(board).map((p) => String(after[p]));
  if (r.folded === null) return { big, folded: [], foldedName: null };
  const f = r.folded;
  const small = applyWord(f, r.orbits.map((o) => v0[o[0]!]!), labels.map(orbitOf), game);
  const inLabels = labelOrderPositions(f).map((s) => String(small[s]));
  return { big, folded: inLabels, foldedName: f.name ?? null };
}

test('A3 with the flip folds to B2, and one symmetric move changes nodes 1 and 3 and the folded node 1 alike', async ({ page }) => {
  const e = expected('A3', [3, 2, 1], [1, 1, 1], [1], 'firing');
  expect(e.big).toEqual(['-1', '3', '-1']);
  expect(e.folded).toEqual(['-1', '3']);
  await open(page);
  await expect(out(page, 'folded-name')).toHaveText(row('A3', [3, 2, 1]).folds_to!);
  await expect(out(page, 'folded-name')).toHaveText('B2');
  await expect(out(page, 'folded-name-note')).toHaveText('B2 = C2');
  await expect(live(page)).toHaveText('');
  await bigNode(page, 1).click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  expect(await valuesOf(bigNodes(page))).toEqual(e.big);
  expect(await valuesOf(foldedNodes(page))).toEqual(e.folded);
  await expect(live(page)).toHaveText('Fired nodes 1 and 3. Numbers now minus 1, 3, minus 1. Move 1.');
  // Acting on the folded board's node makes the same kind of move (on the orbit {2}).
  await foldedNode(page, 2).click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  const e2 = expected('A3', [3, 2, 1], [1, 1, 1], [1, 2], 'firing');
  expect(await valuesOf(bigNodes(page))).toEqual(e2.big);
  expect(await valuesOf(foldedNodes(page))).toEqual(e2.folded);
});

test('D4 with the rotation folds to G2 drawn in Bourbaki order', async ({ page }) => {
  const e = expected('D4', [3, 2, 4, 1], [1, 1, 1, 1], [1], 'firing');
  expect(e.big).toEqual(['-1', '4', '-1', '-1']);
  expect(e.folded).toEqual(['4', '-1']);
  await open(page, 'g=D4&y=3.2.4.1');
  await expect(out(page, 'folded-name')).toHaveText(row('D4', [3, 2, 4, 1]).folds_to!);
  await expect(foldedNodes(page)).toHaveCount(2);
  expect((await foldedNodes(page).evaluateAll((bs) => bs.map((b) => b.getAttribute('data-node')))).sort()).toEqual(['1', '2']);
  // Node 1 is drawn left of node 2 (6.1: node i at (i, 0)).
  const x1 = (await foldedNode(page, 1).boundingBox())!.x;
  const x2 = (await foldedNode(page, 2).boundingBox())!.x;
  expect(x1).toBeLessThan(x2);
  await bigNode(page, 1).click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  expect(await valuesOf(bigNodes(page))).toEqual(e.big);
  await expect(foldedNode(page, 2)).toHaveAttribute('data-value', '-1');
  await expect(foldedNode(page, 1)).toHaveAttribute('data-value', '4');
  await expect(live(page)).toHaveText('Fired nodes 1, 3 and 4. Numbers now minus 1, 4, minus 1, minus 1. Move 1.');
});

test('E6 with the flip folds to F4', async ({ page }) => {
  const r = row('E6', [6, 2, 5, 4, 3, 1]);
  await open(page, 'g=E6&y=6.2.5.4.3.1');
  await expect(out(page, 'folded-name')).toHaveText(r.folds_to!);
  const items = out(page, 'orbits').locator('li');
  await expect(items).toHaveCount(4);
  const legend = await items.evaluateAll((lis) => lis.map((li) => [li.getAttribute('data-folded-label'), li.getAttribute('data-orbit')]));
  expect(legend).toEqual(r.folded_orbits_in_bourbaki_order!.map((o, k) => [String(k + 1), o.join(',')]));
  expect(legend).toEqual([['1', '1,6'], ['2', '3,5'], ['3', '4'], ['4', '2']]);
  await expect(out(page, 'orbits')).toContainText('{1, 6}');
});

test('D5 with the swap folds to C4', async ({ page }) => {
  await open(page, 'g=D5');
  await expect(control(page, 'symmetry')).toHaveValue('1.2.3.5.4');
  await expect(out(page, 'folded-name')).toHaveText(row('D5', [1, 2, 3, 5, 4]).folds_to!);
  // The caption follows the state: the route's preset caption is for A3, this is D5.
  await expect(out(page, 'caption')).toContainText('Folding D5 by this symmetry gives the board C4.');
  await expect(foldedNodes(page)).toHaveCount(4);
  // A symmetric move on the orbit {4, 5}: the changed-nodes form of A-4 above four nodes.
  const e = expected('D5', [1, 2, 3, 5, 4], [1, 1, 1, 1, 1], [5], 'firing');
  await bigNode(page, 5).click();
  expect(await valuesOf(bigNodes(page))).toEqual(e.big);
  expect(await valuesOf(foldedNodes(page))).toEqual(e.folded);
  await expect(live(page)).toHaveText(/^Fired nodes 4 and 5\. Node 3 now 3, node 4 now minus 1, node 5 now minus 1\. Move 1\.$/);
});

test('the average tab on A5 shows B3 and C3', async ({ page }) => {
  const r = row('A5', [5, 4, 3, 2, 1]);
  await open(page, 'g=A5');
  await root(page).locator('[data-tab="average"]').click();
  await expect(root(page).locator('[data-tab="average"]')).toHaveAttribute('aria-selected', 'true');
  await expect(out(page, 'averaged-name')).toHaveText(r.averaged_roots_type);
  await expect(out(page, 'averaged-name')).toHaveText('C3');
  await expect(out(page, 'folded-name')).toHaveText(r.folds_to!);
  await expect(out(page, 'folded-name')).toBeVisible();
  await expect(out(page, 'construction')).toHaveText('Restricting the roots (orbit averages)');
  await expect(out(page, 'averaged-name-note')).toHaveCount(0);
  const rows = out(page, 'averaged-classes').locator('tbody tr');
  await expect(rows).toHaveCount(r.averaged_root_classes.length);
});

test('A4 with the flip: the fold tab says an orbit contains an edge and the average tab says BC2', async ({ page }) => {
  const r = row('A4', [4, 3, 2, 1]);
  expect(r.folds_to).toBeNull();
  await open(page, 'g=A4');
  await expect(out(page, 'fold-message')).toContainText(PHRASE);
  await expect(out(page, 'fold-message')).toContainText('{2, 3}');
  await expect(out(page, 'folded-board')).toHaveCount(0);
  await expect(bigNodes(page)).toHaveCount(4);
  for (const b of await bigNodes(page).all()) await expect(b).toHaveAttribute('data-can-act', 'false');
  // A click makes no move; the reader hears why.
  await bigNode(page, 2).click();
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await expect(live(page)).toContainText(PHRASE);
  await root(page).locator('[data-tab="average"]').click();
  await expect(out(page, 'averaged-name')).toHaveText(r.averaged_roots_type);
  await expect(out(page, 'averaged-name')).toHaveText('BC2');
  await expect(out(page, 'averaged-name-note')).toHaveCount(0);
  const rows = out(page, 'averaged-classes').locator('tbody tr');
  await expect(rows).toHaveCount(3);
  for (const [k, c] of r.averaged_root_classes.entries()) {
    await expect(rows.nth(k)).toHaveAttribute('data-class', c.class);
    await expect(rows.nth(k).locator('td')).toHaveText([String(c.roots), c.form_value]);
  }
});

test('on the boards that do not fold the fold tab does not offer symmetric play', async ({ page }) => {
  // A3 folds: the fold tab invites symmetric play.
  await open(page);
  await expect(root(page)).toContainText('Numbers game, symmetric play: one click acts on a whole orbit.');
  // A2, A4, A6 and A8 with their flip (and A4 in the populations view) do not fold: nothing invites it.
  for (const [query, game] of [['g=A2', 'Numbers game'], ['g=A4', 'Numbers game'], ['g=A6', 'Numbers game'], ['g=A8', 'Numbers game'], ['g=A4&v=p', 'Mutation game']] as const) {
    await open(page, query);
    await expect(out(page, 'fold-message'), query).toContainText(PHRASE);
    await expect(root(page), query).not.toContainText('one click acts on a whole orbit');
    await expect(root(page), query).toContainText(`${game}, no symmetric play: the board does not fold by this symmetry.`);
  }
});

test('each tab names its construction', async ({ page }) => {
  await open(page);
  await expect(out(page, 'construction')).toHaveText('Folding the board (orbit sums)');
  await root(page).locator('[data-tab="average"]').click();
  await expect(out(page, 'construction')).toHaveText('Restricting the roots (orbit averages)');
  // The rank 2 averaged name B2 carries the D19 note; the tabs follow the arrow keys.
  await expect(out(page, 'averaged-name')).toHaveText('B2');
  await expect(out(page, 'averaged-name-note')).toHaveText('B2 = C2');
  await root(page).locator('[data-tab="average"]').press('ArrowLeft');
  await expect(root(page).locator('[data-tab="fold"]')).toHaveAttribute('aria-selected', 'true');
  await expect(root(page).locator('[data-tab="fold"]')).toBeFocused();
  await expect(out(page, 'construction')).toHaveText('Folding the board (orbit sums)');
});

test('the symmetry picker lists five symmetries on D4 and changing the board resets start, moves and symmetry', async ({ page }) => {
  await open(page);
  await bigNode(page, 1).click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await control(page, 'picker').selectOption('D4');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await expect(bigNodes(page)).toHaveCount(4);
  expect(await valuesOf(bigNodes(page))).toEqual(['1', '1', '1', '1']);
  await expect(control(page, 'symmetry')).toHaveValue('1.2.4.3');
  const options = control(page, 'symmetry').locator('option');
  await expect(options).toHaveCount(5);
  expect(await options.evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))).toEqual(['1.2.4.3', '3.2.1.4', '3.2.4.1', '4.2.1.3', '4.2.3.1']);
  await expect(out(page, 'folded-name')).toHaveText('C3');
  // The rotation through the picker gives G2.
  await control(page, 'symmetry').selectOption('3.2.4.1');
  await expect(out(page, 'folded-name')).toHaveText('G2');
  await expect(out(page, 'symmetry')).toContainText('{1, 3, 4} {2}, order 3');
});

test('the populations view plays the mutation game on both boards', async ({ page }) => {
  const e = expected('A3', [3, 2, 1], [1, 0, 1], [3], 'mutation');
  expect(e.big).toEqual(['-1', '0', '-1']);
  expect(e.folded).toEqual(['-1', '0']);
  await open(page);
  await control(page, 'view').selectOption('populations');
  await expect(bigNodes(page).first()).toHaveAttribute('data-board', 'populations');
  expect(await valuesOf(bigNodes(page))).toEqual(['1', '0', '1']);
  expect(await valuesOf(foldedNodes(page))).toEqual(['1', '0']);
  await bigNode(page, 3).click();
  expect(await valuesOf(bigNodes(page))).toEqual(e.big);
  expect(await valuesOf(foldedNodes(page))).toEqual(e.folded);
  await expect(live(page)).toHaveText('Mutated cities 1 and 3. Populations now minus 1, 0, minus 1. Move 1.');
  await expect.poll(() => page.evaluate(() => location.search), { timeout: 3000 }).toContain('w=1');
  await expect.poll(() => page.evaluate(() => location.search), { timeout: 3000 }).toContain('v=p');
});

test('an unreadable y loads the default state and shows the notice', async ({ page }) => {
  await open(page, 'g=A3&y=1.3.2');
  await expect(out(page, 'notice')).toHaveText(NOTICE);
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  expect(await valuesOf(bigNodes(page))).toEqual(['1', '1', '1']);
  await expect(out(page, 'folded-name')).toHaveText('B2');
  await expect(control(page, 'symmetry')).toHaveValue('3.2.1');
});

test('a link with v=l shows the notice and the default state, and a link with m=l plays its moves', async ({ page }) => {
  await open(page, 'g=A3&v=l&w=1');
  await expect(out(page, 'notice')).toHaveText(NOTICE);
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  for (const b of await root(page).locator('button[data-node]').all()) await expect(b).toHaveAttribute('data-value', '1');
  await open(page, 'g=A3&m=l&w=1');
  await expect(out(page, 'notice')).toHaveCount(0);
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  expect(await valuesOf(bigNodes(page))).toEqual(['-1', '3', '-1']);
  // The link written back carries no m.
  await control(page, 'undo').click();
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await expect.poll(() => page.evaluate(() => location.search), { timeout: 3000 }).not.toContain('m=');
});

test('keyboard: Enter on a node makes a symmetric move, u undoes it and both boards return to the start', async ({ page }) => {
  await open(page);
  await root(page).locator('[data-tab="fold"]').focus();
  await page.keyboard.press('Tab');
  await expect(bigNode(page, 1)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(bigNode(page, 2)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(bigNode(page, 1)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  expect(await valuesOf(bigNodes(page))).toEqual(['-1', '3', '-1']);
  await page.keyboard.press('u');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  for (const b of await root(page).locator('button[data-node]').all()) await expect(b).toHaveAttribute('data-value', '1');
  await expect(live(page)).toHaveText('Undid move 1. Numbers now 1, 1, 1.');
  // Space on the folded board acts too, and r redoes inside a board.
  await page.keyboard.press('Tab');
  await expect(foldedNode(page, 1)).toBeFocused();
  await page.keyboard.press('Space');
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await page.keyboard.press('u');
  await page.keyboard.press('r');
  await expect(root(page)).toHaveAttribute('data-moves', '1');
});

test('redo puts back an undone symmetric move and reset empties the list', async ({ page }) => {
  await open(page);
  await bigNode(page, 1).click();
  await bigNode(page, 2).click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  const big = await valuesOf(bigNodes(page));
  const small = await valuesOf(foldedNodes(page));
  expect(big).toEqual(expected('A3', [3, 2, 1], [1, 1, 1], [1, 2], 'firing').big);
  await control(page, 'undo').click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await control(page, 'redo').click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  expect(await valuesOf(bigNodes(page))).toEqual(big);
  expect(await valuesOf(foldedNodes(page))).toEqual(small);
  await control(page, 'reset').click();
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  for (const b of await root(page).locator('button[data-node]').all()) await expect(b).toHaveAttribute('data-value', '1');
  // The strip of past positions counts symmetric moves.
  await bigNode(page, 1).click();
  await expect(root(page).locator('[data-step]')).toHaveCount(2);
});

test('the table view has a button per node on both boards, and its buttons make symmetric moves', async ({ page }) => {
  await open(page);
  await root(page).locator('summary').click();
  await expect(root(page).locator('[data-table-board="big"]')).toHaveCount(3);
  await expect(root(page).locator('[data-table-board="folded"]')).toHaveCount(2);
  await root(page).locator('[data-table-board="big"][data-table-node="3"]').click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  expect(await valuesOf(bigNodes(page))).toEqual(['-1', '3', '-1']);
  await expect(root(page).locator('[data-table-board="big"][data-table-node="1"]')).toHaveText('-1');
  await root(page).locator('[data-table-board="folded"][data-table-node="2"]').click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  const e = expected('A3', [3, 2, 1], [1, 1, 1], [3, 2], 'firing');
  expect(await valuesOf(bigNodes(page))).toEqual(e.big);
  expect(await valuesOf(foldedNodes(page))).toEqual(e.folded);
  await expect(root(page).locator('[data-table-board="folded"][data-table-node="2"]')).toHaveText(e.folded[1]!);
});

test('Download data saves JSON of the current state', async ({ page }) => {
  await open(page);
  await bigNode(page, 1).click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  const [download] = await Promise.all([page.waitForEvent('download'), control(page, 'downloadData').click()]);
  const doc = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(doc.tool).toBe('fold');
  expect(doc.state).toEqual({ schema: 1, tool: 'fold', board: 'A3', view: 'numbers', coords: 'numbers', start: [1, 1, 1], moves: [1], symmetry: [3, 2, 1] });
  expect(doc.derived.folded.name).toBe('B2');
  expect(doc.derived.averaged.name).toBe(row('A3', [3, 2, 1]).averaged_roots_type);
  expect(doc.derived.symmetry.orbits).toEqual([[1, 3], [2]]);
  expect(doc.derived.bigPositions).toEqual([[1, 1, 1], [-1, 3, -1]]);
  expect(doc.derived.foldedPositions).toEqual([[1, 1], [-1, 3]]);
});

test('Copy link gives the 6.6 link of the current state, and opening it restores both boards', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await context.newPage();
  await open(p, 'g=D4&y=3.2.4.1');
  await bigNode(p, 1).click();
  await foldedNode(p, 1).click();
  await expect(root(p)).toHaveAttribute('data-moves', '2');
  const big = await valuesOf(bigNodes(p));
  const small = await valuesOf(foldedNodes(p));
  await control(p, 'copyLink').click();
  await expect(live(p)).toHaveText('Link copied.');
  const link = await p.evaluate(() => navigator.clipboard.readText());
  // The link decodes with the site's own codec (decodeState, loaded through Vite as in T03.spec.ts, since
  // the codec reads the registry) against the route's defaults, to the same board, symmetry and moves.
  const loader = await ssrLoader();
  let decoded: { state: { board?: unknown; symmetry?: number[]; moves?: number[] }; notice: string | null };
  try {
    type Decode = (search: string, tool: string, defaults: unknown) => typeof decoded;
    const { decodeState } = await loader.load<{ decodeState: Decode }>('/src/lib/urlCodec.ts');
    const { T11_PRESETS } = await loader.load<{ T11_PRESETS: Record<'default', Record<string, unknown>> }>('/src/components/tools/t11/config.ts');
    const { tab: _tab, caption: _caption, ...fields } = T11_PRESETS.default;
    decoded = decodeState(new URL(link).search, 'fold', { schema: 1, tool: 'fold', ...fields });
  } finally {
    await loader.close();
  }
  expect(decoded.notice).toBeNull();
  expect(decoded.state.board).toBe('D4');
  expect(decoded.state.symmetry).toEqual([3, 2, 4, 1]);
  expect(decoded.state.moves).toEqual([1, 2]);
  await p.goto(link);
  await expect(root(p)).toHaveAttribute('data-hydrated', 'true');
  await expect(root(p)).toHaveAttribute('data-moves', '2');
  expect(await valuesOf(bigNodes(p))).toEqual(big);
  expect(await valuesOf(foldedNodes(p))).toEqual(small);
  await context.close();
});

test('a link with 2001 symmetric moves on A3 loads and shows the result of the play', async ({ page }) => {
  const workers: string[] = [];
  page.on('worker', (w) => workers.push(w.url()));
  const moves = Array.from({ length: 2001 }, () => '1').join('.');
  await page.goto(`${ROUTE}?g=A3&w=${moves}`);
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
  // After the controls are enabled: the end of the play, computed in the worker (E-9 rule 2).
  await expect(control(page, 'undo')).toBeEnabled({ timeout: 20000 });
  await expect(bigNode(page, 1)).toHaveAttribute('data-can-act', 'true');
  await expect(root(page)).toHaveAttribute('data-moves', '2001');
  expect(await valuesOf(bigNodes(page))).toEqual(['-1', '3', '-1']);
  expect(await valuesOf(foldedNodes(page))).toEqual(['-1', '3']);
  expect(workers.length).toBeGreaterThan(0);
  // The history holds every position: undo reaches 2000 moves, which is the start again.
  await control(page, 'undo').click();
  await expect(root(page)).toHaveAttribute('data-moves', '2000');
  expect(await valuesOf(bigNodes(page))).toEqual(['1', '1', '1']);
});

test('every node button on both boards carries data-node, data-board, data-value and data-can-act, and the root carries data-tool and data-moves', async ({ page }) => {
  await open(page);
  await expect(root(page)).toHaveAttribute('data-tool', 'fold');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await expect(bigNodes(page)).toHaveCount(3);
  await expect(foldedNodes(page)).toHaveCount(2);
  for (const b of [...(await bigNodes(page).all()), ...(await foldedNodes(page).all())]) {
    await expect(b).toHaveAttribute('data-node', /^[123]$/);
    await expect(b).toHaveAttribute('data-board', 'numbers');
    await expect(b).toHaveAttribute('data-value', /^-?\d+$/);
    await expect(b).toHaveAttribute('data-can-act', 'true');
  }
  await expect(bigNode(page, 1)).toHaveAttribute('aria-label', 'Node 1, value 1, can be fired');
  await expect(out(page, 'big-board').getByRole('group', { name: 'Big board A3' })).toHaveCount(1);
  await expect(out(page, 'folded-board').getByRole('group', { name: 'Folded board B2' })).toHaveCount(1);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('without JavaScript the default figure, both boards, the caption and the table are present and the controls are disabled', async ({ page }) => {
    await page.goto(ROUTE);
    await expect(out(page, 'noscript')).toHaveCount(1);
    await expect(out(page, 'caption')).toContainText('B2 = C2');
    await expect(bigNodes(page)).toHaveCount(3);
    await expect(foldedNodes(page)).toHaveCount(2);
    expect(await valuesOf(bigNodes(page))).toEqual(['1', '1', '1']);
    await expect(out(page, 'folded-name')).toHaveText('B2');
    await expect(out(page, 'orbits').locator('li')).toHaveCount(2);
    await expect(out(page, 'construction')).toHaveText('Folding the board (orbit sums)');
    await expect(root(page).locator('details table button')).toHaveCount(5);
    for (const el of await root(page).locator('button, select, input').all()) await expect(el).toBeDisabled();
    await expect(live(page)).toHaveText('');
  });
});

test('no serious or critical axe violations on /tools/fold', async ({ page }) => {
  await open(page);
  const serious = async (): Promise<string[]> => {
    const axe = await new AxeBuilder({ page }).include('[data-tool="fold"]').analyze();
    return axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
  };
  expect(await serious()).toEqual([]);
  await root(page).locator('[data-tab="average"]').click();
  await expect(out(page, 'averaged-name')).toHaveCount(1);
  expect(await serious()).toEqual([]);
  await open(page, 'g=A4');
  expect(await serious()).toEqual([]);
});

test('at 320 pixels the two boards stack and the page has no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const query of ['', 'g=D8', 'g=E6&y=6.2.5.4.3.1']) {
    await open(page, query);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const big = (await out(page, 'big-board').boundingBox())!;
    const folded = (await out(page, 'folded-board').boundingBox())!;
    expect(folded.y).toBeGreaterThanOrEqual(big.y + big.height - 1);
    for (const b of await root(page).locator('button[data-node]').all()) {
      const r = (await b.boundingBox())!;
      expect(r.width).toBeGreaterThanOrEqual(24);
      expect(r.height).toBeGreaterThanOrEqual(24);
    }
  }
  // On a wide screen the boards stand side by side.
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  const big = (await out(page, 'big-board').boundingBox())!;
  const folded = (await out(page, 'folded-board').boundingBox())!;
  expect(Math.abs(folded.y - big.y)).toBeLessThan(2);
  expect(folded.x).toBeGreaterThanOrEqual(big.x + big.width - 1);
});
