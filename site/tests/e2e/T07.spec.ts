// P3-A5: tool T7, the Symbolic Game, against the built site (SPEC.md 4 T7, 4.0, 6.6, 7.4 to 7.6, 9.2;
// Appendix A.1), and the T1 colour-class panel (SPEC 4 T1 "Shows"). The cases are configured by bare
// query parameters on /tools/symbolic/, which the codec reads (6.6). The T1 panel is a property no
// route sets yet, so its test bundles T01GameBoard.svelte with Vite and serves it from a local server,
// as phase2-additions.spec.ts does for T1's phase-2 panels. Tests read only the hooks of 4.0 and the
// live region (and, where a criterion is about the address bar, the clipboard or a download, those).
// Golden values are read from reference/golden_data.json with node:fs (golden.ts is not imported: it
// is an Astro-side module); the only vectors typed are those of Appendix A.1 and the first two A3
// forms that M5 beat 5 quotes.
//
// Hooks read:
//   root:      data-tool="symbolic", data-moves, data-hydrated="true"
//   buttons:   data-node, data-board ("numbers" on both boards), data-value (left: decimal; right: the
//              coefficients of the form in label order joined by commas, for example 2,1), data-can-act
//              (always "false" on the right), data-sign
//   wrappers:  data-out="numbersBoard" (the left board), data-out="symbolicBoard" (the right board);
//              every node query is scoped by its wrapper
//   right:     data-entry (label) and data-form on each line of the list of current forms
//   drawing:   data-numeral (P0-A5, the numeral drawn on a left node), data-disc
//   groups:    data-board-group (the group of node buttons, with its accessible name)
//   table:     data-table-row, data-table-value, data-form, data-table-node (the A-10 table's buttons)
//   strip:     data-step (a strip button), data-control="historySlider"
//   live:      [data-live] (ToolFrame's polite live region)
//   forms:     data-form-render ("mathml" or "spans") on each LinearForm
// data-out names (every one T7 renders; the registry's `outs`):
//   caption, notice, noscript, mode, numbersBoard, symbolicBoard, gameOver, firedForms (each item
//   data-move and data-form), rootTable, rootRow (data-root, data-used, data-move), valuesTable,
//   moveCounter, historyStrip, historyCounter, predictResult, predictReveal (from the prediction
//   property only), exportNotice
// T1 (the colour-class panel): data-out="colourClasses" with data-class-1 and data-class-2 (labels
//   joined by commas) or data-none="true" on a board with an odd cycle.
// data-control names: undo, redo, reset, step, playToEnd, picker, copyLink, downloadData, historySlider.
//
// Properties of T7 beyond the common ones of 4.0 Configuration (id, board, coords, start, moves,
// linkTo, prediction, preset, caption, layers): none. coords must be 'numbers'; linkTo and layers are
// accepted and ignored; preset is 'default' only.
// LinearForm.svelte properties: coeffs: (number | bigint)[] (by position), labels: number[] (the
//   subscripts, board.labels), letter?: string (default 'x'), render?: 'mathml' | 'spans' (default the
//   module constant RENDER).
// T1's panels property gains the key 'colours' (phase 3).
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { ssrLoader } from '../unit/_svelteSsr';
import { nodePositions } from '../../src/components/draw/layouts';
import { boardFromName } from '../../../packages/engine/src/index';

const GOLDEN = JSON.parse(readFileSync(fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  types: Record<string, { n_positive_roots: number; positive_roots?: number[][]; longest_word: number[]; cartan: number[][] }>;
};
const N = (name: string): number => GOLDEN.types[name]!.n_positive_roots;
const keyOf = (v: readonly number[]): string => v.join(',');

const ROUTE = 'tools/symbolic/';
const root = (page: Page): Locator => page.locator('[data-tool="symbolic"]');
const left = (page: Page): Locator => root(page).locator('[data-out="numbersBoard"]');
const right = (page: Page): Locator => root(page).locator('[data-out="symbolicBoard"]');
const leftNode = (page: Page, label: number): Locator => left(page).locator(`button[data-node="${label}"]`);
const rightNode = (page: Page, label: number): Locator => right(page).locator(`button[data-node="${label}"]`);
const out = (page: Page, name: string): Locator => root(page).locator(`[data-out="${name}"]`);
const control = (page: Page, name: string): Locator => root(page).locator(`[data-control="${name}"]`);
const live = (page: Page): Locator => root(page).locator('[data-live]');
const rows = (page: Page): Locator => out(page, 'rootRow');

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`${ROUTE}${query ? `?${query}` : ''}`);
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
}

/** data-value of the node buttons inside a wrapper, in label order. */
async function values(scope: Locator): Promise<string[]> {
  const pairs = await scope
    .locator('button[data-node]')
    .evaluateAll((els) => els.map((e) => [Number(e.getAttribute('data-node')), e.getAttribute('data-value') ?? ''] as [number, string]));
  return pairs.sort((a, b) => a[0] - b[0]).map((p) => p[1]);
}

async function firedForms(page: Page): Promise<string[]> {
  return out(page, 'firedForms')
    .locator('[data-form]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-form') ?? ''));
}

async function rowState(page: Page): Promise<{ root: string; used: string; move: string | null }[]> {
  return rows(page).evaluateAll((els) => els.map((e) => ({ root: e.getAttribute('data-root') ?? '', used: e.getAttribute('data-used') ?? '', move: e.getAttribute('data-move') })));
}

/** "minus 1" for -1 (A-4), from the hook text. */
const spoken = (v: string): string => (v.startsWith('-') ? `minus ${v.slice(1)}` : v);

/** Records every non-empty text written to the live region from now on. */
async function recordLive(page: Page): Promise<() => Promise<string[]>> {
  await root(page).evaluate((el) => {
    const region = el.querySelector('[data-live]')!;
    const w = window as unknown as { __live: string[]; __observing?: boolean };
    w.__live = [];
    if (w.__observing) return;
    w.__observing = true;
    new MutationObserver(() => {
      const t = region.textContent ?? '';
      if (t !== '') w.__live.push(t);
    }).observe(region, { childList: true, characterData: true, subtree: true });
  });
  return () => page.evaluate(() => (window as unknown as { __live: string[] }).__live);
}

async function nojsPage(browser: Browser, baseURL: string | undefined, viewport = { width: 360, height: 800 }): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport });
  const page = await context.newPage();
  return { page, close: () => context.close() };
}

// ---------------------------------------------------------------------------------------------
// SPEC 4 T7 and Appendix A.1
// ---------------------------------------------------------------------------------------------

// regression: P3-RT-11-08
test('B2 game from (1,1) fires x1, 2x1+x2, x1+x2, x2', async ({ page }) => {
  await open(page, 'z=1&g=B2&c=n&s=1,1');
  // Appendix A.1: the numbers after each move, and the forms fired.
  const numbers = [['-1', '3'], ['2', '-3'], ['-2', '1'], ['-1', '-1']];
  const forms = ['1,0', '2,1', '1,1', '0,1'];
  for (const [k, label] of [1, 2, 1, 2].entries()) {
    await leftNode(page, label).click();
    await expect(root(page)).toHaveAttribute('data-moves', String(k + 1));
    expect(await values(left(page))).toEqual(numbers[k]);
    expect(await firedForms(page)).toEqual(forms.slice(0, k + 1));
  }
  // A-4, the whole text: the move that ends the game, then the game over (decisions/P1-A5.md).
  await expect(live(page)).toHaveText('Fired node 2. Numbers now minus 1, minus 1. Move 4. Game over after 4 moves.');
  // The table holds (2, 1) of the reversed board, where B2 itself has (1, 2) (A.1).
  const table = await rowState(page);
  expect(table.map((r) => r.root)).toContain('2,1');
  expect(table.map((r) => r.root)).not.toContain('1,2');
  expect(table.every((r) => r.used === 'true')).toBe(true);
});

test('A3 play to the end uses every row once', async ({ page }) => {
  await open(page);
  const read = await recordLive(page);
  await control(page, 'playToEnd').click();
  const n = N('A3');
  await expect(root(page)).toHaveAttribute('data-moves', String(n));
  const forms = await firedForms(page);
  expect(forms).toHaveLength(n);
  // M5 beat 5: "fires x1, x1 + x2, and so on".
  expect(forms.slice(0, 2)).toEqual(['1,0,0', '1,1,0']);
  expect([...forms].sort()).toEqual(GOLDEN.types.A3!.positive_roots!.map(keyOf).sort());
  const table = await rowState(page);
  expect(table).toHaveLength(n);
  expect(table.every((r) => r.used === 'true')).toBe(true);
  expect(new Set(table.map((r) => r.move)).size).toBe(n);
  await page.waitForTimeout(800);
  const end = (await values(left(page))).map(spoken).join(', ');
  expect(await read()).toEqual([`Played ${n} moves to the end. Numbers now ${end}.`]);
  await expect(out(page, 'gameOver')).toHaveText(`Game over after ${n} moves.`);
});

test('B3 table shows the roots of the reversed board', async ({ page }) => {
  await open(page, 'z=1&g=B3&c=n&s=1,1,1');
  await control(page, 'playToEnd').click();
  await expect(root(page)).toHaveAttribute('data-moves', String(N('B3')));
  const shown = new Set((await rowState(page)).map((r) => r.root));
  const reversed = GOLDEN.types.C3!.positive_roots!.map(keyOf);
  const own = GOLDEN.types.B3!.positive_roots!.map(keyOf);
  expect([...shown].sort()).toEqual([...reversed].sort());
  const onlyReversed = reversed.filter((v) => !own.includes(v));
  const onlyOwn = own.filter((v) => !reversed.includes(v));
  expect(onlyReversed.length).toBeGreaterThan(0);
  expect(onlyOwn.length).toBeGreaterThan(0);
  for (const v of onlyReversed) expect(shown.has(v), v).toBe(true);
  for (const v of onlyOwn) expect(shown.has(v), v).toBe(false);
  expect((await rowState(page)).every((r) => r.used === 'true')).toBe(true);
});

test('the right board follows', async ({ page }) => {
  await open(page);
  const rightBefore = await values(right(page));
  for (const label of [1, 2, 3]) {
    await expect(rightNode(page, label)).toHaveAttribute('data-can-act', 'false');
    await expect(rightNode(page, label)).toHaveAttribute('aria-disabled', 'true');
    // aria-disabled: Playwright's actionability check treats the button as disabled, so the click is forced.
    await rightNode(page, label).click({ force: true });
  }
  await page.waitForTimeout(700);
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  expect(await values(right(page))).toEqual(rightBefore);
  await expect(live(page)).toHaveText('');
  await leftNode(page, 1).click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  const afterOne = { left: await values(left(page)), right: await values(right(page)) };
  expect(afterOne.right).not.toEqual(rightBefore);
  // Node 1 now has a negative number: legal play refuses it, and nothing changes.
  const v1 = (await leftNode(page, 1).getAttribute('data-value'))!;
  expect(v1.startsWith('-')).toBe(true);
  await leftNode(page, 1).click();
  await expect(live(page)).toHaveText(`Node 1 cannot be fired: its number is ${spoken(v1)}.`);
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  expect(await values(left(page))).toEqual(afterOne.left);
  expect(await values(right(page))).toEqual(afterOne.right);
  expect((await rowState(page)).filter((r) => r.used === 'true')).toHaveLength(1);
  // Undo restores both boards and unmarks the row.
  await control(page, 'undo').click();
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  expect(await values(left(page))).toEqual(['1', '1', '1']);
  expect(await values(right(page))).toEqual(rightBefore);
  expect((await rowState(page)).every((r) => r.used === 'false')).toBe(true);
  expect(await firedForms(page)).toEqual([]);
});

test('hooks and keyboard', async ({ page }) => {
  await open(page);
  await expect(root(page)).toHaveAttribute('data-tool', 'symbolic');
  for (const scope of [left(page), right(page)]) {
    const buttons = scope.locator('button[data-node]');
    expect(await buttons.count()).toBe(3);
    for (let k = 0; k < 3; k++) for (const a of ['data-node', 'data-board', 'data-value', 'data-can-act']) expect(await buttons.nth(k).getAttribute(a), a).not.toBeNull();
    // One tab stop per board (A-1).
    expect(await scope.locator('button[data-node][tabindex="0"]').count()).toBe(1);
    expect(await scope.locator('[data-board-group]').getAttribute('aria-label')).not.toBe('');
  }
  expect(await values(right(page))).toEqual(['1,0,0', '0,1,0', '0,0,1']);
  // A-3 names.
  await expect(leftNode(page, 1)).toHaveAccessibleName('Node 1, value 1, can be fired');
  await expect(rightNode(page, 2)).toHaveAccessibleName('Node 2, form x 2');
  // Arrows, Enter fires, u undoes.
  await leftNode(page, 1).focus();
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-node'))).toBe('2');
  await page.keyboard.press('End');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-node'))).toBe('3');
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await expect(leftNode(page, 1)).toHaveAccessibleName('Node 1, value minus 1, cannot be fired');
  await expect(rightNode(page, 2)).toHaveAccessibleName('Node 2, form x 1 plus x 2');
  await page.keyboard.press('u');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  // The right board's arrows move the focus too, and Enter there does nothing.
  await rightNode(page, 1).focus();
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-node'))).toBe('2');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  await expect(root(page)).toHaveAttribute('data-moves', '0');
});

test('links open the state and bad links show the notice', async ({ page }) => {
  await open(page, 'z=1&g=B2&c=n&s=1,1&w=1.2');
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await expect(out(page, 'notice')).toHaveCount(0);
  expect(await firedForms(page)).toEqual(['1,0', '2,1']);
  for (const bad of ['z=1&g=B2&c=n&s=1,1&w=2.2', 'z=1&g=A2~', 'z=1&g=A3&c=n&s=1,0,1', 'z=1&g=A3&c=p']) {
    await open(page, bad);
    await expect(out(page, 'notice'), bad).toBeVisible();
    await expect(root(page)).toHaveAttribute('data-moves', '0');
    expect(await values(left(page)), bad).toEqual(['1', '1', '1']);
  }
});

test('renders without JavaScript', async ({ browser, baseURL }) => {
  const { page, close } = await nojsPage(browser, baseURL);
  await page.goto(ROUTE);
  await expect(root(page)).not.toHaveAttribute('data-hydrated', 'true');
  expect(await values(left(page))).toEqual(['1', '1', '1']);
  expect(await values(right(page))).toEqual(['1,0,0', '0,1,0', '0,0,1']);
  for (const l of [1, 2, 3]) {
    const m = right(page).locator(`[data-entry="${l}"] math`);
    await expect(m).toHaveAttribute('aria-label', `x ${l}`);
    expect(await m.evaluate((el) => el.namespaceURI)).toBe('http://www.w3.org/1998/Math/MathML');
  }
  await expect(rows(page)).toHaveCount(N('A3'));
  for (const r of await rowState(page)) expect(r.used).toBe('false');
  await expect(out(page, 'caption')).not.toHaveText('');
  await expect(out(page, 'noscript')).toHaveText('Interactive when scripts are allowed.');
  const controls = root(page).locator('button, input, select');
  const n = await controls.count();
  expect(n).toBeGreaterThan(6);
  for (let k = 0; k < n; k++) await expect(controls.nth(k)).toBeDisabled();
  expect(await root(page).locator('details table button[data-table-node]').count()).toBe(3);
  await close();
});

test('one case per kind of board: simply laced, double road, triple road', async ({ page }) => {
  for (const [name, start] of [['A3', '1,1,1'], ['B2', '1,1'], ['G2', '1,1']] as const) {
    await open(page, `z=1&g=${name}&c=n&s=${start}`);
    await control(page, 'playToEnd').click();
    await expect(root(page)).toHaveAttribute('data-moves', String(N(name)));
    const forms = [...(await firedForms(page))].sort();
    let expected = GOLDEN.types[name]!.positive_roots!;
    // G2 transposed is G2 numbered backwards (SPEC 2.4 (b); T07.test.ts item 1).
    if (name === 'G2') expected = expected.map((v) => [...v].reverse());
    if (name === 'B2') expected = GOLDEN.types.C2!.positive_roots!;
    expect(forms, name).toEqual(expected.map(keyOf).sort());
    expect((await rowState(page)).every((r) => r.used === 'true'), name).toBe(true);
  }
});

test('announcements', async ({ page }) => {
  await open(page);
  await expect(live(page)).toHaveCount(1);
  await expect(live(page)).toHaveText('');
  let read = await recordLive(page);
  await leftNode(page, 1).click();
  await page.waitForTimeout(700);
  const after = (await values(left(page))).map(spoken).join(', ');
  expect(await read()).toEqual([`Fired node 1. Numbers now ${after}. Move 1.`]);
  read = await recordLive(page);
  await control(page, 'undo').click();
  await page.waitForTimeout(700);
  expect(await read()).toEqual(['Undid move 1. Numbers now 1, 1, 1.']);
  // Three moves within half a second: one announcement, of the last state.
  read = await recordLive(page);
  for (const label of [1, 2, 3]) await leftNode(page, label).click();
  await page.waitForTimeout(700);
  const last = (await values(left(page))).map(spoken).join(', ');
  expect(await read()).toEqual([`Fired node 3. Numbers now ${last}. Move 3.`]);
  // Above four nodes only the changed nodes are named.
  await open(page, 'z=1&g=A5&c=n&s=1,1,1,1,1');
  const before = await values(left(page));
  read = await recordLive(page);
  await leftNode(page, 3).click();
  await page.waitForTimeout(700);
  const now = await values(left(page));
  const changes = now.map((v, k) => [k + 1, v] as const).filter(([k, v]) => v !== before[k - 1]);
  expect(changes.length).toBeLessThan(5);
  const parts = changes.map(([l, v], k) => `${k === 0 ? 'Node' : 'node'} ${l} now ${spoken(v)}`);
  expect(await read()).toEqual([`Fired node 3. ${parts.join(', ')}. Move 1.`]);
});

test('show as table', async ({ page }) => {
  await open(page);
  await root(page).locator('details summary').click();
  const table = out(page, 'valuesTable');
  await expect(table.locator('tr[data-table-row]')).toHaveCount(3);
  for (const l of [1, 2, 3]) {
    const row = table.locator(`tr[data-table-row="${l}"]`);
    await expect(row.locator('[data-table-value]')).toHaveAttribute('data-table-value', '1');
    await expect(row.locator('[data-form]')).toHaveAttribute('data-form', ['1,0,0', '0,1,0', '0,0,1'][l - 1]!);
    await expect(row.locator('math')).toHaveAttribute('aria-label', `x ${l}`);
    await expect(table.locator(`button[data-table-node="${l}"]`)).toBeEnabled();
  }
  await table.locator('button[data-table-node="1"]').click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  const leftNow = await values(left(page));
  expect(leftNow[0]!.startsWith('-')).toBe(true);
  await expect(table.locator('button[data-table-node="1"]')).toBeDisabled();
  await expect(table.locator('button[data-table-node="2"]')).toBeEnabled();
  await expect(table.locator('button[data-table-node="3"]')).toBeEnabled();
  // The table follows both boards.
  for (const l of [1, 2, 3]) {
    await expect(table.locator(`tr[data-table-row="${l}"] [data-table-value]`)).toHaveAttribute('data-table-value', leftNow[l - 1]!);
    await expect(table.locator(`tr[data-table-row="${l}"] [data-form]`)).toHaveAttribute('data-form', (await values(right(page)))[l - 1]!);
  }
  expect(await firedForms(page)).toEqual(['1,0,0']);
});

test('long numbers and Big', async ({ page }) => {
  const big = `1${'0'.repeat(39)}`;
  await open(page, `z=1&g=A3&c=n&s=${big},1,1&w=1`);
  await expect(out(page, 'notice')).toHaveCount(0);
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  const exact = (await leftNode(page, 1).getAttribute('data-value'))!;
  expect(exact).toBe(`-${big}`);
  await expect(leftNode(page, 1)).toHaveAttribute('title', exact);
  const drawn = (await left(page).locator('[data-numeral="1"]').textContent())!;
  expect(drawn).toContain('40 digits');
  expect(drawn).not.toContain(big);
  await root(page).locator('details summary').click();
  await expect(out(page, 'valuesTable').locator('tr[data-table-row="1"] [data-table-value]')).toHaveAttribute('data-table-value', exact);
  await expect(out(page, 'valuesTable').locator('tr[data-table-row="1"] [data-table-value]')).toContainText(big);
  expect(await firedForms(page)).toEqual(['1,0,0']);
  const [download] = await Promise.all([page.waitForEvent('download'), control(page, 'downloadData').click()]);
  const doc = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(doc.tool).toBe('symbolic');
  expect(doc.state.start[0]).toBe(big);
  expect(doc.derived.positions[0].numbers[0]).toBe(big);
  expect(doc.derived.positions[1].numbers[0]).toBe(exact);
  expect(doc.derived.fired[0]).toEqual({ move: 1, node: 1, number: big, form: [1, 0, 0] });
  expect(doc.derived.roots.filter((r: { used: boolean }) => r.used)).toHaveLength(1);
  const text = (await root(page).textContent()) ?? '';
  expect(text).not.toMatch(/arithmetic|overflow|Big/);
});

test('no layout shift on hydration', async ({ browser, baseURL }) => {
  const names = ['numbersBoard', 'symbolicBoard', 'rootTable', 'firedForms'];
  const boxes = async (page: Page): Promise<{ x: number; y: number; width: number; height: number }[]> =>
    Promise.all(names.map(async (n) => (await out(page, n).boundingBox())!));
  const nojs = await nojsPage(browser, baseURL);
  await nojs.page.goto(ROUTE);
  const before = await boxes(nojs.page);
  await nojs.close();
  const context = await browser.newContext({ baseURL, viewport: { width: 360, height: 800 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await open(page);
  await page.waitForTimeout(500);
  const after = await boxes(page);
  names.forEach((n, k) => {
    for (const f of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(after[k]![f] - before[k]![f]), `${n} ${f}`).toBeLessThanOrEqual(1);
  });
  expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThanOrEqual(0.1);
  await context.close();
});

test('the address bar follows the play', async ({ page }) => {
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
  await open(page);
  await page.waitForTimeout(800);
  const length = await page.evaluate(() => history.length);
  const startSearch = await page.evaluate(() => location.search);
  for (const label of [1, 2, 3]) await leftNode(page, label).click();
  expect(await page.evaluate(() => location.search)).toBe(startSearch);
  await expect.poll(() => page.evaluate(() => location.search), { timeout: 3000 }).toContain('w=1.2.3');
  const written = new URLSearchParams(await page.evaluate(() => location.search));
  expect(written.get('g')).toBe('A3');
  expect(written.get('c')).toBe('n');
  expect(written.get('s')).toBe('1,1,1');
  expect(written.get('w')).toBe('1.2.3');
  expect(written.get('v')).toBeNull();
  expect(written.get('m')).toBeNull();
  expect(await page.evaluate(() => history.length)).toBe(length);
  // Copy link at once after a move, before the half second has passed.
  await control(page, 'undo').click();
  await control(page, 'copyLink').click();
  const copied = await page.evaluate(() => (window as unknown as { __copied?: string }).__copied ?? '');
  expect(new URL(copied).searchParams.get('w')).toBe('1.2');
  expect(await page.evaluate(() => history.length)).toBe(length);
  const state = { left: await values(left(page)), right: await values(right(page)), rows: await rowState(page) };
  await page.goto(copied);
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  expect(await values(left(page))).toEqual(state.left);
  expect(await values(right(page))).toEqual(state.right);
  expect(await rowState(page)).toEqual(state.rows);
});

test('history: redo, reset, scrub, branch', async ({ page }) => {
  test.setTimeout(90000);
  await open(page);
  for (const label of [1, 2, 3]) await leftNode(page, label).click();
  await expect(root(page)).toHaveAttribute('data-moves', '3');
  const third = { left: await values(left(page)), right: await values(right(page)), rows: await rowState(page), forms: await firedForms(page) };
  await control(page, 'undo').click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  expect(await firedForms(page)).toHaveLength(2);
  await control(page, 'redo').click();
  await expect(root(page)).toHaveAttribute('data-moves', '3');
  expect(await values(left(page))).toEqual(third.left);
  expect(await values(right(page))).toEqual(third.right);
  expect(await firedForms(page)).toEqual(third.forms);
  expect(await rowState(page)).toEqual(third.rows);
  expect(third.rows.filter((r) => r.used === 'true').map((r) => r.move).sort()).toEqual(['1', '2', '3']);
  // Reset.
  await control(page, 'reset').click();
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  expect(await values(left(page))).toEqual(['1', '1', '1']);
  expect(await values(right(page))).toEqual(['1,0,0', '0,1,0', '0,0,1']);
  expect((await rowState(page)).every((r) => r.used === 'false')).toBe(true);
  // Scrub by the strip's buttons, then branch.
  for (const label of [1, 2, 3]) await leftNode(page, label).click();
  await root(page).locator('[data-step="1"]').click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  expect(await firedForms(page)).toEqual(['1,0,0']);
  const v2 = (await leftNode(page, 2).getAttribute('data-value'))!;
  expect(Number(v2)).toBeGreaterThan(0);
  await leftNode(page, 2).click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  expect(await root(page).locator('[data-step]').count()).toBe(3);
  const forms = await firedForms(page);
  expect(forms).toHaveLength(2);
  expect(forms[0]).toBe('1,0,0');
  expect((await rowState(page)).filter((r) => r.used === 'true')).toHaveLength(2);
  // E8: a strip of more than 50 positions is a slider with a counter, moved by keys.
  await control(page, 'picker').selectOption('E8');
  await control(page, 'playToEnd').click();
  const n = N('E8');
  await expect(root(page)).toHaveAttribute('data-moves', String(n));
  const slider = control(page, 'historySlider');
  await expect(slider).toBeVisible();
  await expect(out(page, 'historyCounter')).toHaveText(`${n} of ${n}`);
  await slider.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(root(page)).toHaveAttribute('data-moves', String(n - 1));
  await expect(out(page, 'historyCounter')).toHaveText(`${n - 1} of ${n}`);
  expect((await rowState(page)).filter((r) => r.used === 'true')).toHaveLength(n - 1);
  expect(await firedForms(page)).toHaveLength(n - 1);
});

test('step makes one move at the lowest positive node', async ({ page }) => {
  await open(page);
  await page.waitForTimeout(1000);
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  const before = await values(left(page));
  const lowest = before.findIndex((v) => Number(v) > 0) + 1;
  const entry = (await rightNode(page, lowest).getAttribute('data-value'))!;
  await control(page, 'step').click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  expect(await firedForms(page)).toEqual([entry]);
  await expect(out(page, 'firedForms').locator('[data-move="1"]')).toContainText(`node ${lowest}`);
  await control(page, 'playToEnd').click();
  await expect(root(page)).toHaveAttribute('data-moves', String(N('A3')));
  await expect(control(page, 'step')).toBeDisabled();
  await expect(control(page, 'playToEnd')).toBeDisabled();
  await expect(out(page, 'gameOver')).toHaveText(`Game over after ${N('A3')} moves.`);
});

test('board picker resets start and moves', async ({ page }) => {
  await open(page);
  const picker = control(page, 'picker');
  const groups = await picker.evaluate((el) =>
    [...el.querySelectorAll('optgroup')].map((g) => ({ letter: g.getAttribute('data-letter'), names: [...g.querySelectorAll('option')].map((o) => o.value) })),
  );
  expect(groups.flatMap((g) => g.names).sort()).toEqual(Object.keys(GOLDEN.types).sort());
  expect(groups.map((g) => g.letter)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  for (const g of groups) expect(g.names.every((n) => n.startsWith(g.letter!))).toBe(true);
  expect(groups.flatMap((g) => g.names).some((n) => /[~^]/.test(n))).toBe(false);
  await leftNode(page, 1).click();
  await leftNode(page, 2).click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await picker.selectOption('B2');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  expect(await values(left(page))).toEqual(['1', '1']);
  expect(await values(right(page))).toEqual(['1,0', '0,1']);
  await expect(rows(page)).toHaveCount(N('B2'));
  expect((await rowState(page)).every((r) => r.used === 'false')).toBe(true);
  await expect(picker).toHaveValue('B2');
});

test('reflow at 320 pixels', async ({ browser, baseURL }) => {
  for (const width of [320, 1280]) {
    const context = await browser.newContext({ baseURL, viewport: { width, height: 900 } });
    const page = await context.newPage();
    for (const query of ['', 'z=1&g=E8&c=n&s=1,1,1,1,1,1,1,1']) {
      await open(page, query);
      if (query !== '') await control(page, 'playToEnd').click();
      const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scroll, `${width} ${query}`).toBeLessThanOrEqual(width);
      const a = (await out(page, 'numbersBoard').boundingBox())!;
      const b = (await out(page, 'symbolicBoard').boundingBox())!;
      if (width === 320) {
        expect(a.y + a.height).toBeLessThanOrEqual(b.y + 1);
        for (const name of ['undo', 'redo', 'reset', 'step', 'playToEnd', 'picker', 'copyLink', 'downloadData']) {
          const c = control(page, name);
          await expect(c, name).toBeVisible();
          const box = (await c.boundingBox())!;
          expect(box.x, name).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width, name).toBeLessThanOrEqual(width + 0.5);
        }
      } else {
        expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
        expect(a.x + a.width).toBeLessThanOrEqual(b.x + 1);
      }
    }
    await context.close();
  }
});

test('targets', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 320, height: 900 } });
  const page = await context.newPage();
  for (const [name, start] of [['A3', '1,1,1'], ['E8', '1,1,1,1,1,1,1,1']] as const) {
    await open(page, `z=1&g=${name}&c=n&s=${start}`);
    const k = nodePositions(boardFromName(name)).columns;
    for (const scope of [left(page), right(page)]) {
      const W = await scope.evaluate((el) => el.clientWidth);
      const u = Math.min(64, Math.floor((W - 16) / k));
      const side = Math.min(44, u);
      const boxes = await scope.locator('button[data-node]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
      for (const r of boxes) {
        expect(r.width, `${name}`).toBeGreaterThanOrEqual(side - 0.5);
        expect(r.height).toBeGreaterThanOrEqual(side - 0.5);
        expect(r.width).toBeGreaterThanOrEqual(24);
        expect(r.height).toBeGreaterThanOrEqual(24);
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const p = boxes[i]!;
          const q = boxes[j]!;
          const overlap = p.left < q.right - 0.5 && q.left < p.right - 0.5 && p.top < q.bottom - 0.5 && q.top < p.bottom - 0.5;
          expect(overlap, `${name}: nodes ${i} and ${j}`).toBe(false);
        }
      }
    }
    for (const c of ['undo', 'redo', 'reset', 'step', 'playToEnd']) {
      const box = (await control(page, c).boundingBox())!;
      expect(box.width, c).toBeGreaterThanOrEqual(24);
      expect(box.height, c).toBeGreaterThanOrEqual(24);
    }
    const summary = (await root(page).locator('details summary').boundingBox())!;
    expect(summary.height).toBeGreaterThanOrEqual(24);
  }
  await context.close();
});

test('reduced motion', async ({ browser, baseURL }) => {
  const reduced = await browser.newContext({ baseURL, reducedMotion: 'reduce', viewport: { width: 360, height: 800 } });
  const page = await reduced.newPage();
  await open(page);
  await leftNode(page, 1).click();
  const running = await page.evaluate(() => document.getAnimations().length);
  expect(running).toBe(0);
  expect((await leftNode(page, 1).getAttribute('data-value'))!.startsWith('-')).toBe(true);
  expect((await rowState(page)).filter((r) => r.used === 'true')).toHaveLength(1);
  await reduced.close();
  const plain = await browser.newContext({ baseURL, viewport: { width: 360, height: 800 } });
  const p2 = await plain.newPage();
  await open(p2);
  await p2.waitForTimeout(300);
  expect(await p2.evaluate(() => document.getAnimations().length)).toBe(0);
  await plain.close();
});

test('focus ring', async ({ page }) => {
  await open(page);
  for (const scope of [left(page), right(page)]) {
    let inside = false;
    for (let k = 0; k < 60 && !inside; k++) {
      await page.keyboard.press('Tab');
      inside = await scope.evaluate((el) => el.contains(document.activeElement) && document.activeElement?.hasAttribute('data-node') === true);
    }
    expect(inside).toBe(true);
    const ring = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), shadow: s.boxShadow, covered: !(hit === el || (hit !== null && el.contains(hit))) };
    });
    expect(ring.style !== 'none' && ring.width > 0 ? true : ring.shadow !== 'none').toBe(true);
    expect(ring.covered).toBe(false);
  }
});

test('used rows are marked by text', async ({ page }) => {
  await open(page);
  await leftNode(page, 1).click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  const usedRow = root(page).locator('[data-out="rootRow"][data-used="true"]').first();
  const unusedRow = root(page).locator('[data-out="rootRow"][data-used="false"]').first();
  const usedText = (await usedRow.textContent())!;
  const unusedText = (await unusedRow.textContent())!;
  expect(usedText).toContain('move 1');
  expect(usedText).not.toContain('not yet fired');
  expect(unusedText).toContain('not yet fired');
  expect(usedText).not.toBe(unusedText);
  // A negative left number: the true minus sign on the node, and an outline, not a fill.
  const drawn = (await left(page).locator('[data-numeral="1"]').textContent())!;
  expect(drawn).toBe('−1');
  const fill = await left(page).locator('[data-disc="1"]').evaluate((el) => getComputedStyle(el).fill);
  expect(fill).toBe('none');
});

// ---------------------------------------------------------------------------------------------
// The T1 colour-class panel (SPEC 4 T1 "Shows", phase 3): T1 bundled with the panels property
// ---------------------------------------------------------------------------------------------

const SITE = fileURLToPath(new URL('../../', import.meta.url));
/** The colour tokens of 6.3, which the fixture page needs as the site's pages have them. */
const TOKENS = readFileSync(join(SITE, 'src/styles/tokens.css'), 'utf8');
const FIXTURES: Record<string, Record<string, unknown>> = {
  'a3-colours': { id: 'b1', caption: 'A3 with its colour classes.', board: 'A3', view: 'numbers', mode: 'legal', coords: 'numbers', panels: ['colours'] },
  'triangle-colours': { id: 'b1', caption: 'The triangle.', board: { cartan: [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]] }, view: 'numbers', coords: 'numbers', panels: ['colours'] },
};

let files = new Map<string, string>();
let entry = '';
const serverHtml: Record<string, string> = {};
let fixtureServer: Server | null = null;
let ORIGIN = '';
const escapeAttr = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

async function startFixtures(): Promise<void> {
  if (fixtureServer !== null) return;
  const virtual: Plugin = {
    name: 'p3a5-entries',
    resolveId: (id) => (id === 'virtual:p3a5-t01' ? `\0${id}` : null),
    load: (id) => {
      if (id !== '\0virtual:p3a5-t01') return null;
      const file = join(SITE, 'src/components/tools/T01GameBoard.svelte');
      return `import { hydrate } from 'svelte'; import T from ${JSON.stringify(file)};
        const target = document.getElementById('app');
        hydrate(T, { target, props: JSON.parse(target.dataset.props) });`;
    },
  };
  const result = await build({
    configFile: false,
    root: SITE,
    logLevel: 'silent',
    cacheDir: join(tmpdir(), 'two-games-p3a5-fixtures-cache'),
    plugins: [virtual, svelte({ configFile: false })],
    resolve: { tsconfigPaths: true },
    build: { write: false, minify: false, modulePreload: false, rollupOptions: { input: { t01: 'virtual:p3a5-t01' } } },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((o) => ('output' in o ? o.output : []));
  files = new Map();
  for (const o of outputs) {
    const text = o.type === 'chunk' ? o.code : typeof o.source === 'string' ? o.source : Buffer.from(o.source).toString('utf8');
    files.set(o.fileName, text);
    if (o.type === 'chunk' && o.isEntry) entry = o.fileName;
  }
  const loader = await ssrLoader();
  try {
    const { default: T } = await loader.load<{ default: unknown }>('/src/components/tools/T01GameBoard.svelte');
    for (const [name, props] of Object.entries(FIXTURES)) serverHtml[name] = loader.render(T, props);
  } finally {
    await loader.close();
  }
  const css = [...files.keys()].filter((k) => k.endsWith('.css'));
  fixtureServer = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const m = /^\/fixture\/([\w-]+)\/$/.exec(url.pathname);
    if (m !== null && FIXTURES[m[1]!] !== undefined) {
      const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>P3-A5 fixture</title>${css
        .map((c) => `<link rel="stylesheet" href="/${c}">`)
        .join('')}<style>${TOKENS}</style><style>body{margin:0}main{max-width:42rem;margin-inline:auto;padding-inline:16px}</style></head><body><main><div id="app" data-props="${escapeAttr(JSON.stringify(FIXTURES[m[1]!]))}">${serverHtml[m[1]!]}</div></main><script type="module" src="/${entry}"></script></body></html>`;
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
}

test.afterAll(async () => {
  await new Promise<void>((resolve) => (fixtureServer ? fixtureServer.close(() => resolve()) : resolve()));
});

test('T1 colour-class panel', async ({ page }) => {
  test.setTimeout(120000);
  await startFixtures();
  await page.goto(`${ORIGIN}/fixture/a3-colours/`);
  const t1 = page.locator('[data-tool="board"]');
  await expect(t1).toHaveAttribute('data-hydrated', 'true');
  const panel = t1.locator('[data-out="colourClasses"]');
  await expect(panel).toHaveAttribute('data-class-1', '1,3');
  await expect(panel).toHaveAttribute('data-class-2', '2');
  // By shape and label as well as colour: a disc and a square, and the labels in words.
  await expect(panel).toContainText('●');
  await expect(panel).toContainText('■');
  await expect(panel).toContainText('First class: nodes 1, 3; ');
  await expect(panel).toContainText('second class: node 2.');
  const colours = await panel.locator('[aria-hidden="true"]').evaluateAll((els) => els.map((e) => getComputedStyle(e).color));
  expect(colours).toHaveLength(2);
  expect(colours[0]).not.toBe(colours[1]);
  // The node fill still carries the sign only (6.3): every number is 1, so every disc is filled alike.
  const fills = await t1.locator('[data-disc]').evaluateAll((els) => els.map((e) => getComputedStyle(e).fill));
  expect(new Set(fills).size).toBe(1);
  // The panel stays after a move (the classes belong to the board).
  await t1.locator('button[data-node="1"]').click();
  await expect(t1).toHaveAttribute('data-moves', '1');
  await expect(panel).toHaveAttribute('data-class-1', '1,3');
  await page.goto(`${ORIGIN}/fixture/triangle-colours/`);
  const tri = page.locator('[data-tool="board"] [data-out="colourClasses"]');
  await expect(tri).toHaveAttribute('data-none', 'true');
  await expect(tri).toHaveText('No two colour classes: the board has a cycle of odd length.');
});

test.describe('regressions', () => {
  // SPEC 8.3: "Icons: a small city for Populations, a small numbered disc for Numbers, used wherever the
  // view is named"; 6.3: the two views have "distinct, fixed accent colours and icons used consistently"
  // (P8). T7's right board ("Letters") is a board of the numbers game played with letters: its node
  // buttons carry data-board="numbers". Its panel carried the city icon and the accent of the
  // Populations view. Adopted from the red team's reproducer (RT-05 attack 38), reading the panel by its
  // data-out wrapper and its accessible name instead of class names.
  // regression: P3-RT-05-10
  test('the Populations icon and accent mark only the Populations view (T7 /tools/symbolic/)', async ({ page }) => {
    await page.goto('tools/symbolic/');
    await page.locator('[data-tool][data-hydrated="true"]').waitFor();
    const r = await page.evaluate(() => {
      const popIcon = 'M1.5 14.5V8.5h3.5v6M5 14.5V3.5h5v11M10 14.5V6.5h4.5v8M0.5 14.5h15M7 6h1M7 9h1M12 9h1';
      const numIcon = 'M8 1.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13ZM6.5 5.75L8.25 4.5v7M6.5 11.5h3.5';
      const panel = document.querySelector('[data-out="symbolicBoard"]') as HTMLElement;
      const paths = [...panel.querySelectorAll('svg path')].map((p) => p.getAttribute('d'));
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-populations').trim();
      return {
        title: panel.getAttribute('aria-label'),
        boards: [...panel.querySelectorAll('button[data-node]')].map((b) => (b as HTMLElement).dataset.board),
        usesPopulationsIcon: paths.includes(popIcon),
        usesNumbersIcon: paths.includes(numIcon),
        border: getComputedStyle(panel).boxShadow,
        accent,
      };
    });
    expect(r.boards.every((b) => b === 'numbers'), 'the Letters board is a numbers board by its hooks').toBe(true);
    expect(r.usesPopulationsIcon, `/tools/symbolic/: panel "${r.title}" (data-board=${r.boards[0]}) carries the Populations city icon`).toBe(false);
    expect(r.border.includes('rgb(0, 158, 115)'), `/tools/symbolic/: panel "${r.title}" bordered in the Populations accent ${r.accent} (${r.border})`).toBe(false);
    // The remedy taken: the Numbers icon and the Numbers accent (#CC79A7), as the left panel.
    expect(r.usesNumbersIcon, `/tools/symbolic/: panel "${r.title}" carries the Numbers icon`).toBe(true);
    expect(r.border, `/tools/symbolic/: panel "${r.title}" bordered in the Numbers accent`).toContain('rgb(204, 121, 167)');
  });
});
