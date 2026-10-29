// P1-A5: tool T1, the Game Board, against the built site (SPEC.md 4 T1 Acceptance, 4.0, 7.4, 7.5,
// 9.2; Appendix A.1, A.2, A.4). The cases are configured by bare query parameters on /tools/board/,
// which the codec reads (6.6: every state is a link). Tests read only the hooks of 4.0 and the live
// region (and, where a criterion is about the address bar, the clipboard or a download, those).
//
// Hooks read:
//   root:    data-tool="board", data-moves, data-hydrated="true", data-instance
//   buttons: data-node, data-board (populations | numbers), data-value, data-can-act,
//            data-sign (positive | negative | zero; plan), data-ring (true | false; plan)
//   drawing: data-disc, data-numeral (P0-A5), data-ghost (hint ghosts; plan), data-road-style (P1-A3)
//   groups:  data-board-group (the group of node buttons, with its accessible name)
//   table:   data-table-board, data-table-node (the A-10 table's buttons)
//   strip:   data-step (a strip button), data-control="historySlider"
//   live:    [data-live] (ToolFrame's polite live region)
// data-out names (every one T1 renders; the registry's `outs`):
//   caption, moveCounter, historyStrip, historyCounter, mode, gameOver, bridgeSentence, aCp, notice,
//   limit, scriptCaption, roundCounter, goal, goalMet, goalNote, predictResult, predictReveal, noscript
//   (scriptCaption, roundCounter, goal, goalMet, goalNote, predictResult, predictReveal come only from
//   properties, which a link cannot set; site/tests/unit/tools/T01.test.ts checks them by server render.)
// data-control names: undo, redo, reset, step, playToEnd, next, picker, view, mode, predictAnswer,
//   predictCheck, predictShow, copyLink, downloadData, historySlider.
//
// Properties of T1 beyond the common ones of 4.0 Configuration (id, board, coords, start, moves,
// linkTo, prediction), with their value shapes:
//   view: 'populations' | 'numbers' | 'linked'                      (default 'linked')
//   mode: 'free' | 'legal' | 'raising'                               (default 'free')
//   caption: string;  preset: string (ignored, T1 has no presets);  layers: number (ignored)
//   script: { move: number /* label */; caption: string }[]          (advanced by "Next")
//   goal: { kind: 'reach'; position: (number|string)[]; game?: 'mutation'|'firing'; text?: string }
//       | { kind: 'no-positive'; text?: string } | { kind: 'no-unhappy'; text?: string }
//       | { kind: 'predicate'; name: 'mixed-signs'; giveUpAfter?: number; giveUpText?: string; text?: string }
//   prediction: Prediction of CONTRACTS 5.2 (question; answer number | position | choice; reveal)
//   hints: boolean;  panels: ('form'|'level'|'colours'|'lengths')[] (none drawn in phase 1)
//   roadStyle: 'dynkin' | 'roads';  rounds: number (moves per round; shows "Round k")
//   settings: boolean (picker, view and mode choosers; default true on the tool's own route)
//   onChange: ({ state, populations, numbers }) => void (T9)
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { T01_OUTS, T01_PROP_ONLY_OUTS } from '../../src/tools/registry/T01';
import { CAPS, boardFromName, fromAdjacency, playFate, toNumbers, toPositions } from '../../../packages/engine/src/index';
import type { Board } from '../../../packages/engine/src/index';

const ROUTE = 'tools/board/';
const TRIANGLE = 'c:2,-1,-1;-1,2,-1;-1,-1,2';

/** A number read aloud as SPEC 7.5 A-4 says: negative numbers are spoken as "minus". */
const spoken = (v: bigint): string => (v < 0n ? `minus ${-v}` : String(v));

const root = (page: Page): Locator => page.locator('[data-tool="board"]');
const node = (page: Page, board: 'populations' | 'numbers', label: number): Locator =>
  root(page).locator(`button[data-board="${board}"][data-node="${label}"]`);
const nodes = (page: Page, board: 'populations' | 'numbers'): Locator => root(page).locator(`button[data-board="${board}"][data-node]`);
const out = (page: Page, name: string): Locator => root(page).locator(`[data-out="${name}"]`);
const control = (page: Page, name: string): Locator => root(page).locator(`[data-control="${name}"]`);
const live = (page: Page): Locator => root(page).locator('[data-live]');

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`${ROUTE}${query ? `?${query}` : ''}`);
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
}

async function values(page: Page, board: 'populations' | 'numbers'): Promise<string[]> {
  const list = nodes(page, board);
  const n = await list.count();
  const pairs: [number, string][] = [];
  for (let k = 0; k < n; k++) {
    const b = list.nth(k);
    pairs.push([Number(await b.getAttribute('data-node')), (await b.getAttribute('data-value')) ?? '']);
  }
  return pairs.sort((x, y) => x[0] - y[0]).map((p) => p[1]);
}

async function fire(page: Page, label: number, board: 'populations' | 'numbers' = 'numbers'): Promise<void> {
  await node(page, board, label).click();
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

// ---------------------------------------------------------------------------------------------
// SPEC 4 T1 Acceptance
// ---------------------------------------------------------------------------------------------

test('A2 legal play 1, 2, 1 ends with game over after 3 moves', async ({ page }) => {
  await open(page, 'g=A2&v=n&m=l&c=n&s=1,1');
  await expect(out(page, 'gameOver')).toHaveText('');
  const expected = [['-1', '2'], ['1', '-2'], ['-1', '-1']];
  for (const [k, label] of [1, 2, 1].entries()) {
    await fire(page, label);
    await expect(root(page)).toHaveAttribute('data-moves', String(k + 1));
    expect(await values(page, 'numbers')).toEqual(expected[k]);
  }
  await expect(out(page, 'gameOver')).toHaveText(/game over after 3 moves/i);
  for (const label of [1, 2]) await expect(node(page, 'numbers', label)).toHaveAttribute('data-can-act', 'false');
});

for (const [name, word, sequence] of [
  ['B2', [1, 2, 1, 2], [['-1', '3'], ['2', '-3'], ['-2', '1'], ['-1', '-1']]],
  ['G2', [1, 2, 1, 2, 1, 2], [['-1', '2'], ['5', '-2'], ['-5', '3'], ['4', '-3'], ['-4', '1'], ['-1', '-1']]],
] as const) {
  test(`${name} sequence of Appendix A.1`, async ({ page }) => {
    await open(page, `g=${name}&v=n&m=l&c=n&s=1,1`);
    for (const [k, label] of word.entries()) {
      await fire(page, label);
      expect(await values(page, 'numbers')).toEqual(sequence[k]);
    }
    await expect(out(page, 'gameOver')).toHaveText(new RegExp(`game over after ${word.length} moves`, 'i'));
  });
}

test('linked view on A3 shows Cp after moves', async ({ page }) => {
  const A3 = boardFromName('A3') as Board<number>;
  await open(page, 'g=A3&v=l&m=f&c=p&s=1,-2,3');
  const check = async (): Promise<void> => {
    const p = (await values(page, 'populations')).map(Number);
    expect(await values(page, 'numbers')).toEqual(toNumbers(A3, p).map(String));
  };
  await check();
  await fire(page, 2, 'populations');
  await check();
  await fire(page, 3, 'numbers');
  await check();
  await fire(page, 1, 'populations');
  await check();
  await expect(root(page)).toHaveAttribute('data-moves', '3');
});

test('A2 linked from numbers (1,0) shows 2/3 and 1/3', async ({ page }) => {
  await open(page, 'g=A2&v=l&m=f&c=n&s=1,0');
  expect(await values(page, 'populations')).toEqual(['2/3', '1/3']);
  expect(await values(page, 'numbers')).toEqual(['1', '0']);
});

test('undo in free, legal and raising', async ({ page }) => {
  for (const [query, word, board] of [
    ['g=A3&v=n&m=f&c=n&s=1,1,1', [2, 1, 3], 'numbers'],
    ['g=A3&v=n&m=l&c=n&s=1,1,1', [1, 2, 1], 'numbers'],
    ['g=D4&v=p&m=r&c=p&s=0,1,0,0', [1, 3, 4], 'populations'],
  ] as const) {
    await open(page, query);
    const seen: string[][] = [await values(page, board)];
    for (const label of word) {
      await fire(page, label, board);
      seen.push(await values(page, board));
    }
    for (let k = word.length - 1; k >= 0; k--) {
      await control(page, 'undo').click();
      await expect(root(page)).toHaveAttribute('data-moves', String(k));
      expect(await values(page, board), query).toEqual(seen[k]);
    }
  }
});

test('announces Fired node 2. Numbers now 2, minus 1. Move 1.', async ({ page }) => {
  await open(page, 'g=A2&v=n&m=f&c=n&s=1,1');
  await expect(live(page)).toHaveText('');
  await fire(page, 2);
  await expect(live(page)).toHaveText('Fired node 2. Numbers now 2, minus 1. Move 1.');
});

// ---------------------------------------------------------------------------------------------
// Roster acceptance and the definition of done
// ---------------------------------------------------------------------------------------------

const BRIDGE = 'The number on node i is the amount by which a mutation would lower city i.';

test('bridge sentence in linked view', async ({ page, browser, baseURL }) => {
  await open(page);
  await expect(out(page, 'bridgeSentence')).toHaveText(BRIDGE);
  await open(page, 'g=A2&v=n&m=f&c=n&s=1,1');
  await expect(out(page, 'bridgeSentence')).toHaveCount(0);
  await open(page, 'g=A2&v=p&m=f&c=p&s=1,0');
  await expect(out(page, 'bridgeSentence')).toHaveCount(0);
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const nojs = await context.newPage();
  await nojs.goto(ROUTE);
  await expect(out(nojs, 'bridgeSentence')).toHaveText(BRIDGE);
  await context.close();
});

test('a = Cp line is MathML or labelled', async ({ page }) => {
  await open(page);
  const line = out(page, 'aCp');
  const ok = await line.evaluate((el) => el.querySelector('math') !== null || el.closest('[aria-label="a equals C p"]') !== null || el.querySelector('[aria-label="a equals C p"]') !== null);
  expect(ok).toBe(true);
});

test('hooks on every node and every registered out', async ({ page, browser, baseURL }) => {
  const present = new Set<string>();
  const collect = async (p: Page): Promise<void> => {
    for (const name of await root(p).evaluate((el) => [...el.querySelectorAll('[data-out]')].map((e) => e.getAttribute('data-out') ?? ''))) present.add(name);
  };
  await open(page);
  await expect(root(page)).toHaveAttribute('data-tool', 'board');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  const buttons = root(page).locator('button[data-node]');
  expect(await buttons.count()).toBe(4);
  for (let k = 0; k < 4; k++) {
    const b = buttons.nth(k);
    for (const a of ['data-node', 'data-board', 'data-value', 'data-can-act']) expect(await b.getAttribute(a), a).not.toBeNull();
  }
  await collect(page);
  await open(page, 'g=A2&v=l&m=l&c=n&s=1,1');
  await collect(page);
  await open(page, 'g=E8&v=n&m=l&c=n&s=1,1,1,1,1,1,1,1');
  await control(page, 'playToEnd').click();
  await expect(root(page)).toHaveAttribute('data-moves', '120');
  await collect(page);
  await open(page, 'g=A2&v=p&m=l&c=p&s=1,0');
  await collect(page);
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const nojs = await context.newPage();
  await nojs.goto(ROUTE);
  await collect(nojs);
  await context.close();
  const reachable = T01_OUTS.filter((name) => !T01_PROP_ONLY_OUTS.includes(name));
  for (const name of reachable) expect(present.has(name), `data-out="${name}"`).toBe(true);
});

test('renders the default figure without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(ROUTE);
  await expect(root(page)).not.toHaveAttribute('data-hydrated', 'true');
  expect(await values(page, 'populations')).toEqual(['1', '0']);
  expect(await values(page, 'numbers')).toEqual(['2', '-1']);
  await expect(out(page, 'caption')).not.toHaveText('');
  await expect(out(page, 'noscript')).toHaveText('Interactive when scripts are allowed.');
  await expect(out(page, 'bridgeSentence')).toHaveText(BRIDGE);
  const controls = root(page).locator('button, input, select');
  const n = await controls.count();
  for (let k = 0; k < n; k++) await expect(controls.nth(k)).toBeDisabled();
  expect(await root(page).locator('details table button').count()).toBeGreaterThanOrEqual(4);
  await context.close();
});

test('controls enabled after hydration', async ({ page }) => {
  await open(page, 'g=A3&v=l&m=l&c=n&s=1,1,1');
  for (const name of ['undo', 'redo', 'reset', 'step', 'playToEnd', 'picker', 'view', 'mode', 'copyLink', 'downloadData']) {
    await expect(control(page, name), name).toBeEnabled();
  }
  const buttons = root(page).locator('button[data-node]');
  for (let k = 0; k < (await buttons.count()); k++) await expect(buttons.nth(k)).toBeEnabled();
  // Phase 1 offers Copy link and Download data only: no SVG, PNG or LaTeX export.
  for (const name of ['exportSvg', 'exportSVG', 'exportPng', 'exportPNG', 'exportLatex', 'exportLaTeX']) await expect(control(page, name)).toHaveCount(0);
});

async function focusedNode(page: Page): Promise<string | null> {
  return page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('data-node') ?? null);
}

async function focusedControl(page: Page): Promise<string | null> {
  return page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('data-control') ?? null);
}

/** Tabs from the mode line until a node of the board has focus. */
async function tabIntoBoard(page: Page): Promise<void> {
  await out(page, 'mode').click();
  for (let k = 0; k < 10 && (await focusedNode(page)) === null; k++) await page.keyboard.press('Tab');
  expect(await focusedNode(page)).not.toBeNull();
}

test('keyboard-only play on A3 and E8', async ({ page }) => {
  await open(page, 'g=A3&v=n&m=f&c=n&s=1,1,1');
  await tabIntoBoard(page);
  expect(await focusedNode(page)).toBe('1');
  await page.keyboard.press('ArrowRight');
  expect(await focusedNode(page)).toBe('2');
  await page.keyboard.press('End');
  expect(await focusedNode(page)).toBe('3');
  await page.keyboard.press('Home');
  expect(await focusedNode(page)).toBe('1');
  await page.keyboard.press('Enter');
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press(' ');
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  expect(await values(page, 'numbers')).toEqual(['1', '-2', '3']);
  await page.keyboard.press('u');
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await page.keyboard.press('r');
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  // After the board: Undo, Redo and Reset in the tab order; u outside the board does nothing.
  await page.keyboard.press('Tab');
  expect(await focusedControl(page)).toBe('undo');
  await page.keyboard.press('u');
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await page.keyboard.press('Tab');
  expect(await focusedControl(page)).toBe('redo');
  await page.keyboard.press('Tab');
  expect(await focusedControl(page)).toBe('reset');
  await page.keyboard.press('Enter');
  await expect(root(page)).toHaveAttribute('data-moves', '0');

  await open(page, 'g=E8&v=n&m=f&c=n&s=1,1,1,1,1,1,1,1');
  await tabIntoBoard(page);
  expect(await focusedNode(page)).toBe('1');
  await page.keyboard.press('ArrowRight');
  expect(await focusedNode(page)).toBe('3');
  await page.keyboard.press('ArrowRight');
  expect(await focusedNode(page)).toBe('4');
  await page.keyboard.press('ArrowUp');
  expect(await focusedNode(page)).toBe('2');
  await page.keyboard.press('ArrowDown');
  expect(await focusedNode(page)).toBe('4');
  await page.keyboard.press('End');
  expect(await focusedNode(page)).toBe('8');
  await page.keyboard.press('Enter');
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await expect(node(page, 'numbers', 8)).toHaveAttribute('data-value', '-1');
});

test('arrows wrap round by label on the custom triangle', async ({ page }) => {
  await open(page, `g=${TRIANGLE}&v=n&m=f&c=n&s=1,1,1`);
  await node(page, 'numbers', 3).focus();
  await page.keyboard.press('ArrowRight');
  expect(await focusedNode(page)).toBe('1');
  await node(page, 'numbers', 3).focus();
  await page.keyboard.press('ArrowDown');
  expect(await focusedNode(page)).toBe('1');
  await page.keyboard.press('ArrowLeft');
  expect(await focusedNode(page)).toBe('3');
  await node(page, 'numbers', 1).focus();
  await page.keyboard.press('ArrowUp');
  expect(await focusedNode(page)).toBe('3');
  await node(page, 'numbers', 1).focus();
  await page.keyboard.press('ArrowRight');
  expect(await focusedNode(page)).toBe('2');
  const reached = new Set<string>();
  for (let k = 0; k < 3; k++) {
    reached.add((await focusedNode(page))!);
    await page.keyboard.press('ArrowRight');
  }
  expect([...reached].sort()).toEqual(['1', '2', '3']);
});

test('focus ring visible on the focused node', async ({ page }) => {
  await open(page, 'g=A3&v=n&m=f&c=n&s=1,1,1');
  await tabIntoBoard(page);
  const r = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const box = el.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const s = getComputedStyle(el);
    return {
      inside: box.top >= 0 && box.left >= 0 && box.bottom <= innerHeight && box.right <= innerWidth,
      onTop: hit === el || el.contains(hit),
      outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0,
    };
  });
  expect(r).toEqual({ inside: true, onTop: true, outline: true });
});

test('usable at 320 pixels on A3 and E8', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const [query, least] of [
    ['g=A3&v=l&m=f&c=p&s=1,0,0', 44],
    ['g=E8&v=l&m=f&c=p&s=1,0,0,0,0,0,0,0', 24],
  ] as const) {
    await open(page, query);
    const boxes: { x: number; y: number; width: number; height: number; board: string }[] = [];
    const list = root(page).locator('button[data-node]');
    for (let k = 0; k < (await list.count()); k++) {
      const box = (await list.nth(k).boundingBox())!;
      boxes.push({ ...box, board: (await list.nth(k).getAttribute('data-board'))! });
      expect(Math.round(box.width), query).toBeGreaterThanOrEqual(least);
      expect(Math.round(box.height), query).toBeGreaterThanOrEqual(least);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const overlap = a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
        expect(overlap, `${query}: nodes ${i} and ${j} overlap`).toBe(false);
      }
    }
    // The linked view stacks the two boards: every numbers node lies below every populations node.
    const lowestPop = Math.max(...boxes.filter((b) => b.board === 'populations').map((b) => b.y + b.height));
    const highestNum = Math.min(...boxes.filter((b) => b.board === 'numbers').map((b) => b.y));
    expect(highestNum).toBeGreaterThan(lowestPop);
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(scroll, `${query}: horizontal scroll`).toBeLessThanOrEqual(0);
  }
});

test('reduced motion gives instant updates', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, reducedMotion: 'reduce', viewport: { width: 360, height: 800 } });
  const page = await context.newPage();
  await open(page, 'g=A2&v=n&m=f&c=n&s=1,1');
  await fire(page, 1);
  await expect(node(page, 'numbers', 1)).toHaveAttribute('data-value', '-1');
  const running = await root(page).evaluate((el) => [...el.querySelectorAll('[data-disc]')].reduce((n, d) => n + d.getAnimations().length, 0));
  expect(running).toBe(0);
  await context.close();
});

test('no move on load', async ({ page }) => {
  await open(page, 'g=A3&v=n&m=l&c=n&s=1,1,1');
  await page.waitForTimeout(1200);
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await expect(live(page)).toHaveText('');
  expect(await values(page, 'numbers')).toEqual(['1', '1', '1']);
});

// regression: P3-RT-11-08
test('play to the end on the triangle reports the cap', async ({ page }) => {
  test.setTimeout(120000);
  const workers: string[] = [];
  page.on('worker', (w) => workers.push(w.url()));
  await open(page, `g=${TRIANGLE}&v=n&m=l&c=n&s=1,1,1`);
  await control(page, 'playToEnd').click();
  await expect(out(page, 'limit')).toHaveText('still running after 20000 moves', { timeout: 60000 });
  await expect(root(page)).toHaveAttribute('data-moves', '20000');
  expect(workers.length).toBeGreaterThan(0);
  expect(await page.locator('body').innerText()).not.toContain('not of finite type');
  // The whole sentence (decisions/P1-A5.md), with the numbers after 20000 legal moves, lowest node
  // first, computed here by the engine on the triangle (C = 2I - A^T, all roads single).
  const tri = fromAdjacency([[0, 1, 1], [1, 0, 1], [1, 1, 0]]) as Board<bigint>;
  const r = playFate(tri, [1n, 1n, 1n], undefined, CAPS.playMoves);
  expect(r.status).toBe('cap');
  const end = toPositions(tri, [1, 2, 3]).map((p) => spoken(r.position[p]!));
  await expect(live(page)).toHaveText(`Still running after 20000 moves. Numbers now ${end.join(', ')}.`);
});

test('node names follow A-3', async ({ page }) => {
  await open(page, 'g=A2&v=n&m=l&c=n&s=1,1');
  await expect(node(page, 'numbers', 1)).toHaveAccessibleName('Node 1, value 1, can be fired');
  await open(page, 'g=A2&v=n&m=l&c=n&s=1,-2');
  await expect(node(page, 'numbers', 2)).toHaveAccessibleName('Node 2, value minus 2, cannot be fired');
  await open(page, 'g=A3&v=p&m=f&c=p&s=1,0,0');
  await expect(node(page, 'populations', 2)).toHaveAccessibleName('City 2, population 0, mutation would raise it');
  await expect(node(page, 'populations', 1)).toHaveAccessibleName('City 1, population 1, mutation would lower it');
  await expect(node(page, 'populations', 3)).toHaveAccessibleName('City 3, population 0, mutation would change nothing');
  await open(page, 'g=A2&v=l&m=f&c=n&s=1,0');
  await expect(node(page, 'populations', 1)).toHaveAccessibleName('City 1, population 2 over 3, mutation would lower it');
});

test('linked announcement', async ({ page }) => {
  await open(page, 'g=A2&v=l&m=f&c=p&s=1,1');
  await fire(page, 1, 'populations');
  await expect(live(page)).toHaveText('Mutated city 1 and fired node 1. Populations now 0, 1; numbers now minus 1, 2. Move 1.');
  expect(await values(page, 'numbers')).toEqual(['-1', '2']);
});

test('refused firing is announced', async ({ page }) => {
  await open(page, 'g=A2&v=n&m=l&c=n&s=1,-2');
  await fire(page, 2);
  await expect(live(page)).toHaveText('Node 2 cannot be fired: its number is minus 2.');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  expect(await values(page, 'numbers')).toEqual(['1', '-2']);
});

test('populations announcement', async ({ page }) => {
  await open(page, 'g=A3&v=p&m=f&c=p&s=1,0,0');
  await fire(page, 2, 'populations');
  await expect(live(page)).toHaveText('Mutated city 2. Populations now 1, 1, 0. Move 1.');
});

test('undo announcement', async ({ page }) => {
  await open(page, 'g=A2&v=n&m=f&c=n&s=1,1');
  for (const label of [1, 2, 1, 2]) await fire(page, label);
  await expect(live(page)).toHaveText(/Move 4\.$/);
  await control(page, 'undo').click();
  await expect(live(page)).toHaveText('Undid move 4. Numbers now minus 1, minus 1.');
});

test('only changed nodes are read above four nodes', async ({ page }) => {
  await open(page, 'g=A5&v=n&m=f&c=n&s=1,1,1,1,1');
  await fire(page, 3);
  await expect(live(page)).toHaveText('Fired node 3. Node 2 now 2, node 3 now minus 1, node 4 now 2. Move 1.');
  await expect(live(page)).not.toContainText('node 1 ');
  await expect(live(page)).not.toContainText('node 5');
});

// regression: P3-RT-11-08
test('scrubbing is announced once', async ({ page }) => {
  await open(page, 'g=A3&v=n&m=f&c=n&s=1,1,1');
  for (const label of [1, 2, 3, 1, 2]) await fire(page, label);
  await expect(live(page)).toHaveText(/Move 5\.$/);
  const texts = await recordLive(page);
  await node(page, 'numbers', 1).focus();
  for (let k = 0; k < 4; k++) await page.keyboard.press('u');
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await page.waitForTimeout(900);
  const said = await texts();
  expect(said).toHaveLength(1);
  // A-4, the whole sentence: back at move 1, A3 after firing node 1 from all ones.
  expect(await values(page, 'numbers')).toEqual(['-1', '2', '1']);
  expect(said[0]).toBe('Undid move 2. Numbers now minus 1, 2, 1.');
});

// regression: P3-RT-11-08
test('game over is announced', async ({ page }) => {
  await open(page, 'g=A2&v=n&m=l&c=n&s=1,1');
  for (const label of [1, 2, 1]) await fire(page, label);
  // A-4, the whole text: the move that ends the game, then the game over (decisions/P1-A5.md).
  await expect(live(page)).toHaveText('Fired node 1. Numbers now minus 1, minus 1. Move 3. Game over after 3 moves.');
});

test('play to the end on A3', async ({ page }) => {
  await open(page, 'g=A3&v=n&m=l&c=n&s=1,1,1');
  const texts = await recordLive(page);
  await control(page, 'playToEnd').click();
  await expect(root(page)).toHaveAttribute('data-moves', '6');
  expect(await values(page, 'numbers')).toEqual(['-1', '-1', '-1']);
  await page.waitForTimeout(900);
  expect(await texts()).toEqual(['Played 6 moves to the end. Numbers now minus 1, minus 1, minus 1.']);
  await expect(out(page, 'gameOver')).toHaveText(/game over after 6 moves/i);
  // The history holds every position of the play.
  await expect(out(page, 'historyStrip').locator('[data-step]')).toHaveCount(7);
});

test('raising play on A3', async ({ page }) => {
  await open(page, 'g=A3&v=p&m=r&c=p&s=1,0,0');
  expect(await nodes(page, 'populations').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-can-act')))).toEqual(['false', 'true', 'false']);
  await control(page, 'step').click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await control(page, 'playToEnd').click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  expect(await values(page, 'populations')).toEqual(['1', '1', '1']);
  await expect(control(page, 'step')).toBeDisabled();
});

test('numbers start falls back by view and board', async ({ page }) => {
  await open(page, 'g=A2&v=p&m=f&c=n&s=1,0');
  expect(await values(page, 'populations')).toEqual(['2/3', '1/3']);
  expect(await values(page, 'numbers')).toEqual(['1', '0']);
  await expect(out(page, 'bridgeSentence')).toHaveText(BRIDGE);
  await open(page, 'g=E8&v=p&m=f&c=n&s=1,1,1,1,1,1,1,1');
  await expect(nodes(page, 'numbers')).toHaveCount(0);
  const pops = await values(page, 'populations');
  expect(pops).toHaveLength(8);
  expect(pops.every((v) => /^-?\d+$/.test(v))).toBe(true);
  for (const v of ['l', 'p']) {
    await open(page, `g=${TRIANGLE}&v=${v}&m=f&c=n&s=1,1,1`);
    await expect(nodes(page, 'populations')).toHaveCount(0);
    await expect(nodes(page, 'numbers')).toHaveCount(3);
    await expect(out(page, 'notice')).toHaveCount(0);
  }
});

test('view and mode outside the table gives defaults and notice', async ({ page }) => {
  await open(page, 'g=A2&v=p&m=l&c=p&s=1,0');
  await expect(out(page, 'notice')).toHaveText('The link could not be read, so the tool shows its default state.');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  expect(await values(page, 'populations')).toEqual(['1', '0']);
  expect(await values(page, 'numbers')).toEqual(['2', '-1']);
});

test('redo, reset and acting from an earlier position', async ({ page }) => {
  await open(page, 'g=A3&v=n&m=f&c=n&s=1,1,1');
  for (const label of [1, 2, 3]) await fire(page, label);
  const three = await values(page, 'numbers');
  await control(page, 'undo').click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await control(page, 'redo').click();
  await expect(root(page)).toHaveAttribute('data-moves', '3');
  expect(await values(page, 'numbers')).toEqual(three);
  await control(page, 'reset').click();
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  expect(await values(page, 'numbers')).toEqual(['1', '1', '1']);
  for (const label of [1, 2, 3, 1, 2]) await fire(page, label);
  await out(page, 'historyStrip').locator('[data-step="2"]').click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await fire(page, 3);
  await expect(root(page)).toHaveAttribute('data-moves', '3');
  await expect(out(page, 'historyStrip').locator('[data-step]')).toHaveCount(4);
  await control(page, 'redo').click();
  await expect(root(page)).toHaveAttribute('data-moves', '3');
});

test('forbidden move in link gives defaults and notice', async ({ page }) => {
  await open(page, 'g=A2&v=n&m=l&c=n&s=1,1&w=2.2');
  await expect(out(page, 'notice')).toHaveText('The link could not be read, so the tool shows its default state.');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await expect(nodes(page, 'populations')).toHaveCount(2);
});

const E8_LONG = 'g=E8&v=n&m=f&c=n&s=9007199254740993,1,1,1,1,1,1,1';

test('E8 link with a 16-digit start entry 9007199254740993 loads without notice', async ({ page }) => {
  await open(page, E8_LONG);
  await expect(out(page, 'notice')).toHaveCount(0);
  await expect(node(page, 'numbers', 1)).toHaveAttribute('data-value', '9007199254740993');
  await fire(page, 1);
  await expect(node(page, 'numbers', 1)).toHaveAttribute('data-value', '-9007199254740993');
  await expect(node(page, 'numbers', 3)).toHaveAttribute('data-value', '9007199254740994');
});

test('custom triangle by link', async ({ page }) => {
  await open(page, `g=${TRIANGLE}&v=n&m=f&c=n&s=1,1,1`);
  await expect(nodes(page, 'numbers')).toHaveCount(3);
  for (const label of [1, 2, 3, 1]) await fire(page, label);
  // Free play on the triangle (Big arithmetic): values from the engine's fire.
  expect(await values(page, 'numbers')).toEqual(['-5', '7', '1']);
  await expect(root(page).locator('[data-road-style]').first()).toHaveAttribute('data-road-style', 'dynkin');
});

test('long values shortened, exact in table', async ({ page }) => {
  await open(page, E8_LONG);
  await expect(root(page).locator('[data-numeral="1"]')).toHaveText('9.0071... x 10^15 (16 digits)');
  await expect(node(page, 'numbers', 1)).toHaveAttribute('title', '9007199254740993');
  await root(page).locator('details summary').click();
  await expect(root(page).locator('[data-table-board="numbers"][data-table-node="1"]')).toHaveText('9007199254740993');
});

test('axe on /tools/board', async ({ page }) => {
  await open(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) }));
  expect(serious).toEqual([]);
});

test('download data', async ({ page }) => {
  await open(page, 'g=A2&v=l&m=f&c=n&s=1,0');
  await fire(page, 2, 'numbers');
  const [download] = await Promise.all([page.waitForEvent('download'), control(page, 'downloadData').click()]);
  const doc = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(doc.tool).toBe('board');
  expect(doc.state).toMatchObject({ board: 'A2', view: 'linked', mode: 'free', coords: 'numbers', start: [1, 0], moves: [2] });
  expect(typeof doc.engineVersion).toBe('string');
  expect(typeof doc.commit).toBe('string');
  expect(doc.derived.positions[0]).toEqual({ move: 0, populations: ['2/3', '1/3'], numbers: [1, 0] });
  expect(doc.derived.positions).toHaveLength(2);

  await open(page, E8_LONG);
  const [d2] = await Promise.all([page.waitForEvent('download'), control(page, 'downloadData').click()]);
  const e8 = JSON.parse(readFileSync((await d2.path())!, 'utf8'));
  expect(e8.state.start[0]).toBe('9007199254740993');
  expect(e8.state.start[1]).toBe(1);
  expect(e8.derived.positions[0].numbers[0]).toBe('9007199254740993');
});

test('replaceState after a burst and Copy link encodes the current state', async ({ page }) => {
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
  await open(page, 'g=A3&v=n&m=f&c=n&s=1,1,1');
  await page.waitForTimeout(800);
  const length = await page.evaluate(() => history.length);
  const startSearch = await page.evaluate(() => location.search);
  for (const label of [1, 2, 3]) await fire(page, label);
  expect(await page.evaluate(() => location.search)).toBe(startSearch);
  await expect.poll(() => page.evaluate(() => location.search), { timeout: 3000 }).toContain('w=1.2.3');
  expect(await page.evaluate(() => history.length)).toBe(length);
  await control(page, 'undo').click();
  await control(page, 'copyLink').click();
  const copied = await page.evaluate(() => (window as unknown as { __copied?: string }).__copied ?? '');
  expect(copied).toContain('w=1.2');
  expect(copied).not.toContain('w=1.2.3');
  expect(await page.evaluate(() => history.length)).toBe(length);
});

test('picker offers 32 types by letter and resets start and moves', async ({ page }) => {
  await open(page);
  const picker = control(page, 'picker');
  const groups = await picker.evaluate((el) =>
    [...el.querySelectorAll('optgroup')].map((g) => ({ letter: g.getAttribute('data-letter'), names: [...g.querySelectorAll('option')].map((o) => o.value) })),
  );
  expect(groups.flatMap((g) => g.names)).toHaveLength(32);
  expect(groups.map((g) => g.letter)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  for (const g of groups) expect(g.names.every((n) => n.startsWith(g.letter!))).toBe(true);
  expect(groups.flatMap((g) => g.names).some((n) => n.includes('~'))).toBe(false);
  await fire(page, 1, 'populations');
  await fire(page, 2, 'populations');
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await picker.selectOption('D4');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await expect(nodes(page, 'populations')).toHaveCount(4);
  expect(await values(page, 'populations')).toEqual(['1', '0', '0', '0']);
  await picker.selectOption('C2');
  await expect(root(page).locator('[data-board-group]').first()).toHaveAttribute('aria-label', 'Populations board on C2');
  await expect(picker).toHaveValue('C2');
});

test('signs and may-act ring not by colour alone', async ({ page }) => {
  const paint = (label: number) =>
    root(page)
      .locator(`[data-disc="${label}"]`)
      .first()
      .evaluate((el) => ({ fill: getComputedStyle(el).fill }));
  await open(page, 'g=A2&v=n&m=f&c=n&s=1,-1');
  await expect(node(page, 'numbers', 1)).toHaveAttribute('data-sign', 'positive');
  await expect(node(page, 'numbers', 2)).toHaveAttribute('data-sign', 'negative');
  await expect(node(page, 'numbers', 1)).toHaveAccessibleName(/value 1,/);
  await expect(node(page, 'numbers', 2)).toHaveAccessibleName(/value minus 1,/);
  expect((await paint(1)).fill).not.toBe('none');
  expect((await paint(2)).fill).toBe('none');
  await open(page, 'g=A3&v=n&m=l&c=n&s=1,0,-1');
  expect(await nodes(page, 'numbers').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-sign')))).toEqual(['positive', 'zero', 'negative']);
  expect((await paint(2)).fill).toBe('none');
  const list = nodes(page, 'numbers');
  for (let k = 0; k < 3; k++) {
    const b = list.nth(k);
    expect(await b.getAttribute('data-ring')).toBe(await b.getAttribute('data-can-act'));
  }
  expect(await list.evaluateAll((bs) => bs.map((b) => b.getAttribute('data-ring')))).toEqual(['true', 'false', 'false']);
});

test('scrub by buttons and keys without dragging', async ({ page }) => {
  await open(page, 'g=A3&v=n&m=f&c=n&s=1,1,1');
  const seen: string[][] = [await values(page, 'numbers')];
  for (const label of [1, 2, 3, 1, 2]) {
    await fire(page, label);
    seen.push(await values(page, 'numbers'));
  }
  const step = (k: number): Locator => out(page, 'historyStrip').locator(`[data-step="${k}"]`);
  await step(2).click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  expect(await values(page, 'numbers')).toEqual(seen[2]);
  await step(4).focus();
  await page.keyboard.press('Enter');
  await expect(root(page)).toHaveAttribute('data-moves', '4');
  expect(await values(page, 'numbers')).toEqual(seen[4]);
  await step(2).focus();
  await page.keyboard.press(' ');
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  // More than 50 positions: the slider with its counter, moved by arrow keys.
  await open(page, 'g=E8&v=n&m=l&c=n&s=1,1,1,1,1,1,1,1');
  await control(page, 'playToEnd').click();
  await expect(root(page)).toHaveAttribute('data-moves', '120');
  const slider = control(page, 'historySlider');
  await expect(out(page, 'historyCounter')).toHaveText('120 of 120');
  await slider.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(root(page)).toHaveAttribute('data-moves', '119');
  await expect(out(page, 'historyCounter')).toHaveText('119 of 120');
  await page.keyboard.press('Home');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  expect(await values(page, 'numbers')).toEqual(['1', '1', '1', '1', '1', '1', '1', '1']);
});

test('table view buttons act like nodes', async ({ page }) => {
  await open(page, 'g=A2&v=n&m=f&c=n&s=1,1');
  await root(page).locator('details summary').click();
  const cell = root(page).locator('[data-table-board="numbers"][data-table-node="2"]');
  await expect(cell).toHaveText('1');
  await cell.click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  expect(await values(page, 'numbers')).toEqual(['2', '-1']);
  await expect(live(page)).toHaveText('Fired node 2. Numbers now 2, minus 1. Move 1.');
  await expect(root(page).locator('[data-table-board="numbers"][data-table-node="1"]')).toHaveText('2');
  await expect(cell).toHaveText('−1');
  // In the linked view the table has a row per board, with the fractions exact.
  await open(page, 'g=A2&v=l&m=f&c=n&s=1,0');
  await root(page).locator('details summary').click();
  await expect(root(page).locator('[data-table-board="populations"]')).toHaveCount(2);
  await expect(root(page).locator('[data-table-board="populations"][data-table-node="1"]')).toHaveAccessibleName('City 1, population 2 over 3');
});

test('figure has a text alternative', async ({ page }) => {
  await open(page, 'g=A2&v=l&m=f&c=p&s=1,0');
  const groups = root(page).locator('[data-board-group]');
  await expect(groups).toHaveCount(2);
  await expect(groups.nth(0)).toHaveAttribute('aria-label', 'Populations board on A2');
  await expect(groups.nth(1)).toHaveAttribute('aria-label', 'Numbers board on A2');
  const label = await root(page).locator('figure').getAttribute('aria-label');
  expect(label).toBe('Game Board on A2, linked view, free play: populations 1, 0; numbers 2, minus 1.');
});
