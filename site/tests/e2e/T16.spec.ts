// P2-A5: tool T16, the Sandbox, against the built site (SPEC 4 T16 Acceptance, 4.0, 4 T1, 4 T4, 2.11,
// 6.2, 6.6, 7.4, 7.5, 7.7, 8.2 item 7, D19, E-2, E-7). Cases are opened by bare query parameters on
// /tools/sandbox/ (6.6: every state is a link) or through the sandbox's controls. Tests read only the
// hooks of 4.0, the live region and, where a criterion is about a download, the file. Golden values
// are read from reference/golden_data.json at test time, never typed; the long `w` strings are built
// from it. The roster's one flow ("load the bigint_test board by JSON import, play the 200 moves via a
// link, read the exact end in the table view") is split into the import test and the two link tests,
// because a link carries its own board (plan; decisions/P2-A5.md).
//
// Hooks read:
//   root:    data-tool="sandbox", data-moves, data-hydrated="true"
//   game:    [data-game] (the two game boards and History, apart from the editor's drawing);
//            buttons data-node, data-board (populations | numbers), data-value, data-can-act,
//            data-sign (positive | negative | zero), inside [data-board-group]
//   drawing: data-numeral (the drawn numeral of a node, P0-A5), data-road-style (P1-A3)
//   table:   data-table-board, data-table-node, data-value (A-10 table buttons, exact)
//   verdict: data-tex (TeX source of the names shown), data-name (verdictName), data-order
//            (verdictBourbaki: the reader's labels in Bourbaki order), data-nodes and data-values
//            (verdictMarks, verdictComarks)
//   modules: data-link="sandbox" (ModuleLinks, P1-A4)
// data-out names (every one T16 renders; the registry's `outs`):
//   verdict, verdictName, verdictBourbaki, verdictMarks, verdictComarks, mode, importStatus, boardJson,
//   aCp, bridgeSentence (T1's Bridge), moveCounter, historyStrip, historyCounter (History),
//   editorSubject, editorReason (BoardEditor), caption, notice, noscript, exportNotice (ToolFrame)
// data-control names: view (radio, value populations | numbers | linked), restartPopulations,
//   restartNumbers, importText, importBoard, importFile, exportBoard, undo, redo, reset, copyLink,
//   downloadData; the editor's addNode, removeNode, move-*, roadsOther, roadsOut, roadsBack, picker,
//   loadPreset; data-export="svg" | "png" (ToolFrame).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boardFromName, classify, fromAdjacency, toLabels, toPopulation, ratToString } from '../../../packages/engine/src/index';
import type { AnyBoard, Board } from '../../../packages/engine/src/index';
import { siteAndBase } from '../../astro.config.mjs';
import { T16_OUTS } from '../../src/tools/registry/T16';

interface Golden {
  bigint_test: {
    cartan: number[][];
    population_start: number[];
    mutation_nodes: number[];
    population_end: string[];
    numbers_start: number[];
    firing_nodes: number[];
    numbers_end: string[];
  };
  one_way_counterexample: { cartan: number[][]; start: number[]; moves: number[]; result: number[] };
}
const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url)), 'utf8')) as Golden;
const BT = golden.bigint_test;

const ROUTE = 'tools/sandbox/';
const ONE_WAY = 'has a one-way road: the theory does not apply';
const cartanParam = (C: number[][]): string => `c:${C.map((r) => r.join(',')).join(';')}`;
/** The engine's board of a Cartan matrix (A[i][j] = -C[j][i], SPEC 2.1) or of a name, for computing expectations. */
const boardOf = (spec: string | number[][]): AnyBoard =>
  typeof spec === 'string' ? boardFromName(spec) : fromAdjacency(spec.map((row, i) => row.map((_, j) => (i === j ? 0 : -spec[j]![i]!))));
const DEFAULT_G = cartanParam(BT.cartan);
const MUTATIONS = `z=1&g=${DEFAULT_G}&v=p&m=f&c=p&s=${BT.population_start.join(',')}&w=${BT.mutation_nodes.join('.')}`;
const FIRINGS = `z=1&g=${DEFAULT_G}&v=n&m=f&c=n&s=${BT.numbers_start.join(',')}&w=${BT.firing_nodes.join('.')}`;

const root = (page: Page): Locator => page.locator('[data-tool="sandbox"]');
const gameNodes = (page: Page, board: 'populations' | 'numbers'): Locator => root(page).locator(`[data-game] button[data-board="${board}"][data-node]`);
const gameNode = (page: Page, board: 'populations' | 'numbers', label: number): Locator =>
  root(page).locator(`[data-game] button[data-board="${board}"][data-node="${label}"]`);
const out = (page: Page, name: string): Locator => root(page).locator(`[data-out="${name}"]`);
const control = (page: Page, name: string): Locator => root(page).locator(`[data-control="${name}"]`);

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`${ROUTE}${query ? `?${query}` : ''}`);
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
}

/** Values of a game board in label order, with the labels. */
async function read(page: Page, board: 'populations' | 'numbers'): Promise<{ labels: number[]; values: string[] }> {
  const list = gameNodes(page, board);
  const n = await list.count();
  const pairs: [number, string][] = [];
  for (let k = 0; k < n; k++) {
    const b = list.nth(k);
    pairs.push([Number(await b.getAttribute('data-node')), (await b.getAttribute('data-value')) ?? '']);
  }
  pairs.sort((x, y) => x[0] - y[0]);
  return { labels: pairs.map((p) => p[0]), values: pairs.map((p) => p[1]) };
}
const values = async (page: Page, board: 'populations' | 'numbers'): Promise<string[]> => (await read(page, board)).values;

/** The shortened numeral of SPEC 4.0, built from a golden string (P1-A5's wording of the digit count). */
function shortened(text: string): string {
  const negative = text.startsWith('-');
  const d = text.replace(/^-/, '');
  return `${negative ? '−' : ''}${d[0]}.${d.slice(1, 5)}... x 10^${d.length - 1} (${d.length} digits)`;
}

test('the registry lists every data-out name the sandbox renders', async ({ page }) => {
  for (const q of [MUTATIONS, 'z=1&g=A2~&v=p&m=f&c=p&s=1,0,0', 'z=1&g=A3&v=l&m=f&c=n&s=1,0,0&w=1']) {
    await open(page, q);
    const names = await root(page).evaluate((el) => [...new Set([...el.querySelectorAll('[data-out]')].map((e) => e.getAttribute('data-out')!))]);
    for (const name of names) expect(T16_OUTS as readonly string[], name).toContain(name);
  }
});

test('the default sandbox renders with the three-roads board, the indefinite verdict and the caption', async ({ page }) => {
  await open(page);
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await expect(gameNodes(page, 'populations')).toHaveCount(2);
  expect(await values(page, 'populations')).toEqual(['1', '0']);
  await expect(out(page, 'verdict')).toContainText('indefinite');
  await expect(out(page, 'caption')).not.toBeEmpty();
  await expect(out(page, 'notice')).toHaveCount(0);
  await expect(out(page, 'mode')).toHaveText('free play');
  // Free play: every node can be acted on (A-3).
  for (const b of await gameNodes(page, 'populations').all()) await expect(b).toHaveAttribute('data-can-act', 'true');
});

test('JSON import loads the bigint_test board', async ({ page }) => {
  await open(page, 'g=A3');
  await expect(gameNodes(page, 'populations')).toHaveCount(3);
  await expect(out(page, 'verdict')).toContainText('A3');
  await gameNode(page, 'populations', 2).click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await control(page, 'importText').fill(JSON.stringify({ cartan: BT.cartan }));
  await control(page, 'importBoard').click();
  await expect(gameNodes(page, 'populations')).toHaveCount(2);
  await expect(out(page, 'verdict')).toContainText('indefinite');
  await expect(out(page, 'importStatus')).toContainText('Board imported');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  expect(await values(page, 'populations')).toEqual(['1', '0']);
  // A refused import leaves the board as it was and says why.
  await control(page, 'importText').fill('{"cartan": [[2, 1], [-1, 2]]}');
  await control(page, 'importBoard').click();
  await expect(out(page, 'importStatus')).toContainText('could not be read');
  await expect(gameNodes(page, 'populations')).toHaveCount(2);
  await expect(out(page, 'verdict')).toContainText('indefinite');
});

test('200 mutations by link end at the recorded population', async ({ page }) => {
  await open(page, MUTATIONS);
  await expect(root(page)).toHaveAttribute('data-moves', String(BT.mutation_nodes.length));
  await expect(out(page, 'notice')).toHaveCount(0);
  expect(await values(page, 'populations')).toEqual(BT.population_end);
  // The tooltip holds the exact digits; the drawn numeral is the shortened form (4.0 Long numbers).
  await expect(gameNode(page, 'populations', 1)).toHaveAttribute('title', BT.population_end[0]!);
  await expect(gameNode(page, 'populations', 2)).toHaveAttribute('title', BT.population_end[1]!);
  await expect(root(page).locator('[data-game] [data-numeral="1"]')).toHaveText(shortened(BT.population_end[0]!));
  await expect(root(page).locator('[data-game] [data-numeral="2"]')).toHaveText(shortened(BT.population_end[1]!));
  // The table of A-10: exact digits on its per-node buttons.
  await root(page).locator('details summary').click();
  for (const [k, label] of [1, 2].entries()) {
    const cell = root(page).locator(`[data-table-board="populations"][data-table-node="${label}"]`);
    await expect(cell).toHaveAttribute('data-value', BT.population_end[k]!);
    await expect(cell).toContainText(BT.population_end[k]!);
  }
});

test('200 firings by link end at the recorded numbers', async ({ page }) => {
  await open(page, FIRINGS);
  await expect(root(page)).toHaveAttribute('data-moves', String(BT.firing_nodes.length));
  await expect(gameNodes(page, 'populations')).toHaveCount(0);
  expect(await values(page, 'numbers')).toEqual(BT.numbers_end);
  expect(BT.numbers_end[1]!.startsWith('-')).toBe(true);
  await expect(root(page).locator('[data-game] [data-numeral="2"]')).toHaveText(shortened(BT.numbers_end[1]!));
});

test('a one-way board is drawn in roads style, plays to the mixed population and gets the one-way verdict', async ({ page }) => {
  const ow = golden.one_way_counterexample;
  await open(page, `g=${cartanParam(ow.cartan)}&v=p&c=p&s=${ow.start.join(',')}&w=${ow.moves.join('.')}`);
  expect(await values(page, 'populations')).toEqual(ow.result.map(String));
  await expect(out(page, 'verdict')).toContainText(ONE_WAY);
  const styles = root(page).locator('[data-game] [data-road-style]');
  expect(await styles.count()).toBeGreaterThan(0);
  for (const s of await styles.all()) await expect(s).toHaveAttribute('data-road-style', 'roads');
  await expect(root(page).locator('[data-editor]')).toHaveAttribute('data-road-style', 'roads');
});

test('exports carry the exact digits', async ({ page }) => {
  await open(page, MUTATIONS);
  const [data] = await Promise.all([page.waitForEvent('download'), control(page, 'downloadData').click()]);
  const doc = JSON.parse(readFileSync((await data.path())!, 'utf8')) as {
    tool: string;
    state: { moves: number[]; start: (number | string)[] };
    derived: { positions: { populations: (number | string)[] }[] };
  };
  expect(doc.tool).toBe('sandbox');
  expect(doc.state.start).toEqual(BT.population_start);
  expect(doc.state.moves).toEqual(BT.mutation_nodes);
  expect(doc.derived.positions[doc.derived.positions.length - 1]!.populations).toEqual(BT.population_end);
  const [svg] = await Promise.all([page.waitForEvent('download'), root(page).locator('[data-export="svg"]').click()]);
  const text = readFileSync((await svg.path())!, 'utf8');
  for (const v of BT.population_end) expect(text).toContain(v);
  // The PNG is drawn from the same SVG and its pixels carry no text; it is not read (plan).
});

test('an affine board by name keeps label 0 and reads affine', async ({ page }) => {
  await open(page, 'g=A2~');
  expect((await read(page, 'populations')).labels).toEqual([0, 1, 2]);
  await expect(out(page, 'verdict')).toContainText('affine');
  await expect(out(page, 'verdictName')).toHaveAttribute('data-name', 'A2~');
  await expect(out(page, 'verdict')).toContainText('A2~');
  const board = boardOf('A2~');
  const [record] = classify(board);
  const nodes = toLabels(board, record!.nodes).join(',');
  await expect(out(page, 'verdictMarks')).toHaveAttribute('data-nodes', nodes);
  await expect(out(page, 'verdictMarks')).toHaveAttribute('data-values', record!.marks!.join(','));
  await expect(out(page, 'verdictComarks')).toHaveAttribute('data-nodes', nodes);
  await expect(out(page, 'verdictComarks')).toHaveAttribute('data-values', record!.comarks!.join(','));
  // A move at label 0 acts on position 0 (E-7: no stray + 1).
  await gameNode(page, 'populations', 0).click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  expect(await values(page, 'populations')).not.toEqual(['1', '0', '0']);
});

test('a finite board by name reads finite with its name', async ({ page }) => {
  for (const [g, identity] of [
    ['A3', true],
    ['c:2,0,-1;0,2,-1;-1,-1,2', false],
  ] as const) {
    await open(page, `g=${g}`);
    await expect(gameNodes(page, 'populations')).toHaveCount(3);
    await expect(out(page, 'verdict')).toContainText('finite');
    await expect(out(page, 'verdict')).toContainText('A3');
    const board: AnyBoard = g === 'A3' ? boardOf('A3') : boardOf(g.slice(2).split(';').map((r) => r.split(',').map(Number)));
    const order = toLabels(board, classify(board)[0]!.bourbaki_order!).join(',');
    await expect(out(page, 'verdictBourbaki')).toHaveAttribute('data-order', order);
    expect(order === '1,2,3', g).toBe(identity);
    const before = await values(page, 'populations');
    await gameNode(page, 'populations', 1).click();
    const after = await values(page, 'populations');
    expect(after.filter((v, k) => v !== before[k])).toHaveLength(1);
  }
});

test('a B2 board recognised from its shape reads B_2=C_2', async ({ page }) => {
  for (const g of ['c:2,-1;-2,2', 'c:2,-2;-1,2']) {
    await open(page, `g=${g}`);
    await expect(out(page, 'verdict')).toHaveAttribute('data-tex', /B_2=C_2/);
    await expect(out(page, 'verdict').locator('math')).toHaveCount(1);
    await expect(out(page, 'verdict')).toContainText('finite');
  }
  await open(page, 'g=B2');
  await expect(out(page, 'verdictName')).toContainText('B2');
  await expect(out(page, 'verdict')).not.toHaveAttribute('data-tex', /C_2/);
  await expect(out(page, 'verdict').locator('math')).toHaveCount(0);
});

test('a populations view from a fractional numbers start falls back to linked', async ({ page }) => {
  await open(page, `z=1&g=${DEFAULT_G}&v=p&m=f&c=n&s=1,0`);
  await expect(gameNodes(page, 'populations')).toHaveCount(2);
  await expect(gameNodes(page, 'numbers')).toHaveCount(2);
  for (const v of await values(page, 'populations')) expect(v).toMatch(/^-?\d+\/\d+$/);
  await expect(root(page).locator('[data-control="view"][value="linked"]')).toBeChecked();
  await expect(root(page).locator('[data-control="view"][value="populations"]')).toBeDisabled();
  await expect(out(page, 'notice')).toHaveCount(0);
});

test('a link the sandbox does not offer loads the default with the notice', async ({ page }) => {
  for (const q of ['m=l', 'v=n&m=l', 'g=c:2,-3;-3']) {
    await open(page, q);
    await expect(out(page, 'notice'), q).not.toBeEmpty();
    await expect(root(page)).toHaveAttribute('data-moves', '0');
    expect(await values(page, 'populations')).toEqual(['1', '0']);
  }
});

test('a long start on a named finite board is exact with no notice', async ({ page }) => {
  const N = '123456789012345678901234567890';
  await open(page, `z=1&g=A2&v=p&m=f&c=p&s=${N},0&w=2`);
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  expect(await values(page, 'populations')).toEqual([N, N]);
  await expect(out(page, 'notice')).toHaveCount(0);
});

test('a numbers start shows exact fractions on the populations board', async ({ page }) => {
  await open(page, 'z=1&g=A2&v=l&m=f&c=n&s=1,0');
  expect(await values(page, 'populations')).toEqual(['2/3', '1/3']);
  await open(page, `z=1&g=${DEFAULT_G}&v=l&m=f&c=n&s=1,0`);
  const pop = toPopulation(boardOf(BT.cartan) as Board<bigint>, [1n, 0n])!.map(ratToString);
  expect(await values(page, 'populations')).toEqual(pop);
  await expect(out(page, 'bridgeSentence')).toBeVisible();
});

test('board export gives the current board as JSON', async ({ page }) => {
  await open(page, `g=${DEFAULT_G}@0,0;1,0`);
  const text = await out(page, 'boardJson').textContent();
  expect(JSON.parse(text ?? '')).toEqual({ cartan: BT.cartan, xy: [[0, 0], [1, 0]] });
  const [file] = await Promise.all([page.waitForEvent('download'), control(page, 'exportBoard').click()]);
  expect(file.suggestedFilename()).toBe('board.json');
  expect(JSON.parse(readFileSync((await file.path())!, 'utf8'))).toEqual({ cartan: BT.cartan, xy: [[0, 0], [1, 0]] });
});

test('editing the board resets the play and reruns the verdict', async ({ page }) => {
  await open(page, 'g=A2');
  await gameNode(page, 'populations', 1).click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await expect(out(page, 'verdict')).toContainText('A2');
  await control(page, 'addNode').click();
  await expect(gameNodes(page, 'populations')).toHaveCount(3);
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await expect(out(page, 'verdict')).toContainText('nodes 3');
});

test('M0 and M1 link to the sandbox with their boards', async ({ page }) => {
  const { base } = siteAndBase(process.env);
  for (const slug of ['m0-start', 'm1-mutation']) {
    await page.goto(`modules/${slug}/`);
    const link = page.locator('a[data-link="sandbox"]');
    await expect(link).toHaveCount(1);
    const href = (await link.getAttribute('href')) ?? '';
    expect(href.startsWith(`${base}${ROUTE}`), href).toBe(true);
    expect(href).toContain('g=');
  }
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`no serious or critical axe violations on /tools/sandbox (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await open(page);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    const serious = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) }));
    expect(serious).toEqual([]);
  });
}

test('focus ring, sign shapes and reduced motion on the sandbox board', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, FIRINGS);
  // A-2: Tab into the board; the focused node has a visible outline and nothing covers it.
  let inBoard = false;
  for (let k = 0; k < 60 && !inBoard; k++) {
    await page.keyboard.press('Tab');
    inBoard = await page.evaluate(() => document.activeElement?.closest('[data-game] [data-board-group]') !== null && document.activeElement?.hasAttribute('data-node') === true);
  }
  expect(inBoard).toBe(true);
  const ring = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { outline: getComputedStyle(el).outlineStyle, covered: top !== el && !el.contains(top) };
  });
  expect(ring.outline).not.toBe('none');
  expect(ring.covered).toBe(false);
  // A-5: the positive and the negative node differ in the sign hook (numeral, fill), not only colour.
  await expect(gameNode(page, 'numbers', 1)).toHaveAttribute('data-sign', 'positive');
  await expect(gameNode(page, 'numbers', 2)).toHaveAttribute('data-sign', 'negative');
  // A-9: after a move no animation runs; on load nothing plays by itself.
  await gameNode(page, 'numbers', 1).click();
  await expect(root(page)).toHaveAttribute('data-moves', String(BT.firing_nodes.length + 1));
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await open(page);
  await page.waitForTimeout(1000);
  await expect(root(page)).toHaveAttribute('data-moves', '0');
});

test('usable at 320 pixels', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await open(page);
  const targets = [
    ...(await gameNodes(page, 'populations').all()),
    ...(await root(page).locator('[data-control="view"]').all()),
    control(page, 'importBoard'),
  ];
  for (const t of targets) {
    await t.scrollIntoViewIfNeeded();
    await expect(t).toBeVisible();
    const box = (await t.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(24);
    expect(box.height).toBeGreaterThanOrEqual(24);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('keyboard: Tab reaches the view control, the import field and the export button; Enter imports', async ({ page }) => {
  await open(page, 'g=A3');
  const reached = new Set<string>();
  for (let k = 0; k < 200 && !(reached.has('view') && reached.has('importText') && reached.has('exportBoard')); k++) {
    await page.keyboard.press('Tab');
    const name = await page.evaluate(() => document.activeElement?.getAttribute('data-control') ?? '');
    if (name) reached.add(name);
  }
  for (const name of ['view', 'importText', 'exportBoard']) expect([...reached], name).toContain(name);
  await control(page, 'importText').focus();
  await page.keyboard.insertText(JSON.stringify({ cartan: BT.cartan }));
  await control(page, 'importBoard').focus();
  await page.keyboard.press('Enter');
  await expect(gameNodes(page, 'populations')).toHaveCount(2);
  await expect(out(page, 'importStatus')).toContainText('Board imported');
});

test.describe('regressions', () => {
  // SPEC 5.6: "Roads between two nodes, each way (editor only; the engine accepts any count) | 4 | editor
  // refuses more"; 6.2: on a one-way board every road is drawn as its own arrow. An import with 2^53 - 1
  // roads must not hang the page. Adopted from the red team's reproducer (RT-03 attacks 15 and 30).
  // regression: P3-RT-03-01
  test('a one-way board with 9007199254740991 roads from an import does not hang the page', async ({ page }) => {
    test.setTimeout(60_000);
    await open(page);
    await control(page, 'importText').fill('{"cartan": [[2, -9007199254740991], [0, 2]]}');
    const t0 = Date.now();
    await control(page, 'importBoard').click({ timeout: 20_000 });
    // Either refused, or imported and drawn: the page must answer within 20 seconds.
    await expect(out(page, 'importStatus')).not.toBeEmpty({ timeout: 20_000 });
    const answered = await Promise.race([
      page.evaluate(() => document.querySelectorAll('[data-tool="sandbox"] [data-node]').length).then((n) => ({ n })),
      new Promise<{ n: number }>((resolve) => setTimeout(() => resolve({ n: -1 }), 20_000)),
    ]);
    expect(answered.n, `page answered after ${Date.now() - t0} ms`).toBeGreaterThan(0);
  });
});
