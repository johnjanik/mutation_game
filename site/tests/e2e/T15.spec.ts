// P2-A4: tool T15, the Affine Playground, against the built site (SPEC.md 4 T15, 2.12, 2.3, 2.9, 4.0,
// 5.6, 6.6, 7.4, 7.5, Appendix A.6 and E item 6). Cases are opened on /tools/affine/ through the tabs,
// the picker and the start fields, or by bare query parameters (6.6: every state is a link). Tests
// read only the hooks of 4.0 and the live region (and, where a criterion is about the address bar or a
// download, those). Golden values come from reference/golden_data.json and expected positions from the
// engine in Node, never typed.
//
// Hooks read:
//   root:     data-tool="affine", data-moves, data-hydrated="true"
//   buttons:  data-node, data-board ("populations" or "numbers"), data-value, data-can-act (inside the
//             board's group [data-board-group]); the button's title is the tooltip of a long value
//   drawing:  data-numeral (the numeral drawn on a node), the roads group g.roads
//   tabs:     data-tab="frozen" | "marks-comarks" | "pentagon" | "three-fates", aria-pressed
//   table:    data-table-node (the A-10 table's buttons), data-row, data-table-value
//   strip:    data-step (a strip button of History.svelte)
//   E6:       [data-unverified="E6"] inside data-out="fateSentence"
//   live:     [data-live] (ToolFrame's polite live region)
// data-out names (every one T15 renders; the registry's `outs`):
//   boardName, verdict, moods, rootTest, marks, comarks, coincide, level (data-value), levelSign,
//   sum (data-value), convention (data-convention), fate, firstVisit, fateSentence, provenance,
//   gameOver, moveCounter, historyStrip, historyCounter, busy, predictResult, predictReveal, caption,
//   notice, noscript, exportNotice
// data-control names: step, playOn, martianCity, martian, frozenStart, picker, startField (data-label),
//   convention (aria-pressed), undo, redo, reset, historySlider, copyLink, downloadData,
//   predictAnswer, predictCheck, predictShow
//
// Properties of T15 beyond the common ones of 4.0 Configuration (id, board, coords, start, moves,
// linkTo, prediction, preset, caption, layers):
//   unverifiedMode: 'marked' | 'fallback' | 'plain'   how the row resting on E6 is rendered; default
//                   'fallback'; t15/T15Route.astro passes the build's mode (preview: 'marked')
// linkTo and layers are accepted and ignored. preset: 'default' (= frozen), 'frozen', 'marks-comarks',
// 'pentagon', 'three-fates'.
//
// Announcements asserted (exact, whole sentences): "Played 14 moves to the end. Numbers now 0, 0, 0, 0,
// 1."; "Fired node 1. Node 1 now 1, node 2 now 1, node 5 now minus 2. Move 1."; "Undid move 2. Numbers
// now ..."; "Played 20000 moves; still running after 20000 moves. Numbers now ..." (and the report), the
// numbers computed by the engine (RT-FIX P3-RT-11-08).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CAPS, applyWord, boardFromName, playFate, toLabels, toPositions } from '../../../packages/engine/src/index';
import type { Board } from '../../../packages/engine/src/index';

const ROUTE = 'tools/affine/';
const NOTICE = 'The link could not be read, so the tool shows its default state.';
const ROW_NEGATIVE = 'every legal play ends, after the same number of moves, at the same position';
const ROW_POSITIVE = 'the game never ends and the numbers grow without bound';

const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  affine: Record<string, { marks: number[]; comarks: number[] }>;
  twisted_affine: { name: string; marks: number[]; comarks: number[] }[];
  pentagon_example: { start: number[]; start_olympiad_convention: number[]; level: number; end: number[]; moves: number; word_lowest_node_rule: number[] };
};
const P = golden.pentagon_example;
const big = (name: string): Board<bigint> => boardFromName(name) as Board<bigint>;

/** A value (decimal text) read aloud as SPEC 7.5 A-4 says: negative numbers are spoken as "minus". */
const spoken = (t: string): string => (t.startsWith('-') ? `minus ${t.slice(1)}` : t);

/** The sentence of a play on stopped by the cap (decisions/P2-A4.md), its numbers from the engine in label order. */
function cappedSentence(b: Board<bigint>, start: bigint[]): string {
  const r = playFate(b, start, undefined, CAPS.playMoves);
  expect(r.status).toBe('cap');
  const end = toPositions(b, [...b.labels].sort((x, y) => x - y)).map((p) => spoken(String(r.position[p]!)));
  return `Played ${r.moves} moves; still running after ${CAPS.playMoves} moves. Numbers now ${end.join(', ')}.`;
}

const root = (page: Page): Locator => page.locator('[data-tool="affine"]');
const nodes = (page: Page): Locator => root(page).locator('[data-board-group] button[data-node]');
const node = (page: Page, label: number): Locator => root(page).locator(`[data-board-group] button[data-node="${label}"]`);
const out = (page: Page, name: string): Locator => root(page).locator(`[data-out="${name}"]`);
const control = (page: Page, name: string): Locator => root(page).locator(`[data-control="${name}"]`);
const tabButton = (page: Page, id: string): Locator => root(page).locator(`button[data-tab="${id}"]`);
const live = (page: Page): Locator => root(page).locator('[data-live]');

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`${ROUTE}${query ? `?${query}` : ''}`);
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
}

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

async function pick(page: Page, name: string): Promise<void> {
  await control(page, 'picker').selectOption(name);
  await expect(out(page, 'boardName')).toHaveText(name);
}

async function setStart(page: Page, entries: string[]): Promise<void> {
  const fields = control(page, 'startField');
  await expect(fields).toHaveCount(entries.length);
  for (let k = 0; k < entries.length; k++) await fields.nth(k).fill(entries[k]!);
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

const negate = (xs: readonly (number | string)[]): string[] => xs.map((x) => String(-BigInt(String(x))));

// ---------------------------------------------------------------------------------------------
// The four tabs of SPEC 4 T15
// ---------------------------------------------------------------------------------------------

test('frozen population: every city is happy and a Martian wakes the board', async ({ page }) => {
  await open(page);
  await expect(tabButton(page, 'frozen')).toHaveAttribute('aria-pressed', 'true');
  await expect(out(page, 'boardName')).toHaveText('square');
  await expect(nodes(page)).toHaveCount(4);
  expect(await values(page)).toEqual(['1', '1', '1', '1']);
  for (const b of await nodes(page).all()) {
    await expect(b).toHaveAttribute('data-board', 'populations');
    expect(await b.getAttribute('aria-label')).toMatch(/^City \d, population 1, mutation would change nothing$/);
  }
  await expect(out(page, 'verdict')).toContainText('affine');
  await expect(out(page, 'moods')).toContainText('Every city is happy');
  // A mutation at the marks changes nothing, but it is a move.
  await node(page, 1).click();
  expect(await values(page)).toEqual(['1', '1', '1', '1']);
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  // One Martian in city 1 (the default city): a new start, no moves, and the cities wake up.
  await control(page, 'martian').click();
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  expect(await values(page)).toEqual(['2', '1', '1', '1']);
  await expect(out(page, 'moods')).not.toContainText('Every city is happy');
  await expect(out(page, 'rootTest')).toHaveText('The start is a root population.');
  const before = await values(page);
  await node(page, 2).click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  expect(await values(page)).not.toEqual(before);
});

test('marks and comarks side by side on G2~ and on D4^(3)', async ({ page }) => {
  await open(page);
  await tabButton(page, 'marks-comarks').click();
  await expect(out(page, 'boardName')).toHaveText('G2~');
  await expect(out(page, 'marks')).toHaveText(golden.affine.G2!.marks.join(','));
  await expect(out(page, 'comarks')).toHaveText(golden.affine.G2!.comarks.join(','));
  await expect(out(page, 'coincide')).toContainText('differ');
  await pick(page, 'D4^(3)');
  const rec = golden.twisted_affine.find((t) => t.name === 'D4^(3)')!;
  // Two drawings of the twisted board, labels 0, 1, 2.
  expect(await root(page).locator('[data-board-group]').count()).toBe(2);
  expect(await root(page).locator('[data-board-group]').first().locator('button[data-node]').evaluateAll((els) => els.map((e) => e.getAttribute('data-node')))).toEqual(['0', '1', '2']);
  await expect(out(page, 'marks')).toHaveText(rec.marks.join(','));
  await expect(out(page, 'comarks')).toHaveText(rec.comarks.join(','));
  // Reversing roads exchanges them: D4^(3) is the reverse of G2~.
  expect(rec.marks).toEqual(golden.affine.G2!.comarks);
  expect(rec.comarks).toEqual(golden.affine.G2!.marks);
  await pick(page, 'D4~');
  await expect(out(page, 'coincide')).toContainText('symmetric');
  await expect(out(page, 'marks')).toHaveText(golden.affine.D4!.marks.join(','));
});

test('the pentagon opens in the Olympiad form with the example start', async ({ page }) => {
  await open(page);
  await tabButton(page, 'pentagon').click();
  await expect(nodes(page)).toHaveCount(5);
  expect(await values(page)).toEqual(P.start_olympiad_convention.map(String));
  await expect(out(page, 'convention')).toHaveAttribute('data-convention', 'olympiad');
  await expect(out(page, 'convention')).toContainText('Olympiad form');
  await expect(out(page, 'level')).toHaveAttribute('data-value', String(P.level));
  await expect(out(page, 'sum')).toHaveAttribute('data-value', String(-P.level));
  await expect(out(page, 'levelSign')).toHaveText('negative');
  await expect(out(page, 'fate')).toHaveText('');
  await expect(control(page, 'picker')).toHaveCount(0);
});

test('play on ends the pentagon puzzle after 14 moves', async ({ page }) => {
  await open(page);
  await tabButton(page, 'pentagon').click();
  await control(page, 'playOn').click();
  await expect(out(page, 'fate')).toHaveText(`ended after ${P.moves} moves`);
  await expect(root(page)).toHaveAttribute('data-moves', String(P.moves));
  expect(await values(page)).toEqual(negate(P.end));
  await expect(out(page, 'fateSentence')).toContainText(ROW_NEGATIVE);
  await expect(out(page, 'provenance')).toContainText('GSS12');
  await expect(out(page, 'provenance').locator('a')).toHaveAttribute('href', /sources#GSS12$/);
  await expect(live(page)).toHaveText(`Played ${P.moves} moves to the end. Numbers now ${negate(P.end).map((v) => v.replace(/^-/, 'minus ')).join(', ')}.`);
  expect(`Played ${P.moves} moves to the end. Numbers now ${negate(P.end).join(', ')}.`).toBe('Played 14 moves to the end. Numbers now 0, 0, 0, 0, 1.');
});

test('the convention switch negates every shown value and nothing else', async ({ page }) => {
  await open(page);
  await tabButton(page, 'pentagon').click();
  await control(page, 'convention').click();
  await expect(out(page, 'convention')).toHaveAttribute('data-convention', 'site');
  await expect(control(page, 'convention')).toHaveAttribute('aria-pressed', 'false');
  expect(await values(page)).toEqual(P.start.map(String));
  await expect(out(page, 'level')).toHaveAttribute('data-value', String(P.level));
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await control(page, 'playOn').click();
  await expect(root(page)).toHaveAttribute('data-moves', String(P.moves));
  expect(await values(page)).toEqual(P.end.map(String));
  await expect(out(page, 'level')).toHaveAttribute('data-value', String(P.level));
  await control(page, 'convention').click();
  expect(await values(page)).toEqual(negate(P.end));
  await control(page, 'reset').click();
  await control(page, 'convention').click();
  expect(await values(page)).toEqual(P.start.map(String));
  await expect(out(page, 'level')).toHaveAttribute('data-value', String(P.level));
});

test('in the Olympiad form a negative number is flipped and added to both neighbours', async ({ page }) => {
  await open(page);
  await tabButton(page, 'pentagon').click();
  // Shown positive (negative in the site's convention): may not be fired.
  for (const [k, x] of P.start_olympiad_convention.entries()) {
    await expect(node(page, k + 1)).toHaveAttribute('data-can-act', x < 0 ? 'true' : 'false');
  }
  await node(page, 1).click();
  expect(await values(page)).toEqual(['1', '1', '-3', '4', '-2']);
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await expect(live(page)).toHaveText('Fired node 1. Node 1 now 1, node 2 now 1, node 5 now minus 2. Move 1.');
  // The state stays in the site's convention.
  const n1 = await node(page, 1).getAttribute('aria-label');
  expect(n1).toBe('Node 1, value 1, cannot be fired');
});

// regression: P3-RT-11-08
test('three fates on the square: ended, returned, still running', async ({ page }) => {
  test.setTimeout(120000);
  await open(page);
  await tabButton(page, 'three-fates').click();
  await pick(page, 'square');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  const sq = big('square');
  const cases: [string[], string, 'ended' | 'looped'][] = [
    [['1', '-2', '0', '0'], 'negative', 'ended'],
    [['1', '-1', '0', '0'], 'zero', 'looped'],
  ];
  for (const [start, signWord, status] of cases) {
    await setStart(page, start);
    await expect(out(page, 'levelSign')).toHaveText(signWord);
    // k is computed here, in Node, by the engine.
    const r = playFate(sq, start.map(BigInt), undefined, CAPS.playMoves);
    expect(r.status).toBe(status);
    await control(page, 'playOn').click();
    const k = r.moves === 1 ? '1 move' : `${r.moves} moves`;
    await expect(out(page, 'fate')).toHaveText(status === 'ended' ? `ended after ${k}` : `returned to an earlier position after ${k}`);
    await expect(root(page)).toHaveAttribute('data-moves', String(r.moves));
    if (status === 'looped') await expect(out(page, 'fateSentence')).toContainText('the game never ends and visits only finitely many positions (it loops)');
  }
  await setStart(page, ['1', '0', '0', '0']);
  await expect(out(page, 'levelSign')).toHaveText('positive');
  await control(page, 'playOn').click();
  await expect(out(page, 'fate')).toHaveText('still running after 20000 moves', { timeout: 60000 });
  await expect(root(page)).toHaveAttribute('data-moves', String(CAPS.playMoves));
  await expect(out(page, 'fateSentence')).toContainText(ROW_POSITIVE);
  await expect(out(page, 'provenance')).toContainText('GSS12');
  // The whole sentence (decisions/P2-A4.md), with the numbers computed here by the engine.
  await expect(live(page)).toHaveText(cappedSentence(sq, [1n, 0n, 0n, 0n]));
});

test('on a non-simply-laced board the fate sentence is wrapped as E6', async ({ page }) => {
  await open(page);
  await tabButton(page, 'three-fates').click();
  await pick(page, 'G2~');
  expect(await root(page).locator('[data-control="startField"]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).toEqual(['1', '1', '1']);
  await control(page, 'playOn').click();
  await expect(out(page, 'fate')).toHaveText('still running after 20000 moves', { timeout: 60000 });
  const span = out(page, 'fateSentence').locator('[data-unverified="E6"]');
  await expect(span).toHaveCount(1);
  await expect(span).toContainText(ROW_POSITIVE);
  const cls = await span.getAttribute('class');
  if (cls === 'unverified') {
    await expect(span).toContainText('[unverified E6]');
    await expect(span.locator('a.unverified-mark')).toHaveAttribute('href', /open-items#E6$/);
  } else {
    expect(cls).toBe('unverified-fallback');
    await expect(span).toContainText('computed, with this argument');
    await expect(span).toContainText('The argument beside it:');
    await expect(span.locator('a')).toHaveCount(0);
  }
  // The row appears nowhere outside that element.
  const outside = await root(page).evaluate((el, row) => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-unverified="E6"], [data-live]').forEach((e) => e.remove());
    return (clone.textContent ?? '').includes(row);
  }, ROW_POSITIVE);
  expect(outside).toBe(false);
  await expect(out(page, 'provenance')).not.toContainText('GSS12');
});

test('a twisted board with four roads one way loads', async ({ page }) => {
  await open(page);
  await pick(page, 'A2^(2)');
  expect(await nodes(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-node')))).toEqual(['0', '1']);
  const roads = root(page).locator('svg g.roads');
  await expect(roads).toHaveCount(1);
  expect(await roads.locator('line, path, polygon').count()).toBeGreaterThan(0);
  // The thick line carries its two counts, 1 and 4 (6.2).
  expect((await roads.locator('text').allTextContents()).sort()).toEqual(['1', '4']);
  await expect(out(page, 'verdict')).toHaveText('affine, recognised as A2^(2)');
});

test('links are read and a board the tool does not offer is refused', async ({ page }) => {
  await open(page, 'z=1&g=pentagon&c=n&s=1,-2,3,-4,1&w=1.3');
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await expect(tabButton(page, 'three-fates')).toHaveAttribute('aria-pressed', 'true');
  const pent = big('pentagon');
  expect(await values(page)).toEqual(applyWord(pent, P.start.map(BigInt), toPositions(pent, [1, 3]), 'firing').map(String));
  await expect(out(page, 'notice')).toHaveCount(0);
  await open(page, 'g=A3');
  await expect(out(page, 'notice')).toHaveText(NOTICE);
  expect(await values(page)).toEqual(['1', '1', '1', '1']);
  // A move legal play forbids (node 2 holds -2) is refused too.
  await open(page, 'z=1&g=pentagon&c=n&s=1,-2,3,-4,1&w=2');
  await expect(out(page, 'notice')).toHaveText(NOTICE);
  await expect(root(page)).toHaveAttribute('data-moves', '0');
});

test('keyboard on the polygon wraps and targets are 44 at 320 pixels', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await open(page);
  await tabButton(page, 'pentagon').click();
  const focusable = await nodes(page).evaluateAll((els) => els.filter((e) => e.getAttribute('tabindex') === '0').length);
  expect(focusable).toBe(1);
  await node(page, 5).focus();
  await page.keyboard.press('ArrowRight');
  await expect(node(page, 1)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(node(page, 5)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  for (const b of await nodes(page).all()) {
    const box = (await b.boundingBox())!;
    expect(Math.round(box.width)).toBe(44);
    expect(Math.round(box.height)).toBe(44);
  }
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(320);
});

test('the default figure renders without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const nojs = await context.newPage();
  await nojs.goto(ROUTE);
  await expect(nodes(nojs)).toHaveCount(4);
  expect(await values(nojs)).toEqual(['1', '1', '1', '1']);
  await expect(root(nojs).locator('svg.drawing')).toHaveCount(1);
  await expect(out(nojs, 'caption')).toContainText('frozen population');
  await expect(root(nojs).locator('details table')).toHaveCount(1);
  for (const el of await root(nojs).locator('button, select, input').all()) await expect(el).toBeDisabled();
  await expect(out(nojs, 'noscript')).toHaveText('Interactive when scripts are allowed.');
  await context.close();
});

test('the affine route has no serious or critical axe violations', async ({ page }) => {
  await open(page);
  for (const id of ['frozen', 'marks-comarks', 'pentagon', 'three-fates']) {
    await tabButton(page, id).click();
    const results = await new AxeBuilder({ page }).include('[data-tool="affine"]').analyze();
    const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${id}: ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join('; ')}`)).toEqual([]);
  }
});

// ---------------------------------------------------------------------------------------------
// History (4.0), long numbers, export, the table, the worker
// ---------------------------------------------------------------------------------------------

// regression: P3-RT-11-08
test('undo, redo and reset restore the positions and the move count', async ({ page }) => {
  await open(page);
  await tabButton(page, 'pentagon').click();
  const pent = big('pentagon');
  const shownAfter = (k: number): string[] =>
    applyWord(pent, P.start.map(BigInt), toPositions(pent, P.word_lowest_node_rule.slice(0, k)), 'firing').map((x) => String(-x));
  await control(page, 'step').click();
  await control(page, 'step').click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  expect(await values(page)).toEqual(shownAfter(2));
  await control(page, 'undo').click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  expect(await values(page)).toEqual(shownAfter(1));
  await expect(live(page)).toHaveText(`Undid move 2. Numbers now ${shownAfter(1).map(spoken).join(', ')}.`);
  await control(page, 'redo').click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  expect(await values(page)).toEqual(shownAfter(2));
  await control(page, 'reset').click();
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  expect(await values(page)).toEqual(P.start_olympiad_convention.map(String));
});

test('acting from an earlier position discards the moves after it', async ({ page }) => {
  await open(page);
  await tabButton(page, 'three-fates').click();
  await control(page, 'step').click();
  await control(page, 'step').click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  // The first two moves of the lowest-node rule.
  await page.waitForTimeout(700);
  expect(new URL(page.url()).searchParams.get('w')).toBe(P.word_lowest_node_rule.slice(0, 2).join('.'));
  await root(page).locator('[data-step="1"]').click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await expect(node(page, 5)).toHaveAttribute('data-can-act', 'true');
  await node(page, 5).click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  const pent = big('pentagon');
  const expected = applyWord(pent, P.start.map(BigInt), toPositions(pent, [1, 5]), 'firing').map(String);
  expect(await values(page)).toEqual(expected);
  await page.waitForTimeout(700);
  expect(new URL(page.url()).searchParams.get('w')).toBe('1.5');
  // Redo has nothing to put back.
  await expect(root(page).locator('[data-step]')).toHaveCount(3);
  await control(page, 'redo').click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  expect(await values(page)).toEqual(expected);
});

test('after play on the history is a slider with a counter and can be scrubbed', async ({ page }) => {
  test.setTimeout(120000);
  await open(page);
  await tabButton(page, 'three-fates').click();
  await pick(page, 'square');
  await setStart(page, ['1', '0', '0', '0']);
  await control(page, 'playOn').click();
  await expect(out(page, 'fate')).toHaveText('still running after 20000 moves', { timeout: 60000 });
  const slider = control(page, 'historySlider');
  await expect(slider).toHaveCount(1);
  await expect(out(page, 'historyCounter')).toHaveText(`${CAPS.playMoves} of ${CAPS.playMoves}`);
  const sq = big('square');
  const r = playFate(sq, [1n, 0n, 0n, 0n], undefined, CAPS.playMoves);
  const setSlider = async (v: number): Promise<void> => {
    await slider.evaluate((el, value) => {
      const input = el as HTMLInputElement;
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, v);
  };
  await setSlider(14);
  await expect(root(page)).toHaveAttribute('data-moves', '14');
  await expect(out(page, 'historyCounter')).toHaveText(`14 of ${CAPS.playMoves}`);
  expect(await values(page)).toEqual(applyWord(sq, [1n, 0n, 0n, 0n], r.word.slice(0, 14), 'firing').map(String));
  // A far position comes from the worker.
  await setSlider(10000);
  await expect(root(page)).toHaveAttribute('data-moves', '10000');
  expect(await values(page)).toEqual(applyWord(sq, [1n, 0n, 0n, 0n], r.word.slice(0, 10000), 'firing').map(String));
  await setSlider(CAPS.playMoves);
  await expect(root(page)).toHaveAttribute('data-moves', String(CAPS.playMoves));
  expect(await values(page)).toEqual(r.position.map(String));
  expect(toLabels(sq, r.word.slice(0, 3)).length).toBe(3);
});

test('long numbers are shortened on screen and exact in the table and the hooks', async ({ page }) => {
  await open(page);
  await tabButton(page, 'three-fates').click();
  const field = control(page, 'startField').first();
  await field.fill('1234567890123');
  await expect(node(page, 1)).toHaveAttribute('data-value', '1234567890123');
  await expect(node(page, 1)).toHaveAttribute('title', '1234567890123');
  await expect(root(page).locator('text[data-numeral="1"]')).toHaveText('1.2345... x 10^12 (13 digits)');
  // Level 1234567890123 - 2 + 3 - 4 + 1, from the engine: 13 digits, shortened, exact in data-value.
  await expect(out(page, 'level')).toHaveAttribute('data-value', '1234567890121');
  await expect(out(page, 'level')).toHaveText('1.2345... x 10^12 (13 digits)');
  await root(page).locator('summary').filter({ hasText: 'Show as table' }).click();
  await expect(root(page).locator('tr[data-row="1"] [data-table-value="value"]')).toHaveText('1234567890123');
  await expect(root(page).locator('tr[data-row="level"] [data-table-value="level"]')).toHaveText('1234567890121');
  // A 41-digit entry is refused: the field keeps what it held.
  await field.fill('1'.repeat(41));
  await expect(field).toHaveValue('1234567890123');
  await expect(node(page, 1)).toHaveAttribute('data-value', '1234567890123');
  await field.fill('1'.repeat(40));
  await expect(node(page, 1)).toHaveAttribute('data-value', '1'.repeat(40));
});

test('download data carries the state, level, marks, comarks and report', async ({ page }) => {
  await open(page);
  await tabButton(page, 'pentagon').click();
  await control(page, 'playOn').click();
  await expect(out(page, 'fate')).toHaveText(`ended after ${P.moves} moves`);
  const [download] = await Promise.all([page.waitForEvent('download'), control(page, 'downloadData').click()]);
  const doc = JSON.parse(readFileSync((await download.path())!, 'utf8')) as {
    tool: string;
    state: { board: string; coords: string; start: number[]; moves: number[] };
    derived: { level: number; marks: number[]; comarks: number[]; report: string; convention: string };
  };
  expect(doc.tool).toBe('affine');
  expect(doc.state.board).toBe('pentagon');
  expect(doc.state.coords).toBe('numbers');
  expect(doc.state.start).toEqual(P.start);
  expect(doc.state.moves).toEqual(P.word_lowest_node_rule);
  expect(doc.derived.level).toBe(P.level);
  expect(doc.derived.marks).toEqual([1, 1, 1, 1, 1]);
  expect(doc.derived.comarks).toEqual([1, 1, 1, 1, 1]);
  expect(doc.derived.report).toBe(`ended after ${P.moves} moves`);
  expect(doc.derived.convention).toBe('olympiad');
});

test('the table view has a button per node that acts', async ({ page }) => {
  await open(page);
  await tabButton(page, 'pentagon').click();
  await root(page).locator('summary').filter({ hasText: 'Show as table' }).click();
  const rows = root(page).locator('details tbody tr[data-row]:not([data-row="level"])');
  await expect(rows).toHaveCount(5);
  await expect(root(page).locator('details [data-table-node]')).toHaveCount(5);
  await root(page).locator('details [data-table-node="1"]').click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
});

test('the worker is fetched only when play on is pressed', async ({ page }) => {
  const fetched: string[] = [];
  page.on('request', (req) => {
    if (/engine\.worker/.test(req.url())) fetched.push(req.url());
  });
  await open(page);
  await tabButton(page, 'pentagon').click();
  await page.waitForTimeout(500);
  expect(fetched).toEqual([]);
  await control(page, 'playOn').click();
  await expect(out(page, 'fate')).toHaveText(`ended after ${P.moves} moves`);
  expect(fetched.length).toBeGreaterThan(0);
});

// regression: P3-RT-11-08
test('announcements of a capped play, recorded', async ({ page }) => {
  test.setTimeout(120000);
  await open(page);
  await tabButton(page, 'three-fates').click();
  await pick(page, 'square');
  await setStart(page, ['1', '0', '0', '0']);
  const read = await recordLive(page);
  await control(page, 'playOn').click();
  await expect(out(page, 'fate')).toHaveText('still running after 20000 moves', { timeout: 60000 });
  await expect.poll(async () => (await read()).length).toBeGreaterThan(0);
  const said = await read();
  expect(said[said.length - 1]).toBe(cappedSentence(big('square'), [1n, 0n, 0n, 0n]));
});
