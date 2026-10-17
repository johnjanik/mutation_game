// P3-A3: tool T5, the Numbers Game Lab, against the built site (SPEC.md 4 T5, 4.0, 2.7 F3 F4 F7 F8 F9,
// 6.6, 7.4, 7.5, 7.6; Appendix A.2, A.3). Cases are opened by bare query parameters on /tools/numbers/
// (6.6: every state is a link) or through the controls. Configurations that only properties reach (the
// compared preset, a prediction) are bundled here with Vite and served from a stub origin, as
// T09.spec.ts does, because no page of this stage places T5 with them. Tests read only the hooks of
// 4.0 and the live region (and, where a criterion is about the address bar, the clipboard, a download
// or an element's box, those). Golden values are read from reference/golden_data.json, never typed.
//
// Hooks read:
//   root:    data-tool="numbers", data-moves, data-hydrated="true", data-instance (fixture instances)
//   buttons: data-node, data-board ("numbers"), data-value, data-can-act, data-sign; the button's title
//            is the tooltip of a long value
//   drawing: data-numeral, data-disc (Board.svelte), data-colour-shape and data-shape-node (the wave's
//            marks over the board), data-row (a row of the sideways reading on the tally chart)
//   groups:  data-board-group (a board's group of node buttons), data-game-b (game B's part)
//   tabs:    data-tab (each tab button, role="tab", aria-selected), data-panel (the tab panel)
//   boxes:   data-scroll="tally" (the tally chart's own scroll box, A-11)
//   table:   data-table-node, data-table-value, data-table-exact ("D", "M", "dimension")
//   strip:   data-step (History.svelte), data-round (a round of the wave made so far)
//   live:    [data-live] (ToolFrame's polite live region)
// data-out names (every one T5 renders; the registry's `outs`):
//   caption, notice, noscript, exportNotice (ToolFrame); moveCounter, historyStrip, historyCounter
//   (History); predictResult, predictReveal (Predict); startKind (data-kind), tape (data-count),
//   tallyBar (data-fired, data-count), tallyNote, exponents, exponentProduct, groupOrder, gameOver,
//   limit, waveRounds, waveLegal (data-legal), waveNote, coxeterNumber, colourClass (data-colour,
//   data-nodes), sortedA, sortedB, tapesAgree, compareStatus, endA, endB, movesA, movesB, lambda,
//   tapeRho, tapeLambdaRho, productRho, productLambdaRho (both with data-exact), dimension, dimensionNote
// data-control names: step, playToEnd, startKind, fundamentalNode, customEntry (data-entry-node),
//   customStart, picker, tab, firstColour, startWave, stepB, playToEndB, resetB, lambda
//   (data-lambda-node), undo, redo, reset, historySlider (History), copyLink, downloadData (ToolFrame),
//   predictAnswer, predictCheck, predictShow (Predict); data-export="svg" and "png" (ToolFrame)
//
// Properties of T5 beyond the common ones of 4.0 Configuration (id, board, coords, start, moves,
// linkTo, prediction, preset, caption, layers):
//   tab: 'tape' | 'tally' | 'wave' | 'compared' | 'dimension'   the tab shown first (not in a link)
//   lambda: number[]          lambda of the dimension calculator, label order (also the state field)
//   firstColour: 0 | 1        the colour class that starts the wave (not in a link)
//   secondMoves: number[]     game B's moves of "two games compared", labels (not in a link)
//   boardChoices: string[]    the boards the picker offers (default: the 32 named types)
// coords accepts only 'numbers'; linkTo and layers are accepted and ignored (T5 follows no tool and
// grows no set of positions). preset: default, tally, wave, compared, dimension.
import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { ssrLoader } from '../unit/_svelteSsr';

const ROUTE = 'tools/numbers/';
const NOTICE = 'The link could not be read, so the tool shows its default state.';
const MINUS = '−';

interface TypeRecord {
  exponents: number[];
  weyl_order: number;
  fired_tally: Record<string, number>;
  fired_values: number[];
  coxeter_number: number;
  longest_word: number[];
}
const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  types: Record<string, TypeRecord>;
  weyl_dimension: { type: string; highest_weight: number[]; dimension: number }[];
};
const T = golden.types;

const root = (page: Page, instance?: string): Locator =>
  instance === undefined ? page.locator('[data-tool="numbers"]').first() : page.locator(`[data-tool="numbers"][data-instance="${instance}"]`);
const nodesA = (r: Locator): Locator => r.locator('button[data-node]:not([data-game-b] button)');
const nodesB = (r: Locator): Locator => r.locator('[data-game-b] button[data-node]');
const nodeA = (r: Locator, label: number): Locator => r.locator(`button[data-node="${label}"]:not([data-game-b] button)`);
const out = (r: Locator, name: string): Locator => r.locator(`[data-out="${name}"]`);
const control = (r: Locator, name: string): Locator => r.locator(`[data-control="${name}"]`);
const tabButton = (r: Locator, id: string): Locator => r.locator(`[data-tab="${id}"]`);
const live = (r: Locator): Locator => r.locator('[data-live]');

async function open(page: Page, query = ''): Promise<Locator> {
  await page.goto(`${ROUTE}${query ? `?${query}` : ''}`);
  const r = root(page);
  await expect(r).toHaveAttribute('data-hydrated', 'true');
  return r;
}

async function valuesOf(list: Locator): Promise<string[]> {
  const pairs = await list.evaluateAll((bs) => bs.map((b) => [Number(b.getAttribute('data-node')), b.getAttribute('data-value') ?? ''] as [number, string]));
  return pairs.sort((x, y) => x[0] - y[0]).map((p) => p[1]);
}

/** Records every non-empty text written to the live region from now on. */
async function recordLive(r: Locator): Promise<() => Promise<string[]>> {
  await r.evaluate((el) => {
    const region = el.querySelector('[data-live]')!;
    const w = window as unknown as { __live: string[] };
    w.__live = [];
    new MutationObserver(() => {
      const t = region.textContent ?? '';
      if (t !== '') w.__live.push(t);
    }).observe(region, { childList: true, characterData: true, subtree: true });
  });
  return () => r.page().evaluate(() => (window as unknown as { __live: string[] }).__live);
}

const list = (v: readonly (number | string)[]): string => v.map(String).join(', ');

/** Null when two texts are equal, else the neighbourhood of their first difference (a readable failure). */
function firstDifference(a: string, b: string): string | null {
  if (a === b) return null;
  let k = 0;
  while (k < a.length && k < b.length && a[k] === b[k]) k++;
  return `at ${k}: ...${a.slice(Math.max(0, k - 80), k + 80)}... versus ...${b.slice(Math.max(0, k - 80), k + 80)}...`;
}

// ---------------------------------------------------------------------------------------------
// The named examples (SPEC 4 T5 acceptance, Appendix A.2 and A.3, M5 rows 6 to 8)
// ---------------------------------------------------------------------------------------------

test('A3 tally read sideways gives exponents 1, 2, 3 and 24', async ({ page }) => {
  const r = await open(page, 'g=A3&c=n&s=1,1,1&w=');
  await expect(tabButton(r, 'tally')).toHaveAttribute('aria-selected', 'true');
  await expect(r).toHaveAttribute('data-moves', '0');
  await expect(out(r, 'tallyNote')).toHaveCount(1);
  for (let k = 0; k < 6; k++) {
    await expect(out(r, 'exponents')).toHaveCount(0);
    await control(r, 'step').click();
  }
  await expect(r).toHaveAttribute('data-moves', '6');
  const bars = await out(r, 'tallyBar').evaluateAll((gs) => gs.map((g) => [g.getAttribute('data-fired'), Number(g.getAttribute('data-count'))]));
  expect(bars).toEqual(Object.entries(T.A3!.fired_tally));
  await expect(out(r, 'exponents')).toHaveText(list(T.A3!.exponents));
  await expect(out(r, 'exponentProduct')).toHaveText(String(T.A3!.weyl_order));
  await expect(out(r, 'groupOrder')).toHaveText(String(T.A3!.weyl_order));
  await expect(out(r, 'gameOver')).toHaveText('Game over after 6 moves.');
  await expect(out(r, 'tape')).toHaveText(list(T.A3!.fired_values));
});

test('A3 wave takes 4 rounds', async ({ page }) => {
  const r = await open(page, 'g=A3&c=n&s=1,1,1&w=');
  await tabButton(r, 'wave').click();
  await expect(out(r, 'waveRounds')).toHaveText('0');
  await expect(out(r, 'coxeterNumber')).toHaveText(String(T.A3!.coxeter_number));
  // Appendix A.2: fire nodes 1, 3: (-1,3,-1); fire nodes 2: (2,-3,2); fire nodes 1, 3: (-2,1,-2); fire nodes 2: (-1,-1,-1).
  const after = [
    ['-1', '3', '-1'],
    ['2', '-3', '2'],
    ['-2', '1', '-2'],
    ['-1', '-1', '-1'],
  ];
  const recorded = await recordLive(r);
  for (let k = 0; k < 4; k++) {
    await control(r, 'step').click();
    expect(await valuesOf(nodesA(r))).toEqual(after[k]);
    await expect(out(r, 'waveRounds')).toHaveText(String(k + 1));
  }
  await expect(out(r, 'waveRounds')).toHaveText(String(T.A3!.coxeter_number));
  await expect(r).toHaveAttribute('data-moves', '6');
  await expect(out(r, 'waveLegal')).toHaveAttribute('data-legal', 'true');
  await expect(r.locator('[data-round]')).toHaveCount(4);
  await expect(control(r, 'step')).toBeDisabled();
  await expect.poll(recorded).toContainEqual(expect.stringContaining('Round 4.'));
  // The other colour first also takes h rounds.
  await control(r, 'reset').click();
  await r.locator('[data-control="firstColour"][value="1"]').check();
  await control(r, 'playToEnd').click();
  await expect(out(r, 'waveRounds')).toHaveText(String(T.A3!.coxeter_number));
  await expect(r).toHaveAttribute('data-moves', '6');
});

test('A1 wave says it is a single move', async ({ page }) => {
  const r = await open(page, 'g=A1');
  await tabButton(r, 'wave').click();
  await expect(out(r, 'waveNote')).toHaveText('On A1 one colour class is empty: the wave is a single move.');
  await expect(out(r, 'waveRounds')).toHaveCount(0);
  await expect(control(r, 'firstColour')).toHaveCount(0);
  await control(r, 'step').click();
  await expect(r).toHaveAttribute('data-moves', '1');
  await expect(out(r, 'waveRounds')).toHaveCount(0);
  await expect(out(r, 'waveNote')).toContainText('single move');
  await expect(out(r, 'gameOver')).toHaveText('Game over after 1 move.');
});

test('dimension on A2 with lambda (1, 1) gives 8', async ({ page }) => {
  const r = await open(page, 'g=A2');
  await tabButton(r, 'dimension').click();
  await r.locator('[data-control="lambda"][data-lambda-node="1"]').fill('1');
  await r.locator('[data-control="lambda"][data-lambda-node="2"]').fill('1');
  const check = async (x: Locator): Promise<void> => {
    await expect(out(x, 'lambda')).toHaveText('(1, 1)');
    await expect(out(x, 'tapeRho')).toHaveText('1, 2, 1');
    await expect(out(x, 'tapeLambdaRho')).toHaveText('2, 4, 2');
    await expect(out(x, 'productRho')).toHaveText('2');
    await expect(out(x, 'productLambdaRho')).toHaveText('16');
    const rec = golden.weyl_dimension.find((d) => d.type === 'A2' && d.highest_weight.join(',') === '1,1')!;
    await expect(out(x, 'dimension')).toHaveText(String(rec.dimension));
  };
  await check(r);
  const r2 = await open(page, 'g=A2&d=1,1');
  await tabButton(r2, 'dimension').click();
  await check(r2);
  await expect(r2.locator('[data-control="lambda"][data-lambda-node="1"]')).toHaveValue('1');
});

test('E8 play to the end shows the tally, the exponents and 696729600', async ({ page }) => {
  const r = await open(page, 'g=E8');
  const recorded = await recordLive(r);
  await control(r, 'playToEnd').click();
  await expect(r).toHaveAttribute('data-moves', String(T.E8!.longest_word.length));
  await expect(r.locator('[data-out="tallyBar"][data-fired="1"]')).toHaveAttribute('data-count', String(T.E8!.fired_tally['1']));
  await expect(r.locator('[data-out="tallyBar"][data-fired="29"]')).toHaveAttribute('data-count', String(T.E8!.fired_tally['29']));
  await expect(out(r, 'exponents')).toHaveText(list(T.E8!.exponents));
  await expect(out(r, 'groupOrder')).toHaveText(String(T.E8!.weyl_order));
  await expect(out(r, 'exponentProduct')).toHaveText(String(T.E8!.weyl_order));
  await page.waitForTimeout(1200);
  const said = await recorded();
  expect(said).toHaveLength(1);
  expect(said[0]).toMatch(/^Played 120 moves to the end\. Numbers now /);
});

test('E8 play to the end makes no long task and fetches no worker', async ({ page }) => {
  const requests: string[] = [];
  const workers: string[] = [];
  page.on('request', (q) => requests.push(q.url()));
  page.on('worker', (w) => workers.push(w.url()));
  const r = await open(page, 'g=E8');
  await page.evaluate(() => {
    const w = window as unknown as { __long: number[] };
    w.__long = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__long.push(e.duration);
    }).observe({ type: 'longtask' });
  });
  await control(r, 'playToEnd').click();
  await expect(r).toHaveAttribute('data-moves', '120');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as { __long: number[] }).__long)).toEqual([]);
  expect(requests.filter((u) => /engine\.worker/.test(u))).toEqual([]);
  expect(workers).toEqual([]);
});

test('E8 dimension for lambda omega_1 shows 3875 and shortened products with exact digits in the table view', async ({ page }) => {
  const r = await open(page, 'g=E8&d=1,0,0,0,0,0,0,0');
  await tabButton(r, 'dimension').click();
  const rec = golden.weyl_dimension.find((d) => d.type === 'E8' && d.highest_weight.join(',') === '1,0,0,0,0,0,0,0')!;
  await expect(out(r, 'dimension')).toHaveText(String(rec.dimension));
  const D = (await out(r, 'productRho').getAttribute('data-exact'))!;
  const M = (await out(r, 'productLambdaRho').getAttribute('data-exact'))!;
  expect(D).toMatch(/^\d{107}$/);
  expect(M).toMatch(/^\d{110}$/);
  expect(BigInt(M) / BigInt(D)).toBe(BigInt(rec.dimension));
  expect(BigInt(M) % BigInt(D)).toBe(0n);
  await expect(out(r, 'productRho')).toHaveText(`${D[0]}.${D.slice(1, 5)}... x 10^106 (107 digits)`);
  await expect(out(r, 'productLambdaRho')).toHaveText(`${M[0]}.${M.slice(1, 5)}... x 10^109 (110 digits)`);
  // The exact digits in the tooltip (the SVG <title> of the product) and in the table view.
  expect(await out(r, 'productRho').evaluate((el) => el.parentElement?.querySelector('title')?.textContent)).toBe(D);
  await r.locator('details summary').first().click();
  await expect(r.locator('[data-table-exact="D"]')).toHaveText(D);
  await expect(r.locator('[data-table-exact="M"]')).toHaveText(M);
});

test('B2 tape is 1, 3, 2, 1 and the tally reads exponents 1, 3', async ({ page }) => {
  const r = await open(page, 'g=B2');
  await control(r, 'playToEnd').click();
  await expect(out(r, 'tape')).toHaveText(list(T.B2!.fired_values));
  await expect(out(r, 'tape')).toHaveText('1, 3, 2, 1');
  await expect(out(r, 'exponents')).toHaveText(list(T.B2!.exponents));
  await expect(out(r, 'groupOrder')).toHaveText(String(T.B2!.weyl_order));
});

test('the start chooser sets all ones, a fundamental weight and a custom start and resets the moves', async ({ page }) => {
  const r = await open(page);
  await expect(r).toHaveAttribute('data-moves', '6');
  await expect(out(r, 'startKind')).toHaveAttribute('data-kind', 'ones');
  await control(r, 'startKind').selectOption('fundamental');
  await expect(r).toHaveAttribute('data-moves', '0');
  expect(await valuesOf(nodesA(r))).toEqual(['1', '0', '0']);
  await control(r, 'fundamentalNode').selectOption({ label: '2' });
  expect(await valuesOf(nodesA(r))).toEqual(['0', '1', '0']);
  await expect(out(r, 'startKind')).toHaveAttribute('data-kind', 'fundamental');
  await control(r, 'step').click();
  await expect(r).toHaveAttribute('data-moves', '1');
  // The reading sideways never applies from a fundamental weight.
  await control(r, 'playToEnd').click();
  await expect(out(r, 'exponents')).toHaveCount(0);
  await expect(out(r, 'tallyNote')).toHaveCount(1);
  await control(r, 'startKind').selectOption('custom');
  for (const [l, v] of [[1, '2'], [2, '−1'], [3, '3']] as const) await r.locator(`[data-control="customEntry"][data-entry-node="${l}"]`).fill(v);
  await control(r, 'customStart').click();
  await expect(r).toHaveAttribute('data-moves', '0');
  expect(await valuesOf(nodesA(r))).toEqual(['2', '-1', '3']);
  await expect(out(r, 'startKind')).toHaveAttribute('data-kind', 'custom');
  // Oracle: from (2, -1, 3) the lowest-node game fires 2, 1, 4, 3, 2 and ends at (-2, -1, -1).
  await control(r, 'playToEnd').click();
  await expect(out(r, 'tape')).toHaveText('2, 1, 4, 3, 2');
  await control(r, 'startKind').selectOption('ones');
  await expect(r).toHaveAttribute('data-moves', '0');
  expect(await valuesOf(nodesA(r))).toEqual(['1', '1', '1']);
});

// ---------------------------------------------------------------------------------------------
// 4.0 rules, 7.4, 7.5, 7.6
// ---------------------------------------------------------------------------------------------

test('every node button carries data-node, data-board, data-value and data-can-act; the root carries data-tool="numbers" and data-moves', async ({ page }) => {
  const r = await open(page, 'g=D4');
  await expect(r).toHaveAttribute('data-tool', 'numbers');
  await expect(r).toHaveAttribute('data-moves', '0');
  const hooks = await nodesA(r).evaluateAll((bs) => bs.map((b) => [b.getAttribute('data-node'), b.getAttribute('data-board'), b.getAttribute('data-value'), b.getAttribute('data-can-act')]));
  expect(hooks).toEqual([
    ['1', 'numbers', '1', 'true'],
    ['2', 'numbers', '1', 'true'],
    ['3', 'numbers', '1', 'true'],
    ['4', 'numbers', '1', 'true'],
  ]);
  await control(r, 'step').click();
  await expect(r).toHaveAttribute('data-moves', '1');
  await expect(nodeA(r, 1)).toHaveAttribute('data-value', '-1');
  await expect(nodeA(r, 1)).toHaveAttribute('data-can-act', 'false');
});

test('a link restores board, start, moves and lambda; undo and redo restore positions exactly; reset empties the moves', async ({ page }) => {
  const r = await open(page, 'g=A3&c=n&s=2,-1,3&w=1.2&d=1,0,2');
  await expect(r).toHaveAttribute('data-moves', '2');
  expect(await valuesOf(nodesA(r))).toEqual(['-1', '-1', '4']);
  await control(r, 'undo').click();
  expect(await valuesOf(nodesA(r))).toEqual(['-2', '1', '3']);
  await expect(r).toHaveAttribute('data-moves', '1');
  await control(r, 'redo').click();
  expect(await valuesOf(nodesA(r))).toEqual(['-1', '-1', '4']);
  await control(r, 'reset').click();
  await expect(r).toHaveAttribute('data-moves', '0');
  expect(await valuesOf(nodesA(r))).toEqual(['2', '-1', '3']);
  await tabButton(r, 'dimension').click();
  await expect(out(r, 'lambda')).toHaveText('(1, 0, 2)');
  // A move the legal rule forbids loads the defaults with the notice.
  const bad = await open(page, 'g=A3&c=n&s=1,1,1&w=1.1');
  await expect(out(bad, 'notice')).toHaveText(NOTICE);
  await expect(bad).toHaveAttribute('data-moves', '6');
});

test('after E8 play to the end the history strip is a slider with a counter; on A3 it is a strip', async ({ page }) => {
  const r = await open(page, 'g=E8');
  await control(r, 'playToEnd').click();
  const slider = control(r, 'historySlider');
  await expect(slider).toHaveCount(1);
  await expect(out(r, 'historyCounter')).toHaveText('120 of 120');
  const before = await valuesOf(nodesA(r));
  await slider.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(out(r, 'historyCounter')).toHaveText('119 of 120');
  expect(await valuesOf(nodesA(r))).not.toEqual(before);
  await expect(r).toHaveAttribute('data-moves', '119');
  const a3 = await open(page);
  await expect(control(a3, 'historySlider')).toHaveCount(0);
  await expect(a3.locator('[data-step]')).toHaveCount(7);
});

test('no control acts on load and nothing moves by itself', async ({ page }) => {
  for (const query of ['g=E8', '']) {
    const r = await open(page, query);
    const moves = await r.getAttribute('data-moves');
    const values = await valuesOf(nodesA(r));
    await page.waitForTimeout(2000);
    await expect(r).toHaveAttribute('data-moves', moves!);
    expect(await valuesOf(nodesA(r))).toEqual(values);
    await expect(live(r)).toHaveText('');
  }
});

test('under reduced motion a step updates the board instantly', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, reducedMotion: 'reduce', viewport: { width: 360, height: 800 } });
  const page = await context.newPage();
  const r = await open(page, 'g=A3&c=n&s=1,1,1&w=');
  await control(r, 'step').click();
  await expect(nodeA(r, 1)).toHaveAttribute('data-value', '-1');
  await expect(r.locator('[data-numeral="1"]').first()).toHaveText(`${MINUS}1`);
  const running = await r.evaluate((el) => [...el.querySelectorAll('[data-disc], [data-out="tallyBar"] rect')].reduce((n, d) => n + d.getAnimations().length, 0));
  expect(running).toBe(0);
  await context.close();
});

test('node hit areas are 44 pixels on A3 and 43 on E8 at 320 pixels, never below 24, with no overlap', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const [query, least] of [
    ['', 44],
    ['g=E8', 43],
  ] as const) {
    const r = await open(page, query);
    await checkHitAreas(nodesA(r), least, query);
    for (const b of await r.locator('[data-control="step"], [data-control="playToEnd"], [data-tab]').all()) {
      const box = (await b.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(24);
      expect(box.height).toBeGreaterThanOrEqual(24);
    }
  }
});

async function checkHitAreas(list: Locator, least: number, what: string): Promise<void> {
  const boxes: { x: number; y: number; width: number; height: number }[] = [];
  for (const b of await list.all()) {
    const box = (await b.boundingBox())!;
    boxes.push(box);
    expect(Math.round(box.width), what).toBeGreaterThanOrEqual(least);
    expect(Math.round(box.height), what).toBeGreaterThanOrEqual(least);
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      const overlap = a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
      expect(overlap, `${what}: nodes ${i} and ${j} overlap`).toBe(false);
    }
  }
}

test('copy link encodes the current state', async ({ page }) => {
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
  const r = await open(page, 'g=A3&c=n&s=1,1,1&w=');
  await control(r, 'step').click();
  await control(r, 'step').click();
  await tabButton(r, 'dimension').click();
  await r.locator('[data-control="lambda"][data-lambda-node="2"]').fill('3');
  await r.locator('[data-tab="wave"]').click();
  await control(r, 'copyLink').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __copied?: string }).__copied ?? '')).not.toBe('');
  const copied = await page.evaluate(() => (window as unknown as { __copied: string }).__copied);
  const params = new URL(copied).searchParams;
  expect(params.get('g')).toBe('A3');
  expect(params.get('c')).toBe('n');
  expect(params.get('s')).toBe('1,1,1');
  expect(params.get('w')).toBe('1.2');
  expect(params.get('d')).toBe('0,3,0');
  for (const key of params.keys()) expect(['z', 'g', 'c', 's', 'w', 'd']).toContain(key);
  expect(copied).not.toMatch(/tab|firstColour|secondMoves/);
  const values = await valuesOf(nodesA(r));
  await page.goto(copied);
  const again = root(page);
  await expect(again).toHaveAttribute('data-hydrated', 'true');
  await expect(again).toHaveAttribute('data-moves', '2');
  expect(await valuesOf(nodesA(again))).toEqual(values);
});

test('download data gives JSON with the state, engine version, commit and the derived tables', async ({ page }) => {
  const download = async (r: Locator): Promise<Record<string, any>> => { // any: a parsed JSON file read field by field
    const [d] = await Promise.all([page.waitForEvent('download'), control(r, 'downloadData').click()]);
    return JSON.parse(readFileSync((await d.path())!, 'utf8'));
  };
  const r = await open(page, 'g=A3&c=n&s=1,1,1&w=');
  await control(r, 'playToEnd').click();
  const doc = await download(r);
  expect(doc.tool).toBe('numbers');
  expect(doc.state).toMatchObject({ board: 'A3', coords: 'numbers', start: [1, 1, 1], moves: T.A3!.longest_word });
  expect(typeof doc.engineVersion).toBe('string');
  expect(typeof doc.commit).toBe('string');
  expect(doc.derived.positions).toHaveLength(7);
  expect(doc.derived.tapeValues).toEqual(T.A3!.fired_values);
  expect(doc.derived.tally).toEqual(T.A3!.fired_tally);
  expect(doc.derived.exponents).toEqual(T.A3!.exponents);
  expect(doc.derived.exponentProduct).toBe(T.A3!.weyl_order);
  expect(doc.derived.groupOrder).toBe(T.A3!.weyl_order);
  // After the wave on A3: the rounds with their node labels.
  await control(r, 'reset').click();
  await tabButton(r, 'wave').click();
  await control(r, 'playToEnd').click();
  const wave = await download(r);
  expect(wave.derived.wave.roundsMade).toBe(T.A3!.coxeter_number);
  expect(wave.derived.wave.split.map((s: { nodes: number[] }) => s.nodes)).toEqual([[1, 3], [2], [1, 3], [2]]);
  // The dimension tab on A2.
  const a2 = await open(page, 'g=A2&d=1,1');
  const dim = await download(a2);
  expect(dim.derived.dimension).toMatchObject({ tapeRho: [1, 2, 1], tapeLambdaRho: [2, 4, 2], D: 2, M: 16, dimension: 8 });
});

test('SVG and PNG export of the figure', async ({ page }) => {
  const r = await open(page, 'g=E8&d=1,0,0,0,0,0,0,0');
  await tabButton(r, 'dimension').click();
  const [svg] = await Promise.all([page.waitForEvent('download'), r.locator('[data-export="svg"]').click()]);
  const text = readFileSync((await svg.path())!, 'utf8');
  const parsed = await page.evaluate((t) => {
    const doc = new DOMParser().parseFromString(t, 'image/svg+xml');
    const titles = [...doc.querySelectorAll('title')].map((x) => x.textContent ?? '');
    return { root: doc.documentElement.nodeName, error: doc.querySelector('parsererror') !== null, titles, discs: doc.querySelectorAll('[data-disc]').length };
  }, text);
  expect(parsed.root).toBe('svg');
  expect(parsed.error).toBe(false);
  expect(parsed.discs).toBe(8);
  const D = (await out(r, 'productRho').getAttribute('data-exact'))!;
  const M = (await out(r, 'productLambdaRho').getAttribute('data-exact'))!;
  expect(parsed.titles).toContain(D);
  expect(parsed.titles).toContain(M);
  const [png] = await Promise.all([page.waitForEvent('download'), r.locator('[data-export="png"]').click()]);
  const bytes = readFileSync((await png.path())!);
  expect(bytes.length).toBeGreaterThan(100);
  expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
});

test('the picker offers the 32 types grouped by letter and resets start and moves', async ({ page }) => {
  const r = await open(page);
  const picker = control(r, 'picker');
  const groups = await picker.evaluate((el) =>
    [...el.querySelectorAll('optgroup')].map((g) => ({ letter: g.getAttribute('data-letter'), names: [...g.querySelectorAll('option')].map((o) => o.value) })),
  );
  expect(groups.flatMap((g) => g.names).sort()).toEqual(Object.keys(T).sort());
  expect(groups.map((g) => g.letter)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  for (const g of groups) expect(g.names.every((n) => n.startsWith(g.letter!))).toBe(true);
  await expect(r).toHaveAttribute('data-moves', '6');
  await picker.selectOption('D4');
  await expect(r).toHaveAttribute('data-moves', '0');
  expect(await valuesOf(nodesA(r))).toEqual(['1', '1', '1', '1']);
  await picker.selectOption('C2');
  await expect(picker).toHaveValue('C2');
  await expect(r.locator('[data-board-group]').first()).toHaveAttribute('aria-label', 'Numbers game on C2');
  // A board the tool does not offer is refused by the link.
  const affine = await open(page, 'g=A2~');
  await expect(out(affine, 'notice')).toHaveText(NOTICE);
});

test('moves update the address bar with replaceState after the burst and never pushState', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __calls: { kind: string; t: number; url: string }[] };
    w.__calls = [];
    const replace = history.replaceState.bind(history);
    const push = history.pushState.bind(history);
    history.replaceState = (d: unknown, u: string, url?: string | URL | null) => {
      w.__calls.push({ kind: 'replace', t: performance.now(), url: String(url) });
      replace(d, u, url);
    };
    history.pushState = (d: unknown, u: string, url?: string | URL | null) => {
      w.__calls.push({ kind: 'push', t: performance.now(), url: String(url) });
      push(d, u, url);
    };
  });
  // lambda set, so that the state after the six moves differs from the route's default (which has them).
  const r = await open(page, 'g=A3&c=n&s=1,1,1&w=&d=0,0,1');
  await page.waitForTimeout(800);
  const length = await page.evaluate(() => history.length);
  await page.evaluate(() => ((window as unknown as { __calls: unknown[] }).__calls.length = 0));
  for (let k = 0; k < 6; k++) await control(r, 'step').click();
  const lastPress = await page.evaluate(() => performance.now());
  expect(await page.evaluate(() => (window as unknown as { __calls: unknown[] }).__calls.length)).toBe(0);
  await expect.poll(() => page.evaluate(() => location.search), { timeout: 3000 }).toContain('w=1.2.1.3.2.1');
  await page.waitForTimeout(700);
  const calls = await page.evaluate(() => (window as unknown as { __calls: { kind: string; t: number }[] }).__calls);
  expect(calls.map((c) => c.kind)).toEqual(['replace']);
  expect(calls[0]!.t - lastPress).toBeGreaterThan(300);
  expect(await page.evaluate(() => history.length)).toBe(length);
});

test('hydration leaves the tool markup unchanged', async ({ page, browser, baseURL }) => {
  // The route's HTML is the default state; hydration only removes `disabled` and sets data-hydrated.
  // A link (?g=A2&d=1,1) changes the state after hydration, so its markup is compared with the server
  // render of the state it names, which the static HTML of the default cannot be: there the check is
  // that the server's default markup is untouched until the island reads the link.
  // `checked=""` of ToolFrame's export options is the server's spelling of a bound property, which the
  // browser keeps as a property after hydration (P2-A6's checkboxes, not T5's markup).
  const clean = (html: string): string =>
    html.replace(/\sdisabled(="[^"]*")?/g, '').replace(/\sdata-hydrated="true"/g, '').replace(/\schecked=""/g, '');
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 360, height: 800 } });
  const off = await context.newPage();
  await off.goto(ROUTE);
  const before = await off.locator('[data-tool="numbers"]').evaluate((el) => el.outerHTML);
  await off.goto(`${ROUTE}?g=A2&d=1,1`);
  const beforeLink = await off.locator('[data-tool="numbers"]').evaluate((el) => el.outerHTML);
  await context.close();
  expect(beforeLink).toBe(before);
  const r = await open(page);
  expect(firstDifference(clean(await r.evaluate((el) => el.outerHTML)), clean(before))).toBeNull();
  const linked = await open(page, 'g=A2&d=1,1');
  await tabButton(linked, 'dimension').click();
  await expect(out(linked, 'dimension')).toHaveText('8');
});

test('a link whose d is negative or has more than 6 digits loads the default lambda with a notice', async ({ page }) => {
  const plain = await open(page, 'g=A2');
  await tabButton(plain, 'dimension').click();
  const defaultDimension = await out(plain, 'dimension').textContent();
  for (const query of ['g=A2&d=-1,1', 'g=A2&d=1234567,1']) {
    const r = await open(page, query);
    await expect(out(r, 'notice'), query).toHaveText(NOTICE);
    await tabButton(r, 'dimension').click();
    await expect(r.locator('[data-control="lambda"][data-lambda-node="1"]')).toHaveValue('0');
    await expect(r.locator('[data-control="lambda"][data-lambda-node="2"]')).toHaveValue('0');
    await expect(out(r, 'dimension')).toHaveText(defaultDimension!);
  }
  // The input refuses a negative entry and a seventh digit.
  const r = await open(page, 'g=A2');
  await tabButton(r, 'dimension').click();
  const field = r.locator('[data-control="lambda"][data-lambda-node="1"]');
  await field.fill('123456');
  await expect(out(r, 'lambda')).toHaveText('(123456, 0)');
  await field.fill('1234567');
  await expect(field).toHaveValue('123456');
  await field.fill('-1');
  await expect(field).toHaveValue('123456');
});

test('node buttons are named by the A-3 template', async ({ page }) => {
  const r = await open(page, 'g=A3&c=n&s=1,0,2&w=');
  await expect(nodeA(r, 1)).toHaveAccessibleName('Node 1, value 1, can be fired');
  await expect(nodeA(r, 2)).toHaveAccessibleName('Node 2, value 0, cannot be fired');
  await expect(nodeA(r, 3)).toHaveAccessibleName('Node 3, value 2, can be fired');
  await control(r, 'step').click();
  await expect(nodeA(r, 1)).toHaveAccessibleName('Node 1, value minus 1, cannot be fired');
});

test('signs, colour classes and tally bars are not conveyed by colour alone', async ({ page }) => {
  const r = await open(page, 'g=A3&c=n&s=1,1,1&w=');
  await control(r, 'step').click();
  await control(r, 'step').click();
  // (1, -2, 3) after firing 1 then 2 (Appendix A.2).
  const nodes = await nodesA(r).evaluateAll((bs) => bs.map((b) => [b.getAttribute('data-node'), b.getAttribute('data-value'), b.getAttribute('data-sign')]));
  expect(nodes).toEqual([
    ['1', '1', 'positive'],
    ['2', '-2', 'negative'],
    ['3', '3', 'positive'],
  ]);
  for (const [label, value] of nodes) {
    await expect(r.locator(`[data-numeral="${label}"]`).first()).toHaveText(value!.replace('-', MINUS));
  }
  const fill = (label: number) => r.locator(`[data-disc="${label}"]`).first().evaluate((el) => getComputedStyle(el).fill);
  expect(await fill(1)).not.toBe('none');
  expect(await fill(2)).toBe('none');
  const zero = await open(page, 'g=A3&c=n&s=1,0,-1&w=');
  await expect(nodeA(zero, 2)).toHaveAttribute('data-sign', 'zero');
  const zeroStroke = await zero.locator('[data-disc="2"]').first().evaluate((el) => getComputedStyle(el).stroke);
  const negStroke = await zero.locator('[data-disc="3"]').first().evaluate((el) => getComputedStyle(el).stroke);
  expect(await zero.locator('[data-disc="2"]').first().evaluate((el) => getComputedStyle(el).fill)).toBe('none');
  expect(zeroStroke).not.toBe(negStroke);
  // Wave tab: each class has a text label and its nodes a shape that differs between the classes.
  const w = await open(page, 'g=A3&c=n&s=1,1,1&w=');
  await tabButton(w, 'wave').click();
  const classes = await out(w, 'colourClass').evaluateAll((ls) => ls.map((l) => [l.getAttribute('data-colour'), l.getAttribute('data-nodes'), (l.textContent ?? '').trim()]));
  expect(classes.map((c) => c.slice(0, 2))).toEqual([
    ['0', '1,3'],
    ['1', '2'],
  ]);
  expect(classes[0]![2]).toContain('nodes 1, 3');
  expect(classes[1]![2]).toContain('node 2');
  const shapes = await w.locator('[data-colour-shape]').evaluateAll((gs) => gs.map((g) => [g.getAttribute('data-shape-node'), g.getAttribute('data-colour-shape')]));
  expect(shapes.sort()).toEqual([
    ['1', 'square'],
    ['2', 'triangle'],
    ['3', 'square'],
  ]);
  // Tally bars show their value and count as text.
  const t = await open(page);
  const bars = await out(t, 'tallyBar').evaluateAll((gs) => gs.map((g) => [...g.querySelectorAll('text')].map((x) => x.textContent)));
  expect(bars).toEqual(Object.entries(T.A3!.fired_tally).map(([v, c]) => [v, String(c)]));
});

test('without JavaScript the default figure, the tape, the tally reading, the caption and the table are present and every control is disabled', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(ROUTE);
  const r = root(page);
  await expect(nodesA(r)).toHaveCount(3);
  expect(await valuesOf(nodesA(r))).toEqual(['-1', '-1', '-1']);
  await expect(out(r, 'tape')).toHaveText(list(T.A3!.fired_values));
  await expect(out(r, 'exponents')).toHaveText(list(T.A3!.exponents));
  await expect(out(r, 'exponentProduct')).toHaveText(String(T.A3!.weyl_order));
  await expect(out(r, 'groupOrder')).toHaveText(String(T.A3!.weyl_order));
  await expect(out(r, 'caption')).toContainText('heights of the positive coroots');
  await expect(out(r, 'noscript')).toHaveCount(1);
  await expect(r.locator('details table')).not.toHaveCount(0);
  await expect(r.locator('details [data-table-node]')).toHaveCount(3);
  for (const b of await r.locator('button, select, input').all()) {
    const disabled = await b.evaluate((el) => (el as HTMLButtonElement).disabled || el.closest('fieldset[disabled]') !== null);
    expect(disabled).toBe(true);
  }
  await context.close();
});

test('/tools/numbers has no serious or critical axe violations', async ({ page }) => {
  const r = await open(page);
  for (const tab of ['tally', 'tape', 'wave', 'compared', 'dimension']) {
    await tabButton(r, tab).click();
    const results = await new AxeBuilder({ page }).include('[data-tool="numbers"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) }));
    expect(serious, tab).toEqual([]);
  }
  const whole = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(whole.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
});

test('keyboard: Tab into the board, arrows, Enter fires, the live region speaks the A-4 template', async ({ page }) => {
  const r = await open(page, 'g=A3&c=n&s=1,1,1&w=');
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  for (let k = 0; k < 40; k++) {
    await page.keyboard.press('Tab');
    const at = await page.evaluate(() => document.activeElement?.getAttribute('data-node') ?? null);
    if (at !== null) break;
  }
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-node'))).toBe('1');
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-node'))).toBe('2');
  await page.keyboard.press('Enter');
  await expect(r).toHaveAttribute('data-moves', '1');
  await expect(live(r)).toHaveText('Fired node 2. Numbers now 2, minus 1, 2. Move 1.');
  await page.keyboard.press('u');
  await expect(r).toHaveAttribute('data-moves', '0');
  await expect(live(r)).toHaveText('Undid move 1. Numbers now 1, 1, 1.');
  // A node that cannot be fired is refused with the template.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(live(r)).toHaveText('Node 2 cannot be fired: its number is minus 1.');
});

test('the exponent product and the dimension quotient are MathML', async ({ page }) => {
  const katex: string[] = [];
  page.on('request', (q) => {
    if (/katex/i.test(q.url())) katex.push(q.url());
  });
  const r = await open(page, 'g=A3&c=n&s=1,1,1&w=');
  await control(r, 'playToEnd').click();
  const formula = r.locator('[data-panel="tally"] math');
  await expect(formula).toHaveCount(1);
  expect(await formula.locator('mn').allTextContents()).toEqual(expect.arrayContaining(['2', '3', '4', String(T.A3!.weyl_order)]));
  const a2 = await open(page, 'g=A2&d=1,1');
  await tabButton(a2, 'dimension').click();
  const q = a2.locator('[data-panel="dimension"] math');
  await expect(q).toHaveCount(1);
  expect(await q.locator('mn').allTextContents()).toEqual(['16', '2', '8']);
  // No KaTeX script reaches the reader (7.6). The site layout (Base.astro, not T5) links KaTeX's stylesheet
  // on every page for the build-time formulas of the prose; T5 requests nothing of KaTeX itself.
  expect(katex.filter((u) => /\.js(\?|$)/.test(u))).toEqual([]);
});

test('at 320 pixels the page does not scroll sideways and the tally box does', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const r = await open(page, 'g=E8');
  await control(r, 'playToEnd').click();
  await expect(r).toHaveAttribute('data-moves', '120');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  const box = await r.locator('[data-scroll="tally"]').evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, overflow: getComputedStyle(el).overflowX }));
  expect(box.scroll).toBeGreaterThan(box.client);
  expect(box.overflow).toBe('auto');
  for (const tab of ['tape', 'wave', 'compared', 'dimension']) {
    await tabButton(r, tab).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), tab).toBeLessThanOrEqual(0);
  }
});

test('show as table lists the board with a button per node, the tape and the tally', async ({ page }) => {
  const r = await open(page);
  await r.locator('details summary').first().click();
  const table = r.locator('details');
  await expect(table.locator('[data-table-node]')).toHaveCount(3);
  await expect(table.locator('caption', { hasText: 'Tape' })).toHaveCount(1);
  await expect(table.locator('caption', { hasText: /^Tally/ })).toContainText(`exponents ${list(T.A3!.exponents)}`);
  await expect(table.locator('[data-table-value="number"]')).toHaveText([`${MINUS}1`, `${MINUS}1`, `${MINUS}1`]);
  await control(r, 'reset').click();
  await table.locator('[data-table-node="1"]').click();
  await expect(r).toHaveAttribute('data-moves', '1');
  await expect(nodeA(r, 1)).toHaveAttribute('data-value', '-1');
});

// ---------------------------------------------------------------------------------------------
// Configurations that only properties reach: the compared preset (M4 row 2), two E8 boards, and a
// prediction (4.0 Predict). T5 is bundled with Vite and served from a stub origin, as in T09.spec.ts.
// ---------------------------------------------------------------------------------------------

test.describe('fixture instances', () => {
  const SITE = fileURLToPath(new URL('../../', import.meta.url));
  const ORIGIN = 'http://localhost:5989';
  const PAGE_PATH = '/numbers-fixture/';
  const answer = T.A3!.longest_word.length;
  const instances = [
    { id: 'c1', preset: 'compared' },
    { id: 'c2', preset: 'compared', board: 'E8' },
    {
      id: 'p1',
      preset: 'tally',
      prediction: { question: 'How many moves does the game on A3 from all ones take?', answer: { type: 'number', value: answer }, reveal: 'Six moves, whatever the order.' },
    },
  ];
  let files = new Map<string, string>();
  let entry = '';
  let css: string[] = [];
  let serverHtml: string[] = [];
  const styles = ['tokens.css', 'base.css'].map((f) => readFileSync(join(SITE, 'src/styles', f), 'utf8')).join('\n');

  const pageHtml = (withScript: boolean): string =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>T5 fixture</title><style>${styles} body{margin:0} main{padding:0 16px}</style>${css
      .map((c) => `<link rel="stylesheet" href="/${c}">`)
      .join('')}</head><body><main>${instances
      .map((p, k) => `<div data-app='${JSON.stringify(p)}'>${serverHtml[k]}</div>`)
      .join('')}</main>${withScript ? `<script type="module" src="/${entry}"></script>` : ''}</body></html>`;

  test.beforeAll(async () => {
    test.setTimeout(120000);
    const component = join(SITE, 'src/components/tools/T05NumbersGameLab.svelte');
    const virtual: Plugin = {
      name: 'numbers-entry',
      resolveId: (id) => (id === 'virtual:numbers-entry' ? '\0numbers-entry' : null),
      load: (id) =>
        id === '\0numbers-entry'
          ? `import { hydrate } from 'svelte'; import T from ${JSON.stringify(component)};
             for (const target of document.querySelectorAll('[data-app]')) hydrate(T, { target, props: JSON.parse(target.dataset.app) });`
          : null,
    };
    const result = await build({
      configFile: false,
      root: SITE,
      logLevel: 'silent',
      cacheDir: join(tmpdir(), 'two-games-numbers-fixture-cache'),
      plugins: [virtual, svelte({ configFile: false })],
      resolve: { tsconfigPaths: true },
      build: { write: false, minify: false, modulePreload: false, rollupOptions: { input: { entry: 'virtual:numbers-entry' } } },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((o) => ('output' in o ? o.output : []));
    files = new Map();
    css = [];
    for (const o of outputs) {
      const text = o.type === 'chunk' ? o.code : typeof o.source === 'string' ? o.source : Buffer.from(o.source).toString('utf8');
      files.set(o.fileName, text);
      if (o.type === 'chunk' && o.isEntry) entry = o.fileName;
      if (o.fileName.endsWith('.css')) css.push(o.fileName);
    }
    const loader = await ssrLoader();
    try {
      const { default: C } = await loader.load<{ default: unknown }>('/src/components/tools/T05NumbersGameLab.svelte');
      serverHtml = instances.map((p) => loader.render(C, p));
    } finally {
      await loader.close();
    }
  });

  test.beforeEach(async ({ context }) => {
    await context.route(`${ORIGIN}/**`, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === PAGE_PATH) {
        await route.fulfill({ status: 200, contentType: 'text/html', body: pageHtml(true) });
        return;
      }
      const file = files.get(url.pathname.slice(1));
      if (file === undefined) await route.fulfill({ status: 404, body: '' });
      else await route.fulfill({ status: 200, contentType: url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript', body: file });
    });
  });

  async function openFixture(page: Page): Promise<void> {
    await page.goto(`${ORIGIN}${PAGE_PATH}`);
    for (const p of instances) await expect(root(page, p.id)).toHaveAttribute('data-hydrated', 'true');
  }

  test('compared preset shows two sorted tapes that agree, six moves each and the end (-1, -1, -1) twice', async ({ page }) => {
    await openFixture(page);
    const r = root(page, 'c1');
    await expect(tabButton(r, 'compared')).toHaveAttribute('aria-selected', 'true');
    const sorted = list([...T.A3!.fired_values].sort((a, b) => a - b));
    await expect(out(r, 'sortedA')).toHaveText(sorted);
    await expect(out(r, 'sortedB')).toHaveText(sorted);
    await expect(out(r, 'tapesAgree')).toHaveText('the sorted tapes agree');
    await expect(out(r, 'movesA')).toHaveText('6');
    await expect(out(r, 'movesB')).toHaveText('6');
    await expect(out(r, 'endA')).toHaveText(`(${MINUS}1, ${MINUS}1, ${MINUS}1)`);
    await expect(out(r, 'endB')).toHaveText(`(${MINUS}1, ${MINUS}1, ${MINUS}1)`);
    // Game B starts again, played by hand: unfinished, the overlay compares nothing.
    await control(r, 'resetB').click();
    await expect(out(r, 'tapesAgree')).toHaveCount(0);
    await expect(out(r, 'compareStatus')).toHaveText('Game B is unfinished: play it to the end to compare.');
    await nodesB(r).nth(2).click();
    await expect(out(r, 'movesB')).toHaveText('1');
    await control(r, 'playToEndB').click();
    await expect(out(r, 'tapesAgree')).toHaveCount(1);
    await expect(out(r, 'movesB')).toHaveText('6');
  });

  test('node hit areas of the two stacked E8 boards of compared are 43 pixels at 320', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await openFixture(page);
    const r = root(page, 'c2');
    await checkHitAreas(nodesA(r), 43, 'E8 game A');
    await checkHitAreas(nodesB(r), 43, 'E8 game B');
    const lowestA = Math.max(...(await Promise.all((await nodesA(r).all()).map(async (b) => (await b.boundingBox())!.y))));
    const highestB = Math.min(...(await Promise.all((await nodesB(r).all()).map(async (b) => (await b.boundingBox())!.y))));
    expect(highestB).toBeGreaterThan(lowestA);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('a visible focus ring on the focused node of both boards and on the tab buttons, never covered by a sticky element', async ({ page }) => {
    for (const width of [360, 320]) {
      await page.setViewportSize({ width, height: 800 });
      await openFixture(page);
      const r = root(page, 'c1');
      const ringed = async (): Promise<{ onTop: boolean; outline: boolean }> =>
        page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          el.scrollIntoView({ block: 'start' });
          const box = el.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          const s = getComputedStyle(el);
          return { onTop: hit === el || el.contains(hit), outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 };
        });
      await nodesA(r).first().focus();
      await page.keyboard.press('ArrowRight');
      expect(await ringed()).toEqual({ onTop: true, outline: true });
      await nodesB(r).first().focus();
      await page.keyboard.press('ArrowRight');
      expect(await page.evaluate(() => document.activeElement?.closest('[data-game-b]') !== null)).toBe(true);
      expect(await ringed()).toEqual({ onTop: true, outline: true });
      await tabButton(r, 'compared').focus();
      for (const id of ['dimension', 'tape', 'tally', 'wave', 'compared']) {
        await page.keyboard.press('ArrowRight');
        expect(await page.evaluate(() => document.activeElement?.getAttribute('data-tab'))).toBe(id);
        expect(await ringed()).toEqual({ onTop: true, outline: true });
      }
    }
  });

  test('with a prediction the boards and controls are frozen until the reader answers or presses show me', async ({ page }) => {
    await openFixture(page);
    const r = root(page, 'p1');
    for (const b of await nodesA(r).all()) await expect(b).toBeDisabled();
    await expect(control(r, 'step')).toBeDisabled();
    await expect(control(r, 'playToEnd')).toBeDisabled();
    for (const t of await r.locator('[data-tab]').all()) await expect(t).toBeDisabled();
    await nodesA(r).first().click({ force: true });
    await expect(r).toHaveAttribute('data-moves', '0');
    await control(r, 'predictAnswer').fill('5');
    await control(r, 'predictCheck').click();
    await expect(out(r, 'predictReveal')).toHaveText('Six moves, whatever the order.');
    await expect(out(r, 'predictResult')).toContainText(String(answer));
    await expect(nodeA(r, 1)).toBeEnabled();
    await expect(control(r, 'step')).toBeEnabled();
    await control(r, 'playToEnd').click();
    await expect(r).toHaveAttribute('data-moves', String(answer));
    // "Show me" also unfreezes.
    await openFixture(page);
    const again = root(page, 'p1');
    await control(again, 'predictShow').click();
    await expect(out(again, 'predictReveal')).toHaveCount(1);
    await expect(control(again, 'step')).toBeEnabled();
  });

  test('without JavaScript a prediction is followed by a details element holding the answer and the reveal', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    await context.route(`${ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: pageHtml(false) }));
    const page = await context.newPage();
    await page.goto(`${ORIGIN}${PAGE_PATH}`);
    const details = root(page, 'p1').locator('[data-prediction] details');
    await expect(details).toHaveCount(1);
    await expect(details).toContainText('Six moves, whatever the order.');
    await expect(details).toContainText(String(answer));
    // The compared preset renders both tapes and the agreement without JavaScript.
    await expect(out(root(page, 'c1'), 'tapesAgree')).toHaveText('the sorted tapes agree');
    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------
// Regressions
// ---------------------------------------------------------------------------------------------

test.describe('regressions', () => {
  // weyl_dimension(E8, (9, ..., 9)) = 10^120 (121 digits); weyl_dimension(E8, (1, ..., 1)) has 37 digits.
  // oracle: python3 -c "import sys; sys.path.insert(0, 'reference'); import lie_games as L; C = L.cartan('E', 8); print(L.weyl_dimension(C, [9] * 8) == 10 ** 120, L.weyl_dimension(C, [1] * 8))"
  const E8_NINES = '1' + '0'.repeat(120);
  const E8_ONES = '1329227995784915872903807060280344576';
  for (const [lambda, exact] of [
    ['9,9,9,9,9,9,9,9', E8_NINES],
    ['1,1,1,1,1,1,1,1', E8_ONES],
  ] as const) {
    // regression: P3-RT-03-03
    test(`E8 lambda ${lambda}: the dimension is shown shortened, exact elsewhere`, async ({ page }) => {
      const r = await open(page, `g=E8&d=${lambda}`);
      await tabButton(r, 'dimension').click();
      const shown = ((await out(r, 'dimension').textContent()) ?? '').trim();
      // The exact digits are in the table view (attack 25: they equal the oracle's weyl_dimension)...
      await expect(r.locator('[data-table-exact="dimension"]')).toHaveText(exact);
      // ...and SPEC 4.0 "Long numbers": a value of more than 12 digits is shown shortened.
      expect(shown).toBe(`${exact[0]}.${exact.slice(1, 5)}... x 10^${exact.length - 1} (${exact.length} digits)`);
    });
  }
});
